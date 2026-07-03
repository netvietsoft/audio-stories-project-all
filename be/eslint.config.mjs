// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'prisma/migrations/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Baseline rule overrides: existing flat-structure modules (stories, music,
    // etc.) have not been refactored to the layered architecture yet. Until
    // Phase 1+ migrates them, the type-checked `no-unsafe-*` family and related
    // strict rules surface as warnings (still visible) rather than CI-blocking
    // errors. Architectural enforcement (no-restricted-imports below) remains
    // strictly `error`.
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
      // Prettier formatting demoted from error -> warn: existing god-services
      // were not pre-formatted, and `yarn lint --fix` would reformat ~160 files
      // outside Task 8 scope. Phase 1+ refactors will format their files
      // surgically. Run `yarn format` to apply Prettier directly.
      'prettier/prettier': ['warn', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['src/shared/kernel/**/*.ts', 'src/shared/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                '@prisma/client',
                'axios',
                'ioredis',
                'fs',
                'fs/*',
                'node:fs',
                'node:fs/*',
              ],
              message: 'Domain/kernel layer must not depend on framework/IO.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client'],
              message:
                'Application layer must depend on repository ports, not Prisma directly.',
            },
            {
              group: ['**/infrastructure/**'],
              message: 'Application layer must not import from infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client'],
              message: 'API layer must not depend on Prisma directly.',
            },
            {
              group: ['**/infrastructure/**'],
              message: 'API layer must not import infrastructure adapters directly.',
            },
          ],
        },
      ],
    },
  },
);
