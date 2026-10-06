// Writes the job summary of `.github/actions/vitest-report`: one row per package, its unit and e2e
// suites side by side. Never fails the step: a report that cannot be made is a warning, the job's
// tests are checked elsewhere.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.VITEST_REPORT_DIR;

const warn = (message) => console.log(`::warning title=Vitest report::${message}`);

// One suite's JSON report, counted. Throws on a shape it does not know: the format is Vitest's.
function count(report) {
  if (!Array.isArray(report.testResults)) throw new Error('no testResults');
  for (const key of ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests']) {
    if (typeof report[key] !== 'number') throw new Error(`no ${key}`);
  }
  // Wall time: from the run's start to the last file's end (files run in parallel, so no sum).
  const ends = report.testResults.map((file) => file.endTime).filter(Number.isFinite);
  return {
    ms: ends.length && Number.isFinite(report.startTime) ? Math.max(...ends) - report.startTime : 0,
    files: report.testResults.length,
    total: report.numTotalTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests + (report.numTodoTests ?? 0),
  };
}

// `@backend__cache.unit.json` → the package `@backend/cache`, the suite `unit`.
function parse(file) {
  const match = /^(.+)\.(unit|e2e)\.json$/.exec(file);
  return match && { pkg: match[1].replaceAll('__', '/'), suite: match[2] };
}

const filesCell = (suite) => (suite && suite.files > 0 ? String(suite.files) : '—');

const timeCell = (suite) =>
  suite && suite.files > 0 && suite.ms > 0 ? `${(suite.ms / 1000).toFixed(1)}s` : '—';

function testsCell(suite) {
  if (!suite || suite.files === 0) return '—';
  const marks = [];
  if (suite.failed) marks.push(`❌ ${suite.failed}`);
  if (suite.skipped) marks.push(`⏭ ${suite.skipped}`);
  return marks.length ? `${suite.passed} / ${suite.total} ${marks.join(' ')}` : String(suite.total);
}

const packages = new Map();
if (DIR && existsSync(DIR)) {
  for (const file of readdirSync(DIR)) {
    const parsed = parse(file);
    if (!parsed) continue;
    try {
      const row = packages.get(parsed.pkg) ?? {};
      row[parsed.suite] = count(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
      packages.set(parsed.pkg, row);
    } catch (error) {
      warn(
        `${file} is not a report this can read (${error.message}); Vitest may have changed its format.`,
      );
    }
  }
}

const lines = ['### Tests', ''];
if (packages.size === 0) {
  lines.push('No Vitest reports: the tests did not get to run, or `VITEST_REPORT_DIR` is not set.');
} else {
  const sum = { unit: { files: 0, total: 0 }, e2e: { files: 0, total: 0 } };
  let failed = 0;
  let skipped = 0;
  lines.push(
    '| Package | Unit files | Unit tests | Unit time | E2E files | E2E tests | E2E time |',
    '|---|--:|--:|--:|--:|--:|--:|',
  );
  for (const [pkg, { unit, e2e }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(
      `| \`${pkg}\` | ${filesCell(unit)} | ${testsCell(unit)} | ${timeCell(unit)} | ${filesCell(e2e)} | ${testsCell(e2e)} | ${timeCell(e2e)} |`,
    );
    for (const [key, suite] of [
      ['unit', unit],
      ['e2e', e2e],
    ]) {
      if (!suite) continue;
      sum[key].files += suite.files;
      sum[key].total += suite.total;
      failed += suite.failed;
      skipped += suite.skipped;
    }
  }
  lines.push(
    `| **Total** | **${sum.unit.files}** | **${sum.unit.total}** | — | **${sum.e2e.files}** | **${sum.e2e.total}** | — |`,
    '',
  );
  if (failed) lines.push(`❌ ${failed} failed.`);
  if (skipped) lines.push(`⏭ ${skipped} skipped: an e2e suite whose server did not answer skips.`);
  if (!failed && !skipped) lines.push('Every test passed.');
}

const report = `${lines.join('\n')}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
else process.stdout.write(report);
