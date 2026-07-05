// Clean-architecture layer-direction guard for ESLint flat config.
//
// Dependencies flow inward: interface -> infrastructure -> application -> domain.
// A file in a given layer may not import from a layer "outside" it. The match is
// by path segment regardless of depth, so it works for every layout in the repo:
//   - apps:        src/modules/<feature>/<layer>/...
//   - pg/mongo:    src/{core,migration}/<layer>/...
//   - nats:        src/<layer>/...
// Composition roots (`*.module.ts`, `main.ts`) sit outside any <layer>/ dir and
// are therefore exempt — they are allowed to wire concrete impls together.

const DEFAULT_FORBIDDEN = {
  domain: ['application', 'infrastructure', 'interface'],
  application: ['infrastructure', 'interface'],
  infrastructure: ['interface'],
};

/**
 * @param {Record<string, string[]>} [forbidden] map of layer -> layers it may not import.
 * @returns flat-config blocks, one per source layer.
 */
export default function layerGuard(forbidden = DEFAULT_FORBIDDEN) {
  return Object.entries(forbidden).map(([layer, targets]) => ({
    files: [`**/${layer}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: targets.map((target) => ({
            group: [`**/${target}`, `**/${target}/*`],
            message: `${layer}/ must not import from ${target}/ (dependencies flow interface -> infrastructure -> application -> domain).`,
          })),
        },
      ],
    },
  }));
}
