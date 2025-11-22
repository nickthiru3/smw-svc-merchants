# Adding API Endpoints - Part 2: API Gateway Integration

**Guide**: How to wire Lambda handlers to API Gateway using CDK

**Part**: 2 of 2 ([Part 1: Lambda Handlers](./adding-endpoints-part-1-lambda-handlers.md) → API Gateway Integration)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Story Artifacts](#3-story-artifacts)
4. [API Configuration](#4-api-configuration)
5. [Implementation Steps](#5-implementation-steps)
6. [Testing](#6-testing)
7. [Verification](#7-verification)

---

## 1. Overview

This guide covers wiring Lambda handlers to API Gateway using AWS CDK.

**Infrastructure Architecture**:

```
ApiConstruct (config-driven via config/api.ts)
└── EndpointsConstruct
    └── [Resource]Construct (e.g., MerchantsConstruct)
        └── [Method]Construct (e.g., GetConstruct)
```

**What This Guide Covers**:

- API Gateway JSON schema validation
- CDK construct creation
- Lambda function configuration
- IAM permissions
- CDK template testing

---

## 2. Prerequisites

- ✅ Lambda handler implemented ([Part 1](./adding-endpoints-part-1-lambda-handlers.md))
- ✅ Handler tests passing
- ✅ OpenAPI spec completed

---

## 3. Story Artifacts

### 3.1. OpenAPI Specification

**Location**: `docs/project/specs/api/resources/[resource]/[operation].yaml`

**Extract**:

- Path and HTTP method
- Request parameters/body schema
- Response schemas
- Security requirements

### 3.2. Actions & Queries

**Location**: `docs/project/specs/stories/[actor]/[story]/actions-queries.md`

**Extract**:

- API Endpoint section (path and method)

---

## 4. API Configuration

### 4.1. What's Already Configured

These settings are in `config/api.ts` (template-level):

- REST API settings (endpoint type, CloudWatch role)
- CORS (origins, methods, headers)
- Stages (throttling, logging, caching)
- Authorization (Cognito, OAuth)

### 4.2. What You'll Implement

These are story-specific (in constructs):

- Endpoint paths and methods
- Lambda handler wiring
- Request/response schemas
- IAM permissions

---

## 5. Implementation Steps

### 5.1. Create API Gateway JSON Schema

**File**: `lib/api/endpoints/[resource]/[method]/api.schema.ts`

**Example**:

```typescript
import { JsonSchema, JsonSchemaType } from "aws-cdk-lib/aws-apigateway";

export const getMerchantsQuerySchema: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    category: {
      type: JsonSchemaType.STRING,
      minLength: 1,
    },
    limit: {
      type: JsonSchemaType.INTEGER,
      minimum: 1,
      maximum: 100,
    },
  },
  required: ["category"],
};
```

---

### 5.2. Create Resource-Level Construct

**File**: `lib/api/endpoints/[resource]/construct.ts`

**Example**:

```typescript
import { Construct } from "constructs";
import GetConstruct from "./get/construct";
import type { IApiProps } from "../../construct";

interface IMerchantsConstructProps {
  readonly apiProps: IApiProps;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
}

class MerchantsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IMerchantsConstructProps) {
    super(scope, id);

    const { apiProps, auth, db } = props;

    const merchantsResource = apiProps.restApi.root.addResource(
      "merchants",
      apiProps.optionsWithCors
    );

    new GetConstruct(this, "GetConstruct", {
      apiProps,
      auth,
      db,
      merchantsResource,
    });
  }
}

export default MerchantsConstruct;
```

---

### 5.3. Create Method-Level Construct

**File**: `lib/api/endpoints/[resource]/[method]/construct.ts`

**Key Methods** (in order):

1. `createModelsForRequestValidation()` - Create API Gateway JSON schema models
2. `createRequestValidator()` - Validate requests at gateway
3. `addCustomGatewayResponseForValidationErrors()` - Format validation errors
4. `createLambdaFunction()` - Create Lambda with env vars and permissions
5. `addApiMethodWithLambdaIntegration()` - Wire to API Gateway

**Important Considerations**:

- **Always include `auth` parameter** in the props interface, even for public endpoints
  - For authenticated endpoints: Use `auth` to configure authorization
  - For public endpoints: Document why `auth` is not used (consistency and future-proofing)
- **Request validation differs by HTTP method**:
  - POST/PUT: Validate request body (`validateRequestBody: true`)
  - GET/DELETE: Validate query parameters (`validateRequestParameters: true`)
- **Gateway response type differs by validation type**:
  - Body validation: `ResponseType.BAD_REQUEST_BODY`
  - Parameter validation: `ResponseType.BAD_REQUEST_PARAMETERS`

**Example** (see `lib/api/endpoints/users/post/construct.ts` for POST pattern)
**Example** (see `lib/api/endpoints/merchants/search/construct.ts` for GET pattern)

---

### 5.4. Update EndpointsConstruct

**File**: `lib/api/endpoints/construct.ts`

Add your new resource construct:

```typescript
new MerchantsConstruct(this, "MerchantsConstruct", {
  config,
  apiProps,
  auth,
  db,
});
```

---

## 6. Testing

Test your API Gateway integration at two levels: **construct-level** (recommended for development) and **stack-level** (for integration verification).

### 6.1. What to Test

**CDK Infrastructure**:

- ✅ Lambda function created with correct runtime and configuration
- ✅ Environment variables set (TABLE_NAME, etc.)
- ✅ IAM permissions granted (least-privilege)
- ✅ API Gateway method and integration configured
- ✅ Request/response validation models

**Lambda Handler**:

- ✅ Request parsing and validation
- ✅ Business logic execution
- ✅ Error handling (400, 404, 500, etc.)
- ✅ Response formatting

### 6.2. Testing Approaches

#### Construct-Level Tests (Recommended)

**File**: `test/lib/api/endpoints/[resource]/[method]/construct.test.ts`

**Pros**: ⚡ Fast, 🎯 Focused, 🐛 Easy to debug

**IMPORTANT: Mock NodejsFunction to Avoid Docker Bundling**

CDK's `NodejsFunction` uses Docker for bundling by default, which causes tests to fail if Docker is not available or configured. **Always mock `NodejsFunction` in CDK template tests**:

```typescript
// Add this at the TOP of your test file, BEFORE imports
jest.mock("aws-cdk-lib/aws-lambda-nodejs", () => {
  const actual = jest.requireActual("aws-cdk-lib/aws-lambda-nodejs");
  const lambda = jest.requireActual("aws-cdk-lib/aws-lambda");

  class MockNodejsFunction extends lambda.Function {
    constructor(scope: any, id: string, props: any = {}) {
      const { bundling, entry, depsLockFilePath, minify, sourceMaps, ...rest } =
        props ?? {};

      super(scope, id, {
        ...rest,
        code:
          rest?.code ??
          lambda.Code.fromInline("exports.handler = async () => {}"),
        handler: rest?.handler ?? "index.handler",
        runtime: rest?.runtime ?? lambda.Runtime.NODEJS_20_X,
      });
    }
  }

  return {
    ...actual,
    NodejsFunction: MockNodejsFunction,
  };
});
```

**Example Pattern**:

```typescript
// Mock MUST be at the top, before imports
jest.mock("aws-cdk-lib/aws-lambda-nodejs", () => {
  /* ... */
});

import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeEach } from "@jest/globals";
import GetConstruct from "#lib/api/endpoints/merchants/get/construct";

describe("GET /merchants Construct", () => {
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    const app = new App();
    stack = new Stack(app, "TestStack");

    // Create minimal mock dependencies
    const mockApiProps = {
      restApi: {
        root: {
          addResource: jest.fn().mockReturnValue({
            addMethod: jest.fn(),
          }),
        },
      },
      optionsWithCors: {},
      optionsWithAuth: {},
    };

    const mockDb = {
      table: {
        tableName: "test-table",
        grantReadData: jest.fn(),
      },
    };

    // Test ONLY this construct
    new GetConstruct(stack, "GetConstruct", {
      apiProps: mockApiProps as any,
      db: mockDb as any,
      merchantsResource: mockApiProps.restApi.root as any,
    });

    template = Template.fromStack(stack);
  });

  it("should create Lambda function with correct runtime", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs20.x",
      MemorySize: 512,
      Timeout: 30,
    });
  });

  it("should set TABLE_NAME environment variable", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          TABLE_NAME: "test-table",
        },
      },
    });
  });

  it("should grant DynamoDB read permissions", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              "dynamodb:BatchGetItem",
              "dynamodb:GetItem",
              "dynamodb:Query",
              "dynamodb:Scan",
            ],
            Effect: "Allow",
            Resource: "*", // Simplified for example
          },
        ],
      },
    });
  });

  it("should create request validator", () => {
    template.hasResourceProperties("AWS::ApiGateway::RequestValidator", {
      ValidateRequestParameters: true,
      ValidateRequestBody: false, // GET requests don't have body
    });
  });
});
```

#### Stack-Level Tests (Integration)

**File**: `test/lib/service-stack.test.ts`

**Pros**: 🌐 Comprehensive, 🔗 Tests integration

**Example Pattern**:

```typescript
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect } from "@jest/globals";
import ServiceStack from "#lib/service-stack";

describe("ServiceStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new ServiceStack(app, "TestStack", {
      env: { account: "123456789012", region: "us-east-1" },
    });
    template = Template.fromStack(stack);
  });

  it("should create API Gateway REST API", () => {
    template.hasResourceProperties("AWS::ApiGateway::RestApi", {
      Name: "svc-merchants",
    });
  });

  it("should create all Lambda functions", () => {
    template.resourceCountIs("AWS::Lambda::Function", 2); // POST /users, GET /merchants
  });

  it("should create DynamoDB table", () => {
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "Merchants",
    });
  });

  it("should wire Lambda to API Gateway", () => {
    // Test that Lambda integration exists
    template.hasResourceProperties("AWS::ApiGateway::Method", {
      HttpMethod: "GET",
      Integration: {
        Type: "AWS_PROXY",
      },
    });
  });
});
```

### 6.3. Detailed Testing Guides

For comprehensive testing guidance, see:

- **[CDK Template Testing Guide](../../testing/cdk-template-testing-guide.md)** - Detailed CDK infrastructure testing patterns, assertions, and best practices
- **[Handler Testing Guide](../../testing/handler-testing-guide.md)** - Lambda handler testing with AWS SDK mocking and validation testing
- **[Testing Strategy](../../testing/testing-strategy.md)** - Overall testing approach and when to use each test type

### 6.4. Quick Testing Checklist

Before committing your endpoint:

- [ ] **Construct tests pass** - `npm test -- endpoints/[resource]/[method]`
- [ ] **Handler tests pass** - Validation, error handling, business logic
- [ ] **Stack tests pass** - `npm test -- service-stack`
- [ ] **Linting passes** - `npm run lint`

### 6.5. Testing Strategy Summary

| Test Type           | When to Use                                       | Speed   | Guide   |
| ------------------- | ------------------------------------------------- | ------- | ------- |
| **Construct-level** | During development, testing individual constructs | Fast ⚡ | High 🎯 |
| **Stack-level**     | Before deployment, testing integration            | Slow 🐢 | Low 🌐  |

---

## 7. Verification

**Commands**:

```bash
npm run synth  # Synthesize CloudFormation
npm test       # Run all tests including CDK template tests
```

**Checklist**:

- [ ] JSON schema matches OpenAPI spec
- [ ] Lambda function configured correctly
- [ ] IAM permissions follow least-privilege
- [ ] API Gateway method wired correctly
- [ ] Request validation enabled
- [ ] CDK template tests pass
- [ ] Code follows project patterns

---

## Next Steps

1. **Deploy**: `npm run deploy:dev`
2. **Test endpoint**: Use Postman/curl to test deployed API
3. **E2E tests** (optional): [E2E Testing Guide](../testing/e2e-testing-guide.md)

---

## Related Guides

- [Part 1: Lambda Handlers](./adding-endpoints-part-1-lambda-handlers.md)
- [CDK Template Testing](../testing/cdk-template-testing-guide.md)
- [Configuration Management](./configuration-management/README.md)
