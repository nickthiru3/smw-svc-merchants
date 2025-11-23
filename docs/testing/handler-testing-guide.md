# Handler Testing Guide: Lambda Behavior Tests

This guide explains how to test Lambda handlers' behavior (validation, orchestration, AWS I/O) while keeping tests fast and deterministic by mocking AWS SDK v3 and other dependencies.

**Related**: [Adding Endpoints - Part 1: Lambda Handlers](../implementation/adding-endpoints-part-1-lambda-handlers.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Test Location](#test-location)
3. [What to Test](#what-to-test)
4. [Mocking Strategy](#mocking-strategy)
5. [Test Patterns](#test-patterns)
6. [Example Tests](#example-tests)
7. [Best Practices](#best-practices)
8. [Running Tests](#running-tests)

---

## Overview

Handler tests verify the **orchestration layer** of your Lambda function:

- ✅ Request parsing and validation
- ✅ Helper function calls
- ✅ AWS SDK interactions (mocked)
- ✅ Response formatting
- ✅ Error handling (400, 404, 500, etc.)

**Do NOT test**:

- ❌ Business logic details (test in `helpers.test.ts`)
- ❌ AWS service behavior (mock the SDK)
- ❌ API Gateway integration (test in CDK construct tests)

---

## Test Location

**File**: `test/lib/api/endpoints/[resource]/[sub-resource]/.../[method]/handler.test.ts`

**Example**: `test/lib/api/endpoints/merchants/well-known/bindings/get/handler.test.ts`

**Structure**:

```
test/
└── lib/
    └── api/
        └── endpoints/
            └── merchants/
                └── get/
                    ├── handler.test.ts      # Handler orchestration tests
                    └── helpers.test.ts      # Business logic tests
```

## What to Test

### Success Cases (Happy Path)

- ✅ Valid request → successful response
- ✅ Correct status code (200, 201, etc.)
- ✅ Response body structure
- ✅ Helper functions called with correct arguments
- ✅ AWS SDK called with correct parameters

### Validation Errors (400)

- ✅ Missing required parameters
- ✅ Invalid parameter types
- ✅ Invalid parameter values (e.g., empty strings)
- ✅ Schema validation failures
- ✅ Error response format

### Environment Errors (500)

- ✅ Missing required environment variables (e.g., `TABLE_NAME`)
- ✅ Invalid environment variable values
- ✅ Error response format

### Business Logic Errors (400, 404, 409, etc.)

- ✅ Resource not found (404)
- ✅ Conflict errors (409)
- ✅ Business rule violations (400)
- ✅ Error response format

### AWS SDK Errors (500, 502)

- ✅ DynamoDB errors (throttling, conditional check failed)
- ✅ S3 errors
- ✅ Generic AWS errors
- ✅ Error response format

## Mocking Strategy

### AWS SDK v3 Mocking

**Use `aws-sdk-client-mock`** for clean, type-safe mocking:

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("GET /merchants Handler", () => {
  beforeEach(() => {
    ddbMock.reset(); // Reset mocks before each test
  });

  it("should return merchants", async () => {
    // Mock DynamoDB response
    ddbMock.on(QueryCommand).resolves({
      Items: [{ MerchantId: "merchant_123", BusinessName: "Test" }],
    });

    // Test handler
    const response = await handler(event, context);
    expect(response.statusCode).toBe(200);
  });
});
```

### Environment Variables

**Set in `beforeAll` or `beforeEach`**:

```typescript
beforeAll(() => {
  process.env.TABLE_NAME = "test-merchants-table";
  process.env.ENV_NAME = "test";
});

afterAll(() => {
  delete process.env.TABLE_NAME;
  delete process.env.ENV_NAME;
});
```

### Deterministic IDs

**Mock ID generation** for predictable tests:

```typescript
jest.mock("ksuid", () => ({
  __esModule: true,
  default: { randomSync: () => ({ string: "TEST_ID_123" }) },
}));
```

**Or use a helper**:

```typescript
jest.mock("#src/helpers/id", () => ({
  generateId: jest.fn(() => "TEST_ID_123"),
}));
```
