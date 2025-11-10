# Adding API Endpoints

**Guide**: How to implement Lambda handlers and wire them to API Gateway

---

## Overview

This guide covers implementing API endpoints based on your OpenAPI specification from Phase 3 (API Design & Contracts).

**Prerequisites:**

- ✅ API specification at `docs/project/specs/stories/[story]/api.yml`
- ✅ Actions & Queries document (CQS separation)
- ✅ Data access layer implemented
- ✅ Sequence diagrams showing request/response flows

---

## Implementation Steps

### 1. Review API Specification

**Location**: `docs/project/specs/stories/[actor]/[story-name]/api.yml`

Your OpenAPI spec defines:

- Endpoint paths and HTTP methods
- Request/response schemas
- Authentication requirements
- Error responses

**Example**: For Story 001, review the `GET /merchants` endpoint specification.

---

### 2. Create Lambda Handler

**Location**: `src/handlers/[endpoint-name].ts`

#### 2.1. Handler Structure

```typescript
// src/handlers/get-merchants-by-category.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocumentClient } from "#src/lib/utils/dynamodb";
import { getMerchantsByCategory } from "#src/lib/data-access/merchants";
import { validateQueryParams } from "#src/lib/validation/query-params";
import {
  createSuccessResponse,
  createErrorResponse,
} from "#src/lib/utils/response";

/**
 * GET /merchants?category={category}
 *
 * Query merchants by waste category
 *
 * @param event - API Gateway event
 * @returns List of merchants matching the category
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // 1. Validate input
    const { category } = validateQueryParams(event.queryStringParameters, {
      category: { required: true, type: "string" },
    });

    // 2. Get DynamoDB client
    const client = getDocumentClient();

    // 3. Query data
    const result = await getMerchantsByCategory(client, category, {
      limit: 50, // Default limit
    });

    // 4. Transform response
    const response = {
      merchants: result.merchants,
      pagination: result.lastEvaluatedKey
        ? {
            hasMore: true,
            nextToken: Buffer.from(
              JSON.stringify(result.lastEvaluatedKey)
            ).toString("base64"),
          }
        : { hasMore: false },
    };

    // 5. Return success response
    return createSuccessResponse(200, response);
  } catch (error) {
    console.error("Error:", error);

    // Handle specific error types
    if (error instanceof ValidationError) {
      return createErrorResponse(400, "VALIDATION_ERROR", error.message);
    }

    // Generic error
    return createErrorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred"
    );
  }
}
```

#### 2.2. Input Validation

**Location**: `src/lib/validation/query-params.ts`

```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

interface ValidationRule {
  required?: boolean;
  type?: "string" | "number" | "boolean";
  pattern?: RegExp;
  min?: number;
  max?: number;
  enum?: string[];
}

/**
 * Validate query string parameters
 */
export function validateQueryParams<T extends Record<string, ValidationRule>>(
  params: Record<string, string> | null,
  rules: T
): Record<keyof T, any> {
  const validated: Record<string, any> = {};

  for (const [key, rule] of Object.entries(rules)) {
    const value = params?.[key];

    // Check required
    if (rule.required && !value) {
      throw new ValidationError(`Missing required parameter: ${key}`);
    }

    if (!value) {
      continue;
    }

    // Type validation
    if (rule.type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        throw new ValidationError(`Parameter ${key} must be a number`);
      }
      validated[key] = num;
    } else if (rule.type === "boolean") {
      if (value !== "true" && value !== "false") {
        throw new ValidationError(`Parameter ${key} must be true or false`);
      }
      validated[key] = value === "true";
    } else {
      validated[key] = value;
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(validated[key])) {
      throw new ValidationError(`Parameter ${key} has invalid format`);
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(validated[key])) {
      throw new ValidationError(
        `Parameter ${key} must be one of: ${rule.enum.join(", ")}`
      );
    }

    // Range validation
    if (rule.type === "number") {
      if (rule.min !== undefined && validated[key] < rule.min) {
        throw new ValidationError(
          `Parameter ${key} must be at least ${rule.min}`
        );
      }
      if (rule.max !== undefined && validated[key] > rule.max) {
        throw new ValidationError(
          `Parameter ${key} must be at most ${rule.max}`
        );
      }
    }
  }

  return validated as Record<keyof T, any>;
}
```

#### 2.3. Response Utilities

**Location**: `src/lib/utils/response.ts`

```typescript
import { APIGatewayProxyResult } from "aws-lambda";

/**
 * Create success response
 */
export function createSuccessResponse(
  statusCode: number,
  body: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Configure for your domain
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify({
      error: {
        code,
        message,
        ...(details && { details }),
      },
    }),
  };
}
```

---

### 3. Wire Handler to API Gateway

**Location**: `lib/api/construct.ts`

Update the API construct to add your endpoint:

```typescript
// lib/api/construct.ts
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";

// In the ApiConstruct class constructor:

// GET /merchants - Query merchants by category
const getMerchantsByCategoryFn = new NodejsFunction(
  this,
  "GetMerchantsByCategory",
  {
    runtime: Runtime.NODEJS_20_X,
    handler: "handler",
    entry: path.join(
      __dirname,
      "../../src/handlers/get-merchants-by-category.ts"
    ),
    environment: {
      TABLE_NAME: props.table.tableName,
      LOG_LEVEL: "INFO",
    },
    timeout: Duration.seconds(30),
    memorySize: 512,
  }
);

// Grant DynamoDB read permissions
props.table.grantReadData(getMerchantsByCategoryFn);

// Add to API Gateway
const merchants = api.root.addResource("merchants");
merchants.addMethod("GET", new LambdaIntegration(getMerchantsByCategoryFn), {
  authorizer: props.authorizer, // Cognito authorizer
  authorizationType: AuthorizationType.COGNITO,
});
```

---

### 4. Add Handler Tests

**Location**: `test/handlers/get-merchants-by-category.test.ts`

```typescript
import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "#src/handlers/get-merchants-by-category";
import * as merchantsDataAccess from "#src/lib/data-access/merchants";

// Mock data access layer
jest.mock("#src/lib/data-access/merchants");

describe("GET /merchants Handler", () => {
  beforeAll(() => {
    process.env.TABLE_NAME = "test-merchants-table";
  });

  it("should return merchants for valid category", async () => {
    // Mock data
    const mockMerchants = [
      {
        merchantId: "merchant_123",
        businessName: "Green Recycling Co",
        email: "contact@greenrecycling.com",
        phone: "+1-555-0123",
        address: {
          street: "123 Eco Street",
          city: "Portland",
          state: "OR",
          zipCode: "97201",
          country: "USA",
        },
        wasteCategories: ["plastic", "metal"],
        status: "active",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
      },
    ];

    jest
      .spyOn(merchantsDataAccess, "getMerchantsByCategory")
      .mockResolvedValue({
        merchants: mockMerchants,
        lastEvaluatedKey: undefined,
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
    const response = await handler(event as APIGatewayProxyEvent);

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

    const response = await handler(event as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("category");
  });

  it("should return 500 for unexpected errors", async () => {
    jest
      .spyOn(merchantsDataAccess, "getMerchantsByCategory")
      .mockRejectedValue(new Error("Database connection failed"));

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        category: "plastic",
      },
      requestContext: {
        requestId: "test-request-id",
      } as any,
    };

    const response = await handler(event as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
```

---

### 5. Add Integration Tests

**Location**: `test/integration/merchants-api.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";
import { createDynamoDBClient } from "#src/lib/utils/dynamodb";
import { createMerchant } from "#src/lib/data-access/merchants";
import { handler } from "#src/handlers/get-merchants-by-category";
import { MerchantStatus } from "#src/types/merchant";

describe("Merchants API Integration Tests", () => {
  let client: DynamoDBDocumentClient;

  beforeAll(async () => {
    // Set up DynamoDB Local
    process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";
    process.env.TABLE_NAME = "test-merchants-table";
    client = createDynamoDBClient();

    // Seed test data
    await createMerchant(client, {
      businessName: "Plastic Recycler",
      email: "plastic@example.com",
      phone: "+1-555-0125",
      address: {
        street: "789 Plastic Rd",
        city: "Denver",
        state: "CO",
        zipCode: "80201",
        country: "USA",
      },
      wasteCategories: ["plastic"],
      status: MerchantStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    // Cleanup test data
  });

  it("should retrieve merchants by category end-to-end", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        category: "plastic",
      },
      requestContext: {
        requestId: "integration-test-request",
      } as any,
    };

    const response = await handler(event as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.merchants.length).toBeGreaterThan(0);
    expect(body.merchants[0].wasteCategories).toContain("plastic");
  });
});
```

---

## Best Practices

### Handler Design

✅ **Keep handlers thin**

- Validation → Business logic → Response
- Move complex logic to `src/lib/`

✅ **Structured logging**

```typescript
console.log("Processing request", {
  requestId: event.requestContext.requestId,
  category: category,
  timestamp: new Date().toISOString(),
});
```

✅ **Error handling**

- Catch specific error types
- Return appropriate HTTP status codes
- Don't leak internal details in error messages

### Performance

✅ **Cold start optimization**

- Keep dependencies minimal
- Initialize clients outside handler
- Use Lambda layers for large dependencies

```typescript
// Initialize outside handler (reused across invocations)
const docClient = getDocumentClient();

export async function handler(event: APIGatewayProxyEvent) {
  // Use pre-initialized client
  const result = await getMerchantsByCategory(docClient, category);
  // ...
}
```

✅ **Timeout configuration**

- Set appropriate timeouts (default: 30s)
- Consider downstream service latencies
- Add timeout buffer for retries

### Security

✅ **Input validation**

- Validate all inputs at handler entry
- Use allow-lists, not deny-lists
- Sanitize inputs before database queries

✅ **Authentication & Authorization**

- Use Cognito authorizer for protected endpoints
- Verify user permissions in handler if needed
- Log authentication failures

✅ **CORS configuration**

- Configure allowed origins (don't use `*` in production)
- Set appropriate headers
- Handle preflight OPTIONS requests

---

## Testing Strategy

### Unit Tests

- Mock data access layer
- Test validation logic
- Test error handling
- Test response formatting

### Integration Tests

- Use DynamoDB Local
- Test end-to-end flows
- Test with real AWS SDK calls
- Verify data persistence

### Load Tests

- Use Artillery or k6
- Test concurrent requests
- Verify Lambda scaling
- Monitor CloudWatch metrics

---

## Deployment

### Deploy to Dev

```bash
npm run deploy:dev
```

### Test Endpoint

```bash
# Get API Gateway URL from outputs
export API_URL=$(cat outputs.json | jq -r '.["dev-merchants-ms-ServiceStack"].ApiUrl')

# Test endpoint
curl -X GET "${API_URL}/merchants?category=plastic" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Monitor

- Check CloudWatch Logs: `/aws/lambda/dev-merchants-ms-GetMerchantsByCategory`
- Check CloudWatch Metrics: Invocations, Errors, Duration
- Check API Gateway metrics: 4xx, 5xx errors

---

## Next Steps

Once endpoints are implemented:

1. ✅ **[Add monitoring](./monitoring.md)** - Set up CloudWatch alarms
2. ✅ **[Configure authentication](./authentication.md)** - Set up Cognito authorizer
3. ✅ **[Deploy to staging](./deployment.md)** - Test in staging environment

---

## Story 001 Notes

**Endpoints implemented for Story 001**:

- `GET /merchants?category={category}` - Query merchants by waste category
- Pagination implemented with `nextToken`
- Cognito authorizer required for authentication

**See**: [Story 001 Implementation Log](./story-001-implementation-log.md)
