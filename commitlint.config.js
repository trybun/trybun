// Commit messages and pull request titles (the squash commit): Conventional Commits with the
// closed scope list of §2.14. A new scope is added there first.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'server',
        'ui',
        'contracts',
        'i18n',
        'config',
        'deploy',
        'docs',
        'spec',
        'plan',
        'adr',
        'agents',
        'memory',
        'brand',
        'repo',
        'ci',
        'deps',
        'release',
      ],
    ],
    // Bodies carry release notes of Dependabot and long links; the header stays limited.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
