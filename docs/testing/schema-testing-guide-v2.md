# Schema Testing Guide: Zod Validation

Guide for testing request/response validation schemas using Zod.

**Related**: [Adding Endpoints - Part 1: Lambda Handlers](../implementation/adding-endpoints-part-1-lambda-handlers.md)

---

## Overview

Schema tests ensure payload validation works correctly:

- ✅ Valid payloads pass validation
- ✅ Invalid payloads fail with correct errors
- ✅ Type coercions work as expected
- ✅ Custom refinements behave correctly

---

## Test Location

**File**: `test/lib/api/endpoints/[resource]/[sub-resource]/.../[method]/payload.schema.test.ts`

**Example**: `test/lib/api/endpoints/merchants/well-known/bindings/get/payload.schema.test.ts`

**Structure**:

```
test/
└── lib/
    └── api/
        └── endpoints/
            └── merchants/
                └── get/
                    ├── payload.schema.test.ts  # Schema validation tests
                    ├── helpers.test.ts         # Business logic tests
                    └── handler.test.ts         # Handler orchestration tests
```

---

## What to Test

### Valid Payloads (Happy Path)

- ✅ Valid payload passes `.safeParse()`
- ✅ Type coercions applied correctly
- ✅ Optional fields handled
- ✅ Default values set

### Invalid Payloads (Validation Errors)

- ✅ Missing required fields
- ✅ Invalid types
- ✅ Invalid values (e.g., empty strings)
- ✅ Enum violations
- ✅ Custom refinement failures
- ✅ Error messages correct

---

## Test Patterns

### Pattern 1: Valid Payload

```typescript
import { describe, it, expect } from "@jest/globals";
import { queryParamsSchema } from "#lib/api/endpoints/merchants/get/payload.schema";

describe("GET /merchants - Query Params Schema", () => {
  it("should validate valid query parameters", () => {
    const result = queryParamsSchema.safeParse({
      category: "plastic",
      limit: "25",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("plastic");
      expect(result.data.limit).toBe(25); // Coerced to number
    }
  });
});
```

### Pattern 2: Type Coercion

```typescript
it("should coerce string limit to number", () => {
  const result = queryParamsSchema.safeParse({
    category: "plastic",
    limit: "50", // String
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(typeof result.data.limit).toBe("number");
    expect(result.data.limit).toBe(50);
  }
});
```

### Pattern 3: Missing Required Fields

```typescript
it("should fail for missing category", () => {
  const result = queryParamsSchema.safeParse({
    limit: "25",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    const errors = result.error.flatten();
    expect(errors.fieldErrors.category).toBeDefined();
  }
});
```

### Pattern 4: Invalid Values

```typescript
it("should fail for invalid category", () => {
  const result = queryParamsSchema.safeParse({
    category: "invalid-category",
    limit: "25",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    const errors = result.error.flatten();
    expect(errors.fieldErrors.category).toContain(
      "Invalid category. Must be one of: plastic, metal, glass, paper"
    );
  }
});
```

### Pattern 5: Custom Refinements

```typescript
it("should fail for limit exceeding maximum", () => {
  const result = queryParamsSchema.safeParse({
    category: "plastic",
    limit: "200", // Exceeds max of 100
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    const errors = result.error.flatten();
    expect(errors.fieldErrors.limit).toContain(
      "Limit must be between 1 and 100"
    );
  }
});
```

---

## Example: Complete Schema Test

```typescript
import { describe, it, expect } from "@jest/globals";
import {
  queryParamsSchema,
  type IGetMerchantsQueryParams,
} from "#lib/api/endpoints/merchants/get/payload.schema";

describe("GET /merchants - Query Params Schema", () => {
  describe("Valid Payloads", () => {
    it("should validate with all fields", () => {
      const result = queryParamsSchema.safeParse({
        category: "plastic",
        limit: "50",
        lastEvaluatedKey: "merchant_123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe("plastic");
        expect(result.data.limit).toBe(50);
        expect(result.data.lastEvaluatedKey).toBe("merchant_123");
      }
    });

    it("should use default limit when not provided", () => {
      const result = queryParamsSchema.safeParse({
        category: "plastic",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50); // Default
      }
    });

    it("should handle optional lastEvaluatedKey", () => {
      const result = queryParamsSchema.safeParse({
        category: "plastic",
        limit: "25",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lastEvaluatedKey).toBeUndefined();
      }
    });
  });

  describe("Type Coercion", () => {
    it("should coerce string limit to number", () => {
      const result = queryParamsSchema.safeParse({
        category: "plastic",
        limit: "25",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.limit).toBe("number");
        expect(result.data.limit).toBe(25);
      }
    });
  });

  describe("Validation Errors", () => {
    it("should fail for missing category", () => {
      const result = queryParamsSchema.safeParse({
        limit: "25",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten();
        expect(errors.fieldErrors.category).toBeDefined();
      }
    });

    it("should fail for invalid category", () => {
      const result = queryParamsSchema.safeParse({
        category: "invalid",
        limit: "25",
      });

      expect(result.success).toBe(false);
    });

    it("should fail for negative limit", () => {
      const result = queryParamsSchema.safeParse({
        category: "plastic",
        limit: "-10",
      });

      expect(result.success).toBe(false);
    });

    it("should fail for limit exceeding maximum", () => {
      const result = queryParamsSchema.safeParse({
        category: "plastic",
        limit: "200",
      });

      expect(result.success).toBe(false);
    });
  });
});
```

---

## Best Practices

### 1. Use safeParse

✅ **Good**:

```typescript
const result = schema.safeParse(data);
expect(result.success).toBe(true);
```

❌ **Bad**:

```typescript
const data = schema.parse(data); // Throws on error!
```

### 2. Test Type Coercions

```typescript
it("should coerce string to number", () => {
  const result = schema.safeParse({ limit: "25" });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(typeof result.data.limit).toBe("number");
  }
});
```

### 3. Test Error Messages

```typescript
it("should provide clear error message", () => {
  const result = schema.safeParse({ category: "invalid" });
  expect(result.success).toBe(false);
  if (!result.success) {
    const errors = result.error.flatten();
    expect(errors.fieldErrors.category).toContain("Invalid category");
  }
});
```

### 4. Test Edge Cases

```typescript
it("should handle empty string", () => {
  const result = schema.safeParse({ category: "" });
  expect(result.success).toBe(false);
});

it("should handle null", () => {
  const result = schema.safeParse({ category: null });
  expect(result.success).toBe(false);
});

it("should handle undefined", () => {
  const result = schema.safeParse({ category: undefined });
  expect(result.success).toBe(false);
});
```

---

## Running Tests

```bash
# All tests
npm test

# Schema tests only
npm test -- payload.schema.test.ts

# Specific schema test
npm test -- merchants/get/payload.schema.test.ts

# With coverage
npm run test:coverage
```

---

## Related Guides

- [Adding Endpoints - Part 1: Lambda Handlers](../implementation/adding-endpoints-part-1-lambda-handlers.md)
- [Handler Testing Guide](./handler-testing-guide.md)
- [Unit Helpers Testing Guide](./unit-helpers-testing-guide.md)
- [Testing Strategy](./testing-strategy.md)
