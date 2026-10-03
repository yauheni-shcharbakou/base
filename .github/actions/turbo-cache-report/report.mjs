// Writes the job summary of `.github/actions/turbo-cache-report`: the remote cache's status, then
// one row per turbo run of the job — where its hits came from, what missed, what is never cached.
// Never fails the step: a report that cannot be made is a warning, the job's checks are elsewhere.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNS = '.turbo/runs';

const warn = (message) => console.log(`::warning title=Turbo cache::${message}`);

// The team's Remote Caching status, as the token the remote cache action exchanged sees it.
async function remoteStatus() {
  const { TURBO_TOKEN: token, TURBO_TEAM: team, EXPECT_REMOTE: expected } = process.env;
  if (!token || !team) {
    if (expected !== 'true') return 'off for this run';
    warn(
      'the remote cache was unreachable: the OIDC exchange set no TURBO_TOKEN, so this run used the local cache alone.',
    );
    return 'unreachable (no token)';
  }
  try {
    const response = await fetch(
      `https://api.vercel.com/v8/artifacts/status?slug=${encodeURIComponent(team)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
      warn(`the remote cache status request got HTTP ${response.status}.`);
      return `unknown (HTTP ${response.status})`;
    }
    const { status } = await response.json();
    if (status !== 'enabled') warn(`the remote cache is ${status} for the team ${team}.`);
    return status;
  } catch (error) {
    warn(`the remote cache status request failed: ${error.message}`);
    return 'unknown';
  }
}

// One run summary, counted. Throws on a shape it does not know: the format is turbo's, not a contract.
function count(summary) {
  if (!Array.isArray(summary.tasks)) throw new Error('no tasks');
  const row = { tasks: 0, remote: 0, local: 0, missed: 0, uncached: 0, saved: 0 };
  for (const task of summary.tasks) {
    const { cache } = task;
    if (!cache || !['HIT', 'MISS'].includes(cache.status))
      throw new Error(`${task.taskId}: no cache status`);
    row.tasks += 1;
    if (task.resolvedTaskDefinition?.cache === false) row.uncached += 1;
    else if (cache.status === 'MISS') row.missed += 1;
    else {
      if (cache.source === 'REMOTE') row.remote += 1;
      else row.local += 1;
      row.saved += cache.timeSaved ?? 0;
    }
  }
  return row;
}

const status = await remoteStatus();

const runs = [];
if (existsSync(RUNS)) {
  for (const file of readdirSync(RUNS).filter((name) => name.endsWith('.json'))) {
    try {
      const summary = JSON.parse(readFileSync(join(RUNS, file), 'utf8'));
      runs.push({
        command: summary.execution?.command ?? file,
        start: summary.execution?.startTime ?? 0,
        ...count(summary),
      });
    } catch (error) {
      warn(
        `${file} is not a run summary this report can read (${error.message}); turbo may have changed its format.`,
      );
    }
  }
}
runs.sort((a, b) => a.start - b.start);

const lines = ['### Turbo cache', '', `Remote cache: **${status}**`, ''];
if (runs.length === 0) {
  lines.push('No run summaries: turbo did not get to run, or `TURBO_RUN_SUMMARY` is not set.');
} else {
  lines.push(
    '| Run | Tasks | Remote hits | Local hits | Misses | Not cached | Time saved |',
    '|---|--:|--:|--:|--:|--:|--:|',
    ...runs.map(
      (run) =>
        `| \`${run.command.replaceAll('|', '\\|')}\` | ${run.tasks} | ${run.remote} | ${run.local} | ` +
        `${run.missed} | ${run.uncached} | ${Math.round(run.saved / 1000)}s |`,
    ),
  );
}

const report = `${lines.join('\n')}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
else process.stdout.write(report);
