module.exports = {
  forbidden: [
    {
      name: 'no-shared-kernel-on-nest',
      severity: 'error',
      comment: 'shared/kernel must be framework-agnostic',
      from: { path: '^src/shared/kernel' },
      to: { path: '^(@nestjs|@prisma)' },
    },
    {
      name: 'no-domain-on-prisma',
      severity: 'error',
      comment: 'domain layer cannot import Prisma',
      from: { path: 'domain/' },
      to: { path: '^@prisma/client' },
    },
    {
      name: 'no-api-on-infrastructure',
      severity: 'error',
      comment: 'API layer must go through use-cases',
      from: { path: '/api/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'no-application-on-infrastructure',
      severity: 'error',
      comment: 'Application must depend on ports, not infrastructure',
      from: { path: '/application/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'info',
      from: {
        orphan: true,
        pathNot: [
          '\\.(spec|test)\\.ts$',
          '\\.d\\.ts$',
          'eslint\\.config\\.mjs$',
          'scripts/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: './tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
