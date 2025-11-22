# CDK Template Testing Guide

Comprehensive guide for testing AWS CDK infrastructure using `aws-cdk-lib/assertions`.

**Related**: [Adding Endpoints - Part 2: API Gateway Integration](../implementation/adding-endpoints-part-2-api-gateway.md)

---

## Overview

CDK template tests validate CloudFormation templates **before deployment**:

- ✅ No AWS credentials required
- ✅ Fast execution (milliseconds)
- ✅ Catches configuration errors early
- ✅ Guards against infrastructure drift

---

## Test Levels

### Construct-Level (Recommended for Development)

**File**: `test/lib/[construct-path]/construct.test.ts`

**Pros**: ⚡ Fast, 🎯 Focused, 🐛 Easy to debug

### Stack-Level (Integration)

**File**: `test/lib/service-stack.test.ts`

**Pros**: 🌐 Comprehensive, 🔗 Tests integration

**Use both**: Construct-level during development, stack-level for integration.

---

## What to Test

### Construct-Level

- ✅ Lambda function (runtime, memory, timeout)
- ✅ Environment variables
- ✅ IAM permissions
- ✅ API Gateway method/integration
- ✅ Request/response validation

### Stack-Level

- ✅ All constructs created
- ✅ Constructs wired correctly
- ✅ CloudFormation outputs
- ✅ Resource counts

---

## Best Practices

### 1. Mock NodejsFunction to Avoid Docker Bundling

**CRITICAL**: CDK's `NodejsFunction` uses Docker for bundling, which causes tests to fail if Docker is not available. **Always mock `NodejsFunction` in CDK template tests**:

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

**Why This Works**:

- Replaces `NodejsFunction` with a mock that extends `lambda.Function`
- Strips out bundling configuration that triggers Docker
- Provides inline code placeholder for testing
- Preserves all other Lambda configuration (runtime, memory, timeout, env vars, etc.)

**When to Use**:

- ✅ All construct-level tests that create `NodejsFunction`
- ✅ Stack-level tests (already mocked in `test/lib/service-stack.test.ts`)
- ❌ Not needed for tests that don't use `NodejsFunction`

---

### 2. Use Actual Config

```typescript
import config from "#config/default";

const stack = new ServiceStack(app, "TestStack", {
  env: { account: config.accountId, region: config.aws.region },
  config, // Use actual config
});
```

### 3. Use Match Utilities

```typescript
import { Match } from "aws-cdk-lib/assertions";

template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
  AttributeDefinitions: Match.arrayWith([
    { AttributeName: "MerchantId", AttributeType: "S" },
  ]),
});
```

### 4. Validate Resource Counts

```typescript
template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
```

---

## Example: Construct-Level Test

```typescript
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import GetConstruct from "#lib/api/endpoints/merchants/get/construct";

describe("GET /merchants Construct", () => {
  let template: Template;

  beforeEach(() => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const mockApiProps = {
      restApi: { root: { addResource: jest.fn() } },
      optionsWithCors: {},
      optionsWithAuth: {},
    };

    const mockDb = {
      table: { tableName: "test-table", grantReadData: jest.fn() },
    };

    new GetConstruct(stack, "GetConstruct", {
      apiProps: mockApiProps as any,
      db: mockDb as any,
      merchantsResource: mockApiProps.restApi.root as any,
    });

    template = Template.fromStack(stack);
  });

  it("should create Lambda function", () => {
    template.resourceCountIs("AWS::Lambda::Function", 1);
  });

  it("should set TABLE_NAME environment variable", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: { TABLE_NAME: "test-table" } },
    });
  });

  it("should grant DynamoDB read permissions", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["dynamodb:Query"]),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });
});
```

---

## Example: Stack-Level Test

```typescript
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import ServiceStack from "#lib/service-stack";
import config from "#config/default";

describe("ServiceStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new ServiceStack(app, "TestStack", {
      env: { account: config.accountId, region: config.aws.region },
      config,
    });
    template = Template.fromStack(stack);
  });

  it("should create API Gateway REST API", () => {
    template.hasResourceProperties("AWS::ApiGateway::RestApi", {
      Name: config.service.name,
    });
  });

  it("should create DynamoDB table", () => {
    template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
  });

  it("should create Lambda functions", () => {
    template.resourceCountIs("AWS::Lambda::Function", 2);
  });
});
```

---

## Running Tests

```bash
# All tests
npm test

# Construct tests only
npm test -- construct.test.ts

# Stack tests only
npm test -- service-stack.test.ts

# With coverage
npm run test:coverage
```

---

## Related Guides

- [Adding Endpoints - Part 2: API Gateway Integration](../implementation/adding-endpoints-part-2-api-gateway.md)
- [Handler Testing Guide](./handler-testing-guide.md)
- [Testing Strategy](./testing-strategy.md)
