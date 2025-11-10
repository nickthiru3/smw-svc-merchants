# Testing Guide

**Guide**: Unit tests, integration tests, and testing strategies

---

## Overview

This guide covers testing patterns for Lambda handlers, data access layer, and CDK constructs.

**Prerequisites:**

- ✅ Jest testing framework basics
- ✅ Understanding of mocking and test doubles

---

## Testing Strategy

### Test Pyramid

```
        /\
       /  \  E2E (10%)
      /____\
     /      \
    / Integ. \ (30%)
   /__________\
  /            \
 /     Unit     \ (60%)
/________________\
```

### Test Types

1. **Unit Tests** - Test individual functions in isolation
2. **Integration Tests** - Test with real AWS SDK calls (DynamoDB Local)
3. **E2E Tests** - Test complete API flows (optional, done at app level)

---

## Unit Testing

_See [Data Access Layer](./data-access.md) and [Adding Endpoints](./adding-endpoints.md) for examples_

### Testing Data Access Layer

**Location**: `test/lib/data-access/`

**Pattern**:

- Use DynamoDB Local
- Test CRUD operations
- Test access patterns
- Test error handling

### Testing Lambda Handlers

**Location**: `test/handlers/`

**Pattern**:

- Mock data access layer
- Test validation logic
- Test response formatting
- Test error handling

---

## Integration Testing

_To be documented as we implement Story 001_

Topics to cover:

- Setting up DynamoDB Local
- Seeding test data
- Testing end-to-end flows
- Cleanup strategies

---

## CDK Testing

_To be documented as we implement Story 001_

Topics to cover:

- Snapshot tests for constructs
- Fine-grained assertions
- Testing stack synthesis

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- merchants.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Story 001 Notes

**Tests implemented for Story 001**:

- Data access layer unit tests
- Handler unit tests with mocks
- Integration tests with DynamoDB Local

**See**: [Story 001 Implementation Log](./story-001-implementation-log.md)
