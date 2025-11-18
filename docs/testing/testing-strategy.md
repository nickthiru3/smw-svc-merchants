# Testing Strategy

**Comprehensive testing guide for the Merchants microservice**

---

## Overview

This guide covers the complete testing strategy from unit tests to E2E tests, including patterns, conventions, and best practices.

**Testing Philosophy**:

- ✅ Test what you deploy, deploy what you test
- ✅ Fast feedback loops (unit tests run in milliseconds)
- ✅ Single source of truth (use actual config in tests)
- ✅ Guard against regressions and drift

---

## Test Pyramid

```
        /\
       /  \  E2E (10%)
      /____\
     /      \
    / Integ. \ (20%)
   /__________\
  /            \
 /     Unit     \ (70%)
/________________\
```

**Distribution**:

- **70% Unit Tests** - Fast, isolated, test individual functions
- **20% Integration Tests** - Test with real dependencies (DynamoDB Local)
- **10% E2E Tests** - Test complete API flows (optional, app-level)

---

## Testing Layers

### 1. Unit Tests (Helpers & Utilities)

**Purpose**: Test pure functions and utilities in isolation

**Location**: `test/src/helpers/`

**Guide**: [Unit Helpers Testing Guide](./unit-helpers-testing-guide.md)

**Example**:

```ts
// Test helper function
import { formatMerchantResponse } from "#src/helpers/merchant";

test("formats merchant response correctly", () => {
  const merchant = { merchantId: "123", legalName: "Test Shop" };
  const formatted = formatMerchantResponse(merchant);
  expect(formatted).toHaveProperty("id", "123");
});
```

### 2. Handler Tests (with Mocks)

**Purpose**: Test Lambda handler logic with mocked dependencies

**Location**: `test/handlers/`

**Guide**: [Handler Testing Guide](./handler-testing-guide.md)

**Example**:

```ts
// Mock data access layer
jest.mock("#src/data-access/merchants");

test("handler returns 200 with merchants", async () => {
  const mockGetMerchants = jest.fn().mockResolvedValue([...]);
  const response = await handler(event);
  expect(response.statusCode).toBe(200);
});
```

### 3. Schema Validation Tests (Zod)

**Purpose**: Test request/response schemas and validation

**Location**: `test/schemas/`

**Guide**: [Schema Testing Guide](./schema-testing-guide.md)

**Example**:

```ts
import { MerchantSchema } from "#src/schemas/merchant";

test("validates merchant schema", () => {
  const valid = { merchantId: "123", legalName: "Test" };
  expect(() => MerchantSchema.parse(valid)).not.toThrow();
});
```

### 4. Infrastructure Tests (CDK Templates)

**Purpose**: Validate CloudFormation templates before deployment

**Location**: `test/lib/service-stack.test.ts`

**Guide**: [CDK Template Testing Guide](./cdk-template-testing-guide.md)

**Example**:

```ts
import config from "#config/default";

test("creates Merchants table with MerchantId key", () => {
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
    KeySchema: [{ AttributeName: "MerchantId", KeyType: "HASH" }],
  });
});
```

### 5. Integration Tests (DynamoDB Local)

**Purpose**: Test data access layer with real DynamoDB operations

**Location**: `test/integration/`

**Status**: To be implemented for Story 001

**Topics**:

- Setting up DynamoDB Local
- Seeding test data
- Testing CRUD operations
- Testing access patterns
- Cleanup strategies

### 6. E2E Tests (Supertest)

**Purpose**: Test complete API flows against deployed environment

**Location**: `test/e2e/`

**Guide**: [E2E Testing Guide](./e2e-testing-guide.md)

**Example**:

```ts
import request from "supertest";

test("GET /merchants/search returns merchants", async () => {
  const response = await request(apiUrl)
    .get("/merchants/search?category=Repair")
    .expect(200);
  expect(response.body.merchants).toBeInstanceOf(Array);
});
```

---

## Testing Conventions

### Directory Structure

**Mirror code structure under `test/`**:

```
svc-merchants/
├── lib/
│   ├── db/
│   │   └── faux-sql/
│   │       └── construct.ts
│   └── service-stack.ts
├── src/
│   ├── handlers/
│   │   └── search-merchants.ts
│   └── helpers/
│       └── merchant.ts
└── test/
    ├── lib/
    │   ├── db/
    │   │   └── faux-sql/
    │   │       └── construct.test.ts
    │   └── service-stack.test.ts
    ├── handlers/
    │   └── search-merchants.test.ts
    └── helpers/
        └── merchant.test.ts
```

### Naming Conventions

- Test files: `*.test.ts` (not `*.spec.ts`)
- Test suites: Use `describe()` blocks for grouping
- Test names: Descriptive, action-oriented ("creates table with correct key")

### Configuration

- **Jest base directory**: `<rootDir>/test`
- **Use actual config**: Import from `#config/default`, never hardcode
- **Avoid `process.env`**: Use config object for environment values
- **E2E config**: Use `outputs.json` and `.e2e/` config files

### Best Practices

- ✅ **Single source of truth**: Use actual config in tests
- ✅ **Fast tests**: Unit tests should run in milliseconds
- ✅ **Isolated tests**: No shared state between tests
- ✅ **Clear assertions**: One logical assertion per test
- ✅ **Descriptive names**: Test names explain what is being tested
- ✅ **No LocalStack**: Use DynamoDB Local for integration tests

## CI (Alignment)

Follow [CICD Guide](../../../../docs/guides/design-and-development/cicd-guide-v2.md):

- On PRs: run unit, handler, and CDK template tests (+ lint, typecheck). Skip E2E unless explicitly enabled with secure inputs.
- On main/nightly: optionally run E2E against a stable environment, injecting tokens at runtime (never commit secrets).

---

## Running Tests

### All Tests

```bash
# Run all tests (unit + handler + CDK)
npm test

# Run with coverage
npm run test:coverage

# Watch mode (for TDD)
npm run test:watch
```

### Specific Test Files

```bash
# Run specific test file
npm test -- service-stack.test.ts

# Run tests matching pattern
npm test -- merchants

# Run only CDK tests
npm test -- test/lib/
```

### E2E Tests

```bash
# Prepare environment
# 1. Deploy to test environment
# 2. Get outputs.json from deployment
# 3. Create .e2e/ config files with tokens

# Run E2E tests
npm run test:e2e
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

---

## Story 001: Testing Implementation

**Tests implemented for Story 001 (Browse Providers by Waste Category)**:

### ✅ Configuration Tests

- Validates Faux-SQL database approach
- Validates Merchants table definition
- Validates GSI1 configuration

### ✅ Infrastructure Tests (CDK)

- DynamoDB Merchants table creation
- Partition key: `MerchantId`
- GSI1 for category queries (`GSI1PK`)
- Point-in-time recovery enabled
- Environment-based deletion protection
- CloudFormation outputs

### 🔄 In Progress

- Data access layer unit tests
- Handler unit tests with mocks
- Integration tests with DynamoDB Local

**See**: [Story 001 Implementation Log](../implementation/story-001-implementation-log.md)

---

## Advanced Topics

### Mutation Testing

Follow [Mutation Testing Guide](./mutation-testing.md) for testing test quality.

### Test Coverage

Follow [Test Coverage Guide](./test-coverage.md) for coverage targets and reporting.

### Performance Testing

Follow [Performance Testing Guide](./performance-testing-guide.md) for load and stress testing.

---

## Notes

- ✅ Add new tests close to the feature being developed
- ✅ Keep tests fast and deterministic
- ✅ Prefer clear, minimal assertions
- ✅ Test behaviors and contracts, not implementation details
- ✅ Use actual config as single source of truth
- ✅ Guard against regressions and drift
