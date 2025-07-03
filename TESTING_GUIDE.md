# Test Running Guide for AI Auth

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests for CI/CD
```bash
npm run test:ci
```

### Run specific test files
```bash
# Run specific test file
npm test -- registerController.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should register user"

# Run tests for a specific directory
npm test -- tests/unit/controllers

# Run tests with verbose output
npm test -- --verbose
```

## Test Structure

### Controllers Tests
- `tests/unit/controllers/` - All controller tests
- Tests cover success scenarios, error cases, validation, and edge cases
- Mocked dependencies for isolated testing

### Utils Tests  
- `tests/unit/utils/` - Utility function tests
- Password validation, JWT operations, API responses
- Pure function testing with various inputs

### Services Tests
- `tests/unit/services/` - Service layer tests  
- Email service, SMS service, OTP service
- Mocked external dependencies (nodemailer, twilio)

### Test Utilities
- `tests/utils/` - Test helper functions
- Mock user creation, request/response mocks
- Common test setup and teardown

## Test Coverage Goals

### Target Coverage Levels
- **Lines**: > 90%
- **Functions**: > 90% 
- **Branches**: > 85%
- **Statements**: > 90%

### Critical Areas for Testing
1. **Authentication flows** - Login, registration, password reset
2. **Security features** - 2FA, password validation, rate limiting
3. **Data validation** - Input sanitization, schema validation
4. **Error handling** - API errors, database errors, external service failures
5. **Business logic** - User verification, profile management

## Writing New Tests

### Test File Naming
- Use `.test.ts` suffix
- Match source file name: `userService.ts` → `userService.test.ts`
- Place in corresponding directory structure under `tests/`

### Test Structure Template
```typescript
// Mock dependencies FIRST
jest.mock('../../../src/dependency');

// Import modules
import { ModuleToTest } from '../../../src/module';

describe('ModuleToTest', () => {
  let instance: ModuleToTest;
  
  beforeEach(() => {
    jest.clearAllMocks();
    instance = new ModuleToTest();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange - Set up test data
      
      // Act - Execute the method
      
      // Assert - Verify results
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

### Mocking Guidelines
1. **Mock external dependencies** at the top of test files
2. **Mock database operations** to avoid real DB calls
3. **Mock external services** (email, SMS) for unit tests
4. **Use jest.clearAllMocks()** in beforeEach for clean state

## Debugging Tests

### Common Issues
1. **Mock not working**: Ensure mocks are declared before imports
2. **Async/await issues**: Use proper async/await in test functions
3. **Environment variables**: Set up test environment variables in setup.ts
4. **TypeScript errors**: Check import paths and type definitions

### Debug Commands
```bash
# Run single test with debugging
npm test -- --testNamePattern="specific test" --verbose

# Run with Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Check test coverage for specific files
npm run test:coverage -- --collectCoverageFrom="src/specific/path/**/*.ts"
```

## Test Environment Setup

### Required Environment Variables
All test environment variables are set in `tests/setup.ts`:
- JWT secrets for token testing
- Database configuration for mocked repositories  
- Email/SMS service credentials for mocked services

### Test Database
- Tests use mocked repositories, no real database required
- TypeORM entities are mocked at the AppDataSource level
- Test data created using mock helpers in `tests/utils/`

## Integration Testing (Future Enhancement)

### API Integration Tests
- Test full request/response cycles
- Use supertest for HTTP testing
- Test authentication middleware
- Validate API response formats

### Database Integration Tests  
- Test with real database connections
- Use test database with cleanup between tests
- Test complex queries and relationships
- Validate data persistence

### End-to-End Testing
- Test complete user flows
- Authentication → Verification → Profile management
- Social login flows
- Password reset workflows
