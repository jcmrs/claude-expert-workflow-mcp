# Testing Suite Documentation

## Overview
This comprehensive testing suite provides 90%+ code coverage for the Multi-Expert Orchestration System with both unit and integration tests.

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test configuration
├── fixtures/                   # Test data and mock objects
│   ├── index.ts                # Exports all test fixtures
│   └── testData.ts             # Mock data for tests
├── mocks/                      # Mock implementations
│   ├── anthropic.ts            # Claude API mocks
│   └── mcp.ts                  # MCP server mocks
├── unit/                       # Unit tests
│   ├── experts/                # Expert system tests
│   │   ├── productManager.test.ts
│   │   ├── uxDesigner.test.ts
│   │   └── softwareArchitect.test.ts
│   ├── orchestration/          # Orchestration component tests
│   │   ├── workflowEngine.test.ts
│   │   ├── expertOrchestrator.test.ts
│   │   └── crossReferenceManager.test.ts
│   ├── templates/              # Template generator tests
│   │   ├── prd.test.ts
│   │   ├── designSpec.test.ts
│   │   └── techArchitecture.test.ts
│   ├── claude/                 # Claude client tests
│   │   └── client.test.ts
│   ├── state/                  # State management tests
│   │   └── conversationManager.test.ts
│   └── utils/                  # Utility tests
│       └── logger.test.ts
└── integration/                # Integration tests
    ├── mcpServer.test.ts       # MCP server integration
    └── workflowEnd2End.test.ts # End-to-end workflow tests
```

## Test Categories

### Unit Tests
- **Expert Systems**: Test individual expert configurations, prompts, and topic coverage
- **Orchestration**: Test workflow management, expert coordination, and cross-reference generation
- **Templates**: Test document generation for PRD, Design Spec, and Technical Architecture
- **Core Components**: Test Claude client, conversation management, and utilities

### Integration Tests
- **MCP Server**: Test all 8 MCP tools with proper error handling and validation
- **End-to-End Workflows**: Test complete workflow execution from start to finish
- **Document Generation Pipeline**: Test integrated document creation with cross-references

## Test Scripts

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage reporting
npm run test:coverage

# Run tests for CI (with coverage, no watch)
npm run test:ci

# Comprehensive validation (typecheck + lint + test with coverage)
npm run test:validate
```

## Coverage Requirements

The testing suite is configured to achieve and maintain:
- **85%+ Statement Coverage**
- **85%+ Branch Coverage** 
- **85%+ Function Coverage**
- **85%+ Line Coverage**

## Key Test Features

### 1. Comprehensive Mocking
- **Claude API**: Fully mocked Anthropic client with realistic responses
- **MCP Server**: Mock server transport and request handling
- **File System**: In-memory conversation and workflow state management

### 2. Test Data Fixtures
- Complete mock objects for all data structures
- Realistic project scenarios (FoodieDelivery app example)
- Sample expert outputs and cross-references

### 3. Error Scenario Testing
- API failure recovery
- Invalid input validation
- Workflow error handling and restart capabilities
- Edge cases and boundary conditions

### 4. Integration Validation
- Full workflow execution testing
- Document generation pipeline validation
- Cross-reference generation and linking
- MCP tool functionality verification

## Test Utilities

### Setup and Teardown
- Global Jest configuration with TypeScript support
- Automatic mock clearing between tests
- Console output suppression for clean test runs

### Assertions and Matchers
- Custom matchers for workflow states
- Document structure validation
- Expert output format verification
- Cross-reference relationship validation

## Running Tests

### Prerequisites
```bash
npm install
```

### Development Workflow
1. **Run tests during development**: `npm run test:watch`
2. **Validate before commit**: `npm run test:validate`
3. **Check coverage**: `npm run test:coverage`

### CI/CD Integration
The `npm run test:ci` command is optimized for continuous integration:
- No watch mode
- Coverage reporting
- Fail-fast on errors
- Clean output formatting

## Test Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Format**: `coverage/lcov.info`
- **JSON Summary**: `coverage/coverage-summary.json`

## Adding New Tests

### Unit Test Template
```typescript
import { YourModule } from '@/path/to/module';
import { mockData } from '@/__tests__/fixtures';

jest.mock('@/dependency');

describe('YourModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle error case', () => {
      // Error scenario test
    });
  });
});
```

### Integration Test Template
```typescript
import { SystemUnderTest } from '@/system';
import { mockDependencies } from '@/__tests__/fixtures';

describe('System Integration', () => {
  let system: SystemUnderTest;

  beforeEach(() => {
    system = new SystemUnderTest();
  });

  it('should execute end-to-end workflow', async () => {
    // Multi-step integration test
  });
});
```

## Debugging Tests

### Common Issues
1. **Module Resolution**: Check `moduleNameMapping` in Jest config
2. **Async Operations**: Ensure proper `await` and timeout configuration
3. **Mock Cleanup**: Verify `jest.clearAllMocks()` in `beforeEach`
4. **Type Issues**: Check TypeScript configuration alignment

### Debugging Commands
```bash
# Run specific test file
npm test -- --testPathPattern=workflowEngine

# Run with verbose output
npm test -- --verbose

# Run single test case
npm test -- --testNamePattern="should start workflow"

# Debug with node inspector
npm test -- --runInBand --inspect-brk
```

## Performance Considerations

- **Test Timeout**: Configured for 30 seconds to handle integration tests
- **Parallel Execution**: Jest runs tests in parallel by default
- **Mock Performance**: Lightweight mocks to avoid test overhead
- **Memory Management**: Proper cleanup prevents memory leaks

## Quality Assurance

### Test Quality Metrics
- **Assertion Density**: Multiple assertions per test case
- **Edge Case Coverage**: Boundary conditions and error scenarios
- **Integration Depth**: End-to-end workflow validation
- **Mock Accuracy**: Realistic mock behaviors matching actual APIs

### Maintenance Guidelines
1. **Update tests with code changes**
2. **Maintain mock accuracy with real APIs**
3. **Regular coverage threshold reviews**
4. **Performance monitoring of test suite**

This testing suite ensures the Multi-Expert Orchestration System is thoroughly validated, maintainable, and production-ready.