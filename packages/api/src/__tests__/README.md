# Test Suite Documentation

## Overview
This document describes the comprehensive test suite for the Swiggy API project, covering unit tests, integration tests, and test fixtures.

## Test Structure

```
packages/api/src/__tests__/
├── fixtures/
│   ├── test-data.ts        # Reusable test data generators and constants
│   ├── mocks.ts            # Mock implementations for services and repositories
│   └── factory.ts          # Test setup factories and utilities
├── unit/
│   ├── handlers/
│   │   ├── workspace.test.ts        # Workspace handler tests
│   │   ├── project.test.ts          # Project handler tests
│   │   ├── issue.test.ts            # Issue handler tests
│   │   ├── comment.test.ts          # Comment handler tests
│   │   └── search-analytics.test.ts # Search analytics handler tests
│   └── services/
│       └── (service unit tests - future)
└── integration/
    └── workflows.test.ts # End-to-end workflow integration tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Verbose Output
```bash
npm run test:verbose
```

### Debug Mode
```bash
npm run test:debug
```

## Test Data Generators

The `test-data.ts` file provides factory functions for creating consistent test objects:

### Available Generators
- `createTestWorkspace()` - Creates a workspace object
- `createTestProject()` - Creates a project object
- `createTestIssue()` - Creates an issue object
- `createTestComment()` - Creates a comment object
- `createTestSprint()` - Creates a sprint object
- `createTestWorkflow()` - Creates a workflow object
- `createTestSearchAnalyticsEvent()` - Creates a search analytics event
- `createMockRequest()` - Creates a mock Express request
- `createMockResponse()` - Creates a mock Express response
- `createMockNext()` - Creates a mock Express next function

### Usage Example
```typescript
import { createTestWorkspace, TEST_USERS, TEST_IDS } from '../fixtures/test-data';

const workspace = createTestWorkspace({
  id: 'custom-id',
  name: 'Custom Workspace'
});
```

## Mock Implementations

The `mocks.ts` file provides complete mock implementations for:
- **Repositories**: Workspace, Project, Issue, Comment, Sprint, Workflow, SearchAnalytics
- **Services**: Workspace, Project, Issue, Comment, Sprint, Workflow, Search, SearchAnalytics
- **Middleware**: Auth middleware

All mocks use Jest Mock functions and return promise-based responses for async operations.

### Usage Example
```typescript
import { createMockAppDependencies, createMockAuthMiddleware } from '../fixtures/mocks';

const deps = createMockAppDependencies();
const auth = createMockAuthMiddleware();

// Setup mock behavior
deps.services.project.createProject.mockResolvedValueOnce(/*...*/);
```

## Test Utilities

The `factory.ts` file provides helper functions for common testing patterns:

### Available Utilities
- `setupTestScenario()` - Complete test context with all services and data
- `createHandlerTestContext()` - Handler testing context with req/res/deps
- `assertSuccessResponse()` - Assert successful HTTP response
- `assertErrorResponse()` - Assert error HTTP response
- `setupAuthScenario()` - Setup authorization context
- `createBatchIssues()` - Create multiple test issues
- `verifyMockCalledWith()` - Verify mock was called with specific args
- `resetAllMocks()` - Reset all mocks in dependencies

### Usage Example
```typescript
import { createHandlerTestContext, assertSuccessResponse } from '../fixtures/factory';

const context = createHandlerTestContext({
  body: { name: 'Test Project' }
});

// Use in test
await handler(context.req, context.res, context.next);
assertSuccessResponse(context.res, 201);
```

## Coverage Thresholds

The test suite is configured to enforce the following coverage thresholds (per `jest.config.js`):

```
Global:
- Branches: 70%
- Functions: 80%
- Lines: 80%
- Statements: 80%
```

## Test Categories

### Unit Tests: Handlers

#### Workspace Handlers
- ✅ Create workspace
- ✅ List user workspaces
- ✅ Get workspace details
- ✅ Update workspace
- ✅ Add members
- ✅ Remove members
- ✅ List members
- ✅ Authorization checks

#### Project Handlers
- ✅ Create project
- ✅ Get project details
- ✅ List projects
- ✅ Update project
- ✅ Delete project
- ✅ Add members
- ✅ Authorization checks

#### Issue Handlers
- ✅ Create issue
- ✅ Get issue details
- ✅ List issues
- ✅ Update issue
- ✅ Delete issue
- ✅ Assign issue
- ✅ Get issue history
- ✅ Status transitions
- ✅ Validation (type, priority)

#### Comment Handlers
- ✅ Create comment
- ✅ List comments
- ✅ Update comment
- ✅ Delete comment
- ✅ Comment validation
- ✅ XSS protection
- ✅ Thread support
- ✅ Mentions handling

#### Search Analytics Handlers
- ✅ Record search event
- ✅ Get trending searches
- ✅ Get performance metrics
- ✅ Get search history
- ✅ Get search breakdown
- ✅ Get period comparison
- ✅ Cleanup old events
- ✅ Authorization checks

### Integration Tests

#### Complete Workflows
- ✅ Workspace → Project → Issue → Comment flow
- ✅ Search analytics complete flow
- ✅ Sprint management workflow
- ✅ Authorization & permissions
- ✅ Comment thread workflow
- ✅ Error recovery
- ✅ Concurrent operations

## Writing New Tests

### Test Template
```typescript
import { createHandlerTestContext } from '../fixtures/factory';
import { createTestWorkspace, TEST_USERS } from '../fixtures/test-data';

describe('Feature Handlers', () => {
  let context: any;

  beforeEach(() => {
    context = createHandlerTestContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /feature - Create Feature', () => {
    it('should create a feature with valid input', async () => {
      const data = { name: 'Test' };
      
      context.deps.services.feature.create.mockResolvedValueOnce({
        id: 'feature-1',
        ...data
      });

      const result = await context.deps.services.feature.create(data);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test');
    });
  });
});
```

### Best Practices
1. **Use factories** - Always use test data generators instead of hardcoding objects
2. **Mock external dependencies** - Mock databases, external APIs, and services
3. **Test both success and error** - Include validation failure and error handling tests
4. **Use descriptive test names** - Test descriptions should be clear and specific
5. **Reset mocks** - Always reset mocks after each test with `afterEach`
6. **Group related tests** - Use `describe` blocks to organize tests logically
7. **Test authorization** - Always verify auth checks for protected endpoints

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```bash
# Build (compile TypeScript)
npm run build

# Type check
npm run type-check

# Run all tests with coverage
npm run test:coverage

# The tests will fail if coverage thresholds are not met
```

## Troubleshooting

### Tests Timing Out
- Increase Jest timeout: `jest.setTimeout(10000)` in test file
- Check for unresolved promises or pending timers

### Mock Not Working
- Ensure mock is set up before calling the function
- Use async/await for mocked async functions
- Check mock call count: `expect(mock).toHaveBeenCalled()`

### Coverage Below Threshold
- Run `npm run test:coverage` to see coverage report
- Add tests for uncovered lines/branches
- Use `.skip` or `.only` to debug specific tests: `it.only('test', () => {})`

## Future enhancements

- [ ] Add service layer unit tests
- [ ] Add middleware tests (auth)
- [ ] Add database integration tests with test containers
- [ ] Add performance benchmarking tests
- [ ] Add load testing scenarios
- [ ] Add E2E tests with real HTTP client
- [ ] Add mutation testing for test quality
- [ ] Add snapshot testing for API responses
