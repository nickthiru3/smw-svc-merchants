# Adding API Endpoints - Part 1: Lambda Handlers

**Guide**: How to implement Lambda handler business logic

**Part**: 1 of 2 (Lambda Handlers → [Part 2: API Gateway Integration](./adding-endpoints-part-2-api-gateway.md))

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Story Artifacts](#3-story-artifacts)
4. [Implementation Steps](#4-implementation-steps)
   - 4.1. [Review Story Artifacts](#41-review-story-artifacts)
   - 4.2. [Create Handler Directory Structure](#42-create-handler-directory-structure)
   - 4.3. [Define TypeScript Types](#43-define-typescript-types)
   - 4.4. [Implement Handler Orchestration](#44-implement-handler-orchestration)
   - 4.5. [Implement Business Logic (Helpers)](#45-implement-business-logic-helpers)
   - 4.6. [Add Runtime Validation (Zod Schemas)](#46-add-runtime-validation-zod-schemas)
5. [Testing](#5-testing)
6. [Verification](#6-verification)
7. [Next Steps](#7-next-steps)

---

## 1. Overview

This guide covers implementing Lambda handler business logic for API endpoints. The handler layer sits between API Gateway and your data access layer, orchestrating business workflows.

**Handler Architecture (3 Layers)**:

```
Layer 1: handler.ts (Orchestration)
  ↓
Layer 2: helpers.ts (Business Logic)
  ↓
Layer 3: Data Access / AWS SDK
```

**What This Guide Covers**:

- Handler file structure and organization
- Business logic implementation patterns
- Request/response validation
- Error handling
- Testing handlers in isolation

**What This Guide Does NOT Cover**:

- API Gateway integration (see [Part 2](./adding-endpoints-part-2-api-gateway.md))
- Data access layer (see [Data Access Guide](./data-access.md))
- CDK infrastructure (see [Part 2](./adding-endpoints-part-2-api-gateway.md))

---

## 2. Prerequisites

Before implementing Lambda handlers, ensure you have:

- ✅ **Data access layer implemented** - See [Data Access Guide](./data-access.md)
- ✅ **Story artifacts completed** - See [Story Artifacts](#3-story-artifacts) below
- ✅ **Understanding of handler patterns** - Review existing handlers in `lib/api/endpoints/`

---

## 3. Story Artifacts

Lambda handler implementation requires these Phase 3 artifacts:

### 3.1. Actions & Queries

**Location**: `docs/project/specs/stories/[actor]/[story]/actions-queries.md`

**What to Review**:

- **Queries section** - For read operations (GET endpoints)
- **Actions section** - For write operations (POST/PUT/DELETE endpoints)
- **Inputs** - Request parameters, body structure, validation rules
- **Expected Output** - Response structure and data transformations
- **Error Cases** - Error scenarios and error messages

**Example**:

```markdown
## Query: Get Merchants by Category

**Input**:

- category (string, required) - Waste category to filter by
- limit (number, optional) - Max results (default: 50)

**Expected Output**:
{
"merchants": [...],
"pagination": { "hasMore": boolean }
}

**Error Cases**:

- Invalid category → 400 VALIDATION_ERROR
- Database error → 500 INTERNAL_ERROR
```

### 3.2. Story Card

**Location**: `docs/project/specs/stories/[actor]/[story]/story-card-[number].md`

**What to Review**:

- **Business Rules** - Validation logic, constraints, business invariants
- **Implementation Notes** - Special considerations, edge cases
- **Assumptions** - Documented assumptions about behavior

**Example**:

```markdown
## Business Rules

1. Category must be one of: plastic, metal, glass, organic, electronic
2. Merchant status must be 'active' to appear in results
3. Results sorted by distance (client-side, not in query)
```

### 3.3. Entity File

**Location**: `docs/project/specs/entities/[entity].md`

**What to Review**:

- **Attribute Definitions** - For TypeScript interface creation
- **Validation Rules** - For request/response validation

---

## 4. Implementation Steps

### 4.1. Review Story Artifacts

**Action**: Read the story artifacts listed in [Section 3](#3-story-artifacts)

**Focus On**:

1. **Inputs** - What data does the handler receive?
2. **Outputs** - What data does the handler return?
3. **Business Rules** - What validation/logic is required?
4. **Error Cases** - What errors need handling?

**Example**: For "Get Merchants by Category":

- Input: `category` query parameter
- Output: List of merchants + pagination
- Business Rule: Only return active merchants
- Errors: Invalid category, database errors

---

### 4.2. Create Handler Directory Structure

**Location**: `lib/api/endpoints/[resource]/[sub-resource]/.../[method]/`

**Files to Create**:

```
lib/api/endpoints/[resource]/[sub-resource]/.../[method]/
├── handler.ts          # Layer 1: Orchestration
├── helpers.ts          # Layer 2: Business logic
├── types.ts            # TypeScript interfaces
├── payload.schema.ts   # Zod schemas for runtime validation
├── api.schema.ts       # API Gateway JSON schema (Part 2)
└── construct.ts        # CDK construct (Part 2)
```

**Example**: For `GET /merchants/well-known/bindings`:

```
lib/api/endpoints/merchants/well-known/bindings/get/
├── handler.ts
├── helpers.ts
├── types.ts
├── payload.schema.ts
├── api.schema.ts       # (Part 2)
└── construct.ts        # (Part 2)
```

**Naming Conventions**:

- Resource: Plural noun (`users`, `merchants`, `reviews`)
- Method: HTTP method in lowercase (`get`, `post`, `put`, `delete`, `patch`)

---

### 4.3. Define TypeScript Types

**File**: `types.ts`

**Purpose**: Define TypeScript interfaces for domain entities and handler-specific types

**Pattern**:

```typescript
/**
 * Domain entity (application-level)
 * Matches the data model from entity specification
 */
export interface IMerchant {
  readonly merchantId: string;
  readonly businessName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: IAddress;
  readonly wasteCategories: string[];
  readonly status: "active" | "inactive" | "suspended";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IAddress {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

/**
 * Handler-specific types
 */
export interface IGetMerchantsQueryParams {
  readonly category: string;
  readonly limit?: number;
}

export interface IGetMerchantsResponse {
  readonly merchants: IMerchant[];
  readonly pagination: {
    readonly hasMore: boolean;
    readonly nextToken?: string;
  };
}
```

**Guidelines**:

- Use `readonly` for all properties
- Interface names prefixed with `I`
- Domain entities match entity specification
- Handler types specific to this endpoint

---

### 4.4. Implement Handler Orchestration

**File**: `handler.ts`

**Purpose**: High-level orchestration of the business flow

**Pattern**:

```typescript
/**
 * GET /merchants Handler
 *
 * Query merchants by waste category
 *
 * Layer 1 (This file): Business flow orchestration
 * - Coordinates the query process
 * - Validates input
 * - Handles top-level error catching
 * - Returns formatted response
 *
 * Layer 2 (helpers.ts): Business logic
 * - Query execution
 * - Data transformations
 * - Response formatting
 *
 * Layer 3 (Data Access): Infrastructure
 * - DynamoDB queries
 */

import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { apiError } from "#src/helpers/api";
import type { TApiResponse } from "#src/helpers/api";
import {
  parseAndValidateQueryParams,
  getRequiredEnv,
  queryMerchantsByCategory,
  prepareSuccessResponse,
  prepareErrorResponse,
  logEventReceived,
  logError,
} from "./helpers";

/**
 * Handler for GET /merchants
 *
 * Flow:
 * 1. Validate query parameters
 * 2. Get environment variables (from process.env, provided via Lambda CDK construct)
 * 3. Query merchants by category
 * 4. Format and return response
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<TApiResponse> => {
  logEventReceived(event);

  // Parse + validate query params
  const paramsResult = parseAndValidateQueryParams(event);
  if (!paramsResult.ok) return paramsResult.response;
  const { category, limit } = paramsResult.data;

  // Env asserts (lightweight)
  const envResult = getRequiredEnv();
  if (!envResult.ok) return envResult.response;
  const { tableName } = envResult.data;

  try {
    // Query merchants
    const result = await queryMerchantsByCategory(tableName, category, limit);

    // Return success response
    return prepareSuccessResponse(result);
  } catch (error) {
    logError(error);
    return prepareErrorResponse(error);
  }
};
```

**Guidelines**:

- Keep handler thin - delegate to helpers
- Use early returns for validation errors
- Catch all errors at top level
- Log events and errors (see [Logging Best Practices](#logging-best-practices) below)
- Return typed responses

#### Logging Best Practices

**What to Log**:

✅ **DO Log**:

- **Request metadata** (not full bodies in production)
  - Request ID: `event.requestContext.requestId`
  - User ID: `event.requestContext.authorizer?.claims?.sub`
  - HTTP method and path
  - Query parameters (sanitized)
- **Business events** (state changes)
  - "Merchant created", "User approved", "Order placed"
- **Errors with context**
  - Error type, message, stack trace
  - Request ID, user ID, input parameters
- **Performance metrics**
  - Database query times, external API latency

❌ **DON'T Log**:

- **Sensitive data**: Passwords, tokens, credit cards, PII
- **Full request/response bodies** in production (too verbose, potential PII)
- **Debug noise** in production (use log levels)

**Logging Pattern**:

```typescript
// Good: Structured logging with context
console.log(
  JSON.stringify({
    level: "INFO",
    message: "Query executed successfully",
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer?.claims?.sub,
    category: category,
    resultCount: result.merchants.length,
    duration: Date.now() - startTime,
  })
);

// Bad: Unstructured logging
console.log("Query done, got results");
```

**Error Logging Pattern**:

```typescript
// Good: Error with context
console.error(
  JSON.stringify({
    level: "ERROR",
    message: "Failed to query merchants",
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer?.claims?.sub,
    category: category,
  })
);

// Bad: Just the error
console.error(error);
```

**Where Logs Go**:

- All `console.log()` and `console.error()` automatically go to **CloudWatch Logs**
- Log group: `/aws/lambda/<function-name>`
- Retention: Configured in CDK (default: 30 days)

**Monitoring & Alerts**:

- CloudWatch Alarms monitor error rates (configured in `MonitorConstruct`)
- Alarms trigger SNS notifications for critical errors
- See [Monitoring Guide](./monitoring.md) for alarm configuration

---

### 4.5. Implement Business Logic (Helpers)

**File**: `helpers.ts`

**Purpose**: Business logic, AWS service interactions, data transformations

**Pattern**:

```typescript
/**
 * Business logic and helper functions for GET /merchants
 *
 * Layer 2: Business logic and transformations
 * - Input validation
 * - AWS service interactions
 * - Data transformations
 * - Response formatting
 */

import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { apiError, apiSuccess } from "#src/helpers/api";
import type { TApiResponse } from "#src/helpers/api";
import type { IGetMerchantsQueryParams, IGetMerchantsResponse } from "./types";
import { queryParamsSchema } from "./payload.schema";

/**
 * Parse and validate query parameters
 */
export function parseAndValidateQueryParams(
  event: APIGatewayProxyEvent
):
  | { ok: true; data: IGetMerchantsQueryParams }
  | { ok: false; response: TApiResponse } {
  try {
    const params = queryParamsSchema.parse(event.queryStringParameters);
    return { ok: true, data: params };
  } catch (error) {
    return {
      ok: false,
      response: apiError(
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        error
      ),
    };
  }
}

/**
 * Get required environment variables
 */
export function getRequiredEnv():
  | { ok: true; data: { tableName: string } }
  | { ok: false; response: TApiResponse } {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    return {
      ok: false,
      response: apiError(500, "CONFIG_ERROR", "TABLE_NAME not configured"),
    };
  }

  return { ok: true, data: { tableName } };
}

/**
 * Query merchants by category from DynamoDB
 */
export async function queryMerchantsByCategory(
  tableName: string,
  category: string,
  limit: number = 50
): Promise<IGetMerchantsResponse> {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :category",
      ExpressionAttributeValues: {
        ":category": `CATEGORY#${category}`,
      },
      Limit: limit,
    })
  );

  const merchants = (result.Items || []).map(transformDynamoDBItemToMerchant);

  return {
    merchants,
    pagination: {
      hasMore: !!result.LastEvaluatedKey,
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
            "base64"
          )
        : undefined,
    },
  };
}

/**
 * Transform DynamoDB item to Merchant domain entity
 */
function transformDynamoDBItemToMerchant(item: any): IMerchant {
  return {
    merchantId: item.MerchantId,
    businessName: item.BusinessName,
    email: item.Email,
    phone: item.Phone,
    address: {
      street: item.Address.Street,
      city: item.Address.City,
      state: item.Address.State,
      zipCode: item.Address.ZipCode,
      country: item.Address.Country,
    },
    wasteCategories: item.WasteCategories,
    status: item.Status,
    createdAt: item.CreatedAt,
    updatedAt: item.UpdatedAt,
  };
}

/**
 * Prepare success response
 */
export function prepareSuccessResponse(
  data: IGetMerchantsResponse
): TApiResponse {
  return apiSuccess(200, data);
}

/**
 * Prepare error response
 */
export function prepareErrorResponse(error: unknown): TApiResponse {
  console.error("Error in GET /merchants:", error);
  return apiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
}

/**
 * Log event received
 */
export function logEventReceived(event: APIGatewayProxyEvent): void {
  console.log("Event received:", JSON.stringify(event, null, 2));
}

/**
 * Log error
 */
export function logError(error: unknown): void {
  console.error("Error:", error);
}
```

**Guidelines**:

- One function per responsibility
- Export all functions for testing
- Use descriptive function names
- Document each function
- Handle errors gracefully
- Use data access layer (don't inline DynamoDB calls in production)

---

### 4.6. Add Runtime Validation (Zod Schemas)

**File**: `payload.schema.ts`

**Purpose**: Runtime validation of request data using Zod

**Pattern**:

```typescript
/**
 * Zod schemas for runtime validation
 *
 * These schemas validate request data at runtime (in Lambda).
 * Separate from API Gateway JSON schemas (api.schema.ts).
 */

import { z } from "zod";

/**
 * Query parameters schema
 */
export const queryParamsSchema = z.object({
  category: z.string().min(1, "Category is required"),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

/**
 * Infer TypeScript type from schema
 */
export type TQueryParams = z.infer<typeof queryParamsSchema>;
```

**Guidelines**:

- Use Zod for runtime validation
- Validate all inputs (query params, body, headers)
- Provide clear error messages
- Use `.coerce` for type conversion
- Export inferred types

---

## 5. Testing

Test your Lambda handlers at two levels: **unit tests** for helpers and **integration tests** for the handler.

### 5.1. What to Test

**Helper Functions**:

- ✅ Input parsing and validation
- ✅ Data transformations
- ✅ Business logic
- ✅ Error handling

**Handler Orchestration**:

- ✅ Request parsing
- ✅ Helper function calls
- ✅ AWS SDK interactions (mocked)
- ✅ Response formatting
- ✅ Error scenarios (400, 500, etc.)

### 5.2. Quick Example

**Unit Test Pattern** (`helpers.test.ts`):

```typescript
import { describe, it, expect, jest } from "@jest/globals";
import {
  parseAndValidateQueryParams,
  queryMerchantsByCategory,
  transformDynamoDBItemToMerchant,
} from "#lib/api/endpoints/merchants/get/helpers";

describe("GET /merchants - Helpers", () => {
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
      }
    });
  });

  // ... more helper tests
});
```

**Handler Test Pattern** (`handler.test.ts`):

```typescript
import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "#lib/api/endpoints/merchants/get/handler";
import type { APIGatewayProxyEvent } from "aws-lambda";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("GET /merchants Handler", () => {
  beforeAll(() => {
    process.env.TABLE_NAME = "test-merchants-table";
  });

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should return merchants for valid category", async () => {
    // Mock DynamoDB response
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          MerchantId: "merchant_123",
          BusinessName: "Green Recycling Co",
          Email: "contact@greenrecycling.com",
          // ... other fields
        },
      ],
    });

    // Create event
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        category: "plastic",
      },
      requestContext: {
        requestId: "test-request-id",
      } as any,
    };

    // Call handler
    const response = await handler(event as APIGatewayProxyEvent, {} as any);

    // Assertions
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.merchants).toHaveLength(1);
    expect(body.merchants[0].businessName).toBe("Green Recycling Co");
    expect(body.pagination.hasMore).toBe(false);
  });

  it("should return 400 for missing category parameter", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: null,
      requestContext: {
        requestId: "test-request-id",
      } as any,
    };

    const response = await handler(event as APIGatewayProxyEvent, {} as any);

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 500 for unexpected errors", async () => {
    ddbMock.on(QueryCommand).rejects(new Error("Database connection failed"));

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        category: "plastic",
      },
      requestContext: {
        requestId: "test-request-id",
      } as any,
    };

    const response = await handler(event as APIGatewayProxyEvent, {} as any);

    expect(response.statusCode).toBe(500);
  });

  // ... more handler tests
});
```

### 5.3. Detailed Testing Guides

For comprehensive testing guidance, see:

- **[Handler Testing Guide](../../testing/handler-testing-guide.md)** - Detailed Lambda handler testing patterns with AWS SDK mocking
- **[Unit Helpers Testing Guide](../../testing/unit-helpers-testing-guide.md)** - Testing helper functions and utilities
- **[Schema Testing Guide](../../testing/schema-testing-guide.md)** - Validation and schema testing patterns
- **[Testing Strategy](../../testing/testing-strategy.md)** - Overall testing approach and coverage targets

### 5.4. Quick Testing Checklist

Before proceeding to Part 2:

- [ ] **Helper tests pass** - `npm test -- helpers.test.ts`
- [ ] **Handler tests pass** - `npm test -- handler.test.ts`
- [ ] **Coverage > 80%** - `npm run test:coverage`
- [ ] **All scenarios covered** - Success, validation errors, business errors, 500 errors

---

## 6. Verification

**Command**: `npm test`

**Expected**:

- ✅ All helper unit tests pass
- ✅ All handler tests pass
- ✅ Code coverage > 80%

**Checklist**:

- [ ] Handler orchestrates flow correctly
- [ ] Helpers implement business logic
- [ ] Validation catches invalid inputs
- [ ] Error handling covers all cases
- [ ] Tests cover success and error paths
- [ ] TypeScript types are correct
- [ ] Code follows project patterns

---

## 7. Next Steps

After Lambda handler implementation and testing:

1. **Proceed to Part 2**: [API Gateway Integration](./adding-endpoints-part-2-api-gateway.md)
   - Create API Gateway JSON schema
   - Create CDK construct
   - Wire Lambda to API Gateway
   - Add CDK template tests

2. **Deploy and Test**: After Part 2 is complete
   - Deploy to dev environment
   - Test deployed endpoint
   - Run E2E tests (optional)

---

## Related Guides

- [Data Access Layer](./data-access.md) - Implement data access before handlers
- [Part 2: API Gateway Integration](./adding-endpoints-part-2-api-gateway.md) - Wire handlers to API Gateway
- [Handler Testing Guide](../testing/handler-testing-guide.md) - Detailed testing patterns
- [Schema Testing Guide](../testing/schema-testing-guide.md) - Validation testing
