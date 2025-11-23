# Unit Helpers Testing Guide

Guide for testing pure helper functions used by Lambda handlers and CDK constructs.

**Related**: [Adding Endpoints - Part 1: Lambda Handlers](../implementation/adding-endpoints-part-1-lambda-handlers.md)

---

## Overview

Helper tests verify **business logic and data transformations** in isolation:

- ✅ Fast execution (no I/O)
- ✅ Deterministic results
- ✅ Easy to debug
- ✅ High coverage

**Test pure functions**: No network calls, no AWS SDK, no side effects.

---

## Test Location

### Endpoint Helpers

**File**: `test/lib/api/endpoints/[resource]/[sub-resource]/.../[method]/helpers.test.ts`

**Example**: `test/lib/api/endpoints/merchants/well-known/bindings/get/helpers.test.ts`

### Service Helpers

**File**: `test/src/helpers/[helper-name].test.ts`

**Examples**:

- `test/src/helpers/api.test.ts` - API response helpers
- `test/src/helpers/config.test.ts` - CDK config helpers
- `test/src/helpers/ssm.test.ts` - SSM helpers

**Structure**:

```
test/
├── lib/
│   └── api/
│       └── endpoints/
│           └── merchants/
│               └── get/
│                   ├── helpers.test.ts      # Endpoint helpers
│                   ├── handler.test.ts      # Handler orchestration
│                   └── payload.schema.test.ts
└── src/
    └── helpers/
        ├── api.test.ts                      # Service helpers
        ├── config.test.ts
        └── ssm.test.ts
```

---

## What to Test

### Input Parsing & Validation

- ✅ Valid input parsed correctly
- ✅ Invalid input returns error
- ✅ Missing fields handled
- ✅ Type coercions applied

### Data Transformations

- ✅ Data normalized (trim, lowercase, etc.)
- ✅ Data mapped to correct format
- ✅ DynamoDB items transformed to domain objects
- ✅ Domain objects transformed to DynamoDB items

### Business Logic

- ✅ Business rules enforced
- ✅ Calculations correct
- ✅ Edge cases handled
- ✅ Error conditions detected

### Environment Handling

- ✅ Required env vars validated
- ✅ Missing env vars return error
- ✅ Default values applied

---

## Test Patterns

### Pattern 1: Input Parsing

```typescript
import { describe, it, expect } from "@jest/globals";
import { parseAndValidateQueryParams } from "#lib/api/endpoints/merchants/get/helpers";

describe("parseAndValidateQueryParams", () => {
  it("should parse valid query parameters", () => {
    const event = {
      queryStringParameters: {
        category: "plastic",
        limit: "25",
      },
    } as any;

    const result = parseAndValidateQueryParams(event);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.category).toBe("plastic");
      expect(result.data.limit).toBe(25);
    }
  });

  it("should return error for missing category", () => {
    const event = {
      queryStringParameters: {},
    } as any;

    const result = parseAndValidateQueryParams(event);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.statusCode).toBe(400);
      const body = JSON.parse(result.response.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
```

### Pattern 2: Data Transformation

```typescript
import { transformDynamoDBItemToMerchant } from "#lib/api/endpoints/merchants/get/helpers";

describe("transformDynamoDBItemToMerchant", () => {
  it("should transform DynamoDB item to Merchant", () => {
    const item = {
      MerchantId: "merchant_123",
      BusinessName: "Green Recycling Co",
      Email: "contact@greenrecycling.com",
      Category: "plastic",
      CreatedAt: "2024-01-01T00:00:00Z",
    };

    const merchant = transformDynamoDBItemToMerchant(item);

    expect(merchant.merchantId).toBe("merchant_123");
    expect(merchant.businessName).toBe("Green Recycling Co");
    expect(merchant.email).toBe("contact@greenrecycling.com");
    expect(merchant.category).toBe("plastic");
    expect(merchant.createdAt).toBe("2024-01-01T00:00:00Z");
  });

  it("should handle optional fields", () => {
    const item = {
      MerchantId: "merchant_123",
      BusinessName: "Green Recycling Co",
      Email: "contact@greenrecycling.com",
      Category: "plastic",
      CreatedAt: "2024-01-01T00:00:00Z",
      // PhoneNumber is optional
    };

    const merchant = transformDynamoDBItemToMerchant(item);

    expect(merchant.phoneNumber).toBeUndefined();
  });
});
```

### Pattern 3: Business Logic

```typescript
import { validateMerchantData } from "#lib/api/endpoints/merchants/post/helpers";

describe("validateMerchantData", () => {
  it("should validate correct merchant data", () => {
    const data = {
      businessName: "Green Recycling Co",
      email: "contact@greenrecycling.com",
      category: "plastic",
    };

    expect(() => validateMerchantData(data)).not.toThrow();
  });

  it("should throw for duplicate email", () => {
    const data = {
      businessName: "Green Recycling Co",
      email: "duplicate@example.com",
      category: "plastic",
    };

    expect(() => validateMerchantData(data)).toThrow(
      "Email already registered"
    );
  });

  it("should throw for invalid category", () => {
    const data = {
      businessName: "Green Recycling Co",
      email: "contact@greenrecycling.com",
      category: "invalid",
    };

    expect(() => validateMerchantData(data)).toThrow("Invalid category");
  });
});
```

### Pattern 4: Environment Handling

```typescript
import { getRequiredEnv } from "#lib/api/endpoints/merchants/get/helpers";

describe("getRequiredEnv", () => {
  beforeEach(() => {
    delete process.env.TABLE_NAME;
  });

  it("should return table name when set", () => {
    process.env.TABLE_NAME = "merchants-table";

    const result = getRequiredEnv();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tableName).toBe("merchants-table");
    }
  });

  it("should return error when TABLE_NAME missing", () => {
    const result = getRequiredEnv();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.statusCode).toBe(500);
      const body = JSON.parse(result.response.body);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    }
  });
});
```

---

## Example: Complete Helper Test

```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  parseAndValidateQueryParams,
  transformDynamoDBItemToMerchant,
  buildPaginationResponse,
} from "#lib/api/endpoints/merchants/get/helpers";

describe("GET /merchants - Helpers", () => {
  describe("parseAndValidateQueryParams", () => {
    it("should parse valid parameters", () => {
      const event = {
        queryStringParameters: {
          category: "plastic",
          limit: "50",
        },
      } as any;

      const result = parseAndValidateQueryParams(event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.category).toBe("plastic");
        expect(result.data.limit).toBe(50);
      }
    });

    it("should use default limit", () => {
      const event = {
        queryStringParameters: { category: "plastic" },
      } as any;

      const result = parseAndValidateQueryParams(event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.limit).toBe(50);
      }
    });

    it("should return error for missing category", () => {
      const event = {
        queryStringParameters: {},
      } as any;

      const result = parseAndValidateQueryParams(event);

      expect(result.ok).toBe(false);
    });
  });

  describe("transformDynamoDBItemToMerchant", () => {
    it("should transform complete item", () => {
      const item = {
        MerchantId: "merchant_123",
        BusinessName: "Green Recycling Co",
        Email: "contact@greenrecycling.com",
        Category: "plastic",
        CreatedAt: "2024-01-01T00:00:00Z",
      };

      const merchant = transformDynamoDBItemToMerchant(item);

      expect(merchant.merchantId).toBe("merchant_123");
      expect(merchant.businessName).toBe("Green Recycling Co");
    });
  });

  describe("buildPaginationResponse", () => {
    it("should build response with pagination", () => {
      const merchants = [
        { merchantId: "1", businessName: "Test 1" },
        { merchantId: "2", businessName: "Test 2" },
      ];

      const response = buildPaginationResponse(merchants, "merchant_2", true);

      expect(response.merchants).toHaveLength(2);
      expect(response.pagination.lastEvaluatedKey).toBe("merchant_2");
      expect(response.pagination.hasMore).toBe(true);
    });

    it("should build response without pagination", () => {
      const merchants = [{ merchantId: "1", businessName: "Test 1" }];

      const response = buildPaginationResponse(merchants, undefined, false);

      expect(response.merchants).toHaveLength(1);
      expect(response.pagination.lastEvaluatedKey).toBeUndefined();
      expect(response.pagination.hasMore).toBe(false);
    });
  });
});
```

---

## Best Practices

### 1. Test Pure Functions

✅ **Good** - Pure function:

```typescript
function transformData(input: string): string {
  return input.trim().toLowerCase();
}
```

❌ **Bad** - Side effects:

```typescript
function transformData(input: string): string {
  console.log("Transforming:", input); // Side effect!
  return input.trim().toLowerCase();
}
```

### 2. Test Edge Cases

```typescript
it("should handle empty string", () => {
  expect(transform("")).toBe("");
});

it("should handle whitespace only", () => {
  expect(transform("   ")).toBe("");
});

it("should handle null", () => {
  expect(() => transform(null)).toThrow();
});
```

### 3. Use Descriptive Test Names

✅ **Good**:

```typescript
it("should trim whitespace and convert to lowercase", () => {});
```

❌ **Bad**:

```typescript
it("test 1", () => {});
```

### 4. Test One Thing Per Test

✅ **Good**:

```typescript
it("should trim whitespace", () => {
  expect(transform("  test  ")).toBe("test");
});

it("should convert to lowercase", () => {
  expect(transform("TEST")).toBe("test");
});
```

❌ **Bad**:

```typescript
it("should transform correctly", () => {
  expect(transform("  TEST  ")).toBe("test");
  expect(transform("test")).toBe("test");
  expect(transform("")).toBe("");
  // Too many assertions!
});
```

### 5. Avoid Testing Implementation Details

✅ **Good** - Test behavior:

```typescript
it("should return merchant with correct fields", () => {
  const merchant = transform(item);
  expect(merchant.merchantId).toBe("merchant_123");
});
```

❌ **Bad** - Test implementation:

```typescript
it("should call Object.keys", () => {
  const spy = jest.spyOn(Object, "keys");
  transform(item);
  expect(spy).toHaveBeenCalled();
});
```

---

## Running Tests

```bash
# All tests
npm test

# Helper tests only
npm test -- helpers.test.ts

# Specific helper test
npm test -- merchants/get/helpers.test.ts

# With coverage
npm run test:coverage
```

---

## Related Guides

- [Adding Endpoints - Part 1: Lambda Handlers](../implementation/adding-endpoints-part-1-lambda-handlers.md)
- [Handler Testing Guide](./handler-testing-guide.md)
- [Schema Testing Guide](./schema-testing-guide.md)
- [Testing Strategy](./testing-strategy.md)
