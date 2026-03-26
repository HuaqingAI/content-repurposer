import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const NPX_JEST_MODULES = '/home/node/.npm/_npx/b8d86e6551a4f492/node_modules'
const LOCAL_REACT = '/home/node/a0/workspace/a1a2c1a1-3a9e-4421-83f3-b434605ecbaf/workspace/content-repurposer/node_modules'

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // Ensure NODE_ENV=test before any module loads so React dev builds are used
  setupFiles: ['<rootDir>/jest.env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Force all react/react-dom imports to use the project's local copy (single instance)
    '^react$': `${LOCAL_REACT}/react`,
    '^react-dom$': `${LOCAL_REACT}/react-dom`,
    // Force test-utils to development build so React.act is available regardless of NODE_ENV
    '^react-dom/test-utils$': `${LOCAL_REACT}/react-dom/cjs/react-dom-test-utils.development.js`,
    '^react-dom/(.*)$': `${LOCAL_REACT}/react-dom/$1`,
    '^react/(.*)$': `${LOCAL_REACT}/react/$1`,
  },
  modulePaths: [NPX_JEST_MODULES],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
}

export default createJestConfig(config)
