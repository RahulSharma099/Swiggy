module.exports = {
  projects: [
    '<rootDir>/packages/shared',
    '<rootDir>/packages/database',
    '<rootDir>/packages/api',
    '<rootDir>/packages/websocket',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/src/index.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
};
