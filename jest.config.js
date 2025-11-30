export default {
  testEnvironment: 'node',
  transform: {},
  injectGlobals: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'apis/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  verbose: true,
};

