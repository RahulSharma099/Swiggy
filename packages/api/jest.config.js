module.exports = {
  displayName: '@pms/api',
  testEnvironment: 'node',
  preset: 'ts-jest',
  rootDir: './src',
  passWithNoTests: true,
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@pms/shared$': '<rootDir>/../shared/src',
    '^@pms/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@pms/database$': '<rootDir>/../database/src',
    '^@pms/database/(.*)$': '<rootDir>/../database/src/$1',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
