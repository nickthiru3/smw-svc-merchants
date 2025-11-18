# Infrastructure Testing Guide: CDK Template Assertions

This guide explains how we validate our AWS CDK stacks using `aws-cdk-lib/assertions`. Template tests ensure infra resources exist with the right configuration and guard against accidental drifts.

## Overview

CDK template tests validate CloudFormation templates **before deployment**:

- ✅ No AWS credentials required
- ✅ Fast execution (milliseconds)
- ✅ Catches configuration errors early
- ✅ Guards against infrastructure drift

## Scope

- Stacks and constructs under `lib/` (service infra only)
- CI/CD pipeline tests are out of scope
- Focus: `ServiceStack` and its child constructs

## Test Location

**File**: `test/lib/service-stack.test.ts`

**Tests for Story 001**:

- ✅ DynamoDB Merchants table (Faux-SQL approach)
- ✅ Partition key: `MerchantId`
- ✅ GSI1 for category queries (`GSI1PK`)
- ✅ Point-in-time recovery enabled
- ✅ Environment-based deletion protection
- ✅ CloudFormation outputs

## Best Practice: Use Actual Config

**Always use the actual application config** as the single source of truth:

```ts
import { Template, Match } from "aws-cdk-lib/assertions";
import { ServiceStack } from "#lib/service-stack";
import config from "#config/default"; // ← Import actual config

describe("ServiceStack (infrastructure)", () => {
  let stack: ServiceStack;

  // Use actual config values
  const envName = config.envName;
  const serviceName = config.service.name;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new ServiceStack(app, `${envName}-${serviceName}-ServiceStack`, {
      env: { account: config.accountId, region: config.region },
      config, // ← Use actual config object
    });
  });

  // Tests validate real configuration
});
```

**Why this matters**:

- ✅ Tests validate the **actual configuration** that will be deployed
- ✅ No risk of test config drifting from real config
- ✅ Changes to config are automatically tested
- ✅ Catches configuration errors before deployment

## Example Assertions

### 1. Validate Configuration

```ts
describe("Configuration", () => {
  test("uses Faux-SQL database approach", () => {
    expect(config.database.approach).toBe("faux-sql");
  });

  test("defines Merchants table in config", () => {
    const merchantsTable = config.database.fauxSql.tables.find(
      (table) => table.tableName === "Merchants"
    );
    expect(merchantsTable).toBeDefined();
    expect(merchantsTable?.partitionKey.name).toBe("MerchantId");
  });
});
```

### 2. Validate DynamoDB Table

```ts
describe("Database - Merchants Table", () => {
  test("creates Merchants table with MerchantId partition key", () => {
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [{ AttributeName: "MerchantId", KeyType: "HASH" }],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: "MerchantId", AttributeType: "S" },
      ]),
    });
  });

  test("configures GSI1 for category-based queries", () => {
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: "GSI1",
          KeySchema: [{ AttributeName: "GSI1PK", KeyType: "HASH" }],
          Projection: {
            ProjectionType: "ALL",
          },
        }),
      ],
    });
  });

  test("enables point-in-time recovery", () => {
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([
        Match.objectLike({
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: true,
          },
        }),
      ]),
    });
  });
});
```

### 3. Validate CloudFormation Outputs

```ts
test("exports Merchants table name for Lambda environment variables", () => {
  const template = Template.fromStack(stack);
  const templateJson = template.toJSON();
  const outputs = Object.values(templateJson.Outputs ?? {});

  const merchantsTableExport = outputs.find(
    (output) => output.Export?.Name === `${serviceName}-Merchants-TableName`
  );

  expect(merchantsTableExport).toBeDefined();
  expect(merchantsTableExport?.Value).toContain("Merchants");
});
```

See the full file for more examples: `test/lib/service-stack.test.ts`.

## Running tests

- `npm test`

## Testing Patterns

### Pattern 1: Configuration Validation

**Test the config itself before testing infrastructure**:

```ts
test("defines Merchants table in config", () => {
  const merchantsTable = config.database.fauxSql.tables.find(
    (table) => table.tableName === "Merchants"
  );
  expect(merchantsTable).toBeDefined();
});
```

**Why**: Catches config errors before they become infrastructure errors.

### Pattern 2: Resource Count Validation

**Use `resourceCountIs` to validate exact resource counts**:

```ts
test("creates exactly one table for Merchants entity", () => {
  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
});
```

**Why**: Prevents accidental resource duplication or deletion.

### Pattern 3: Property Matching

**Use `Match.objectLike` for partial matching**:

```ts
template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
  GlobalSecondaryIndexes: [
    Match.objectLike({
      IndexName: "GSI1",
      // Only assert critical properties
    }),
  ],
});
```

**Why**: Focuses on critical properties, ignores CloudFormation boilerplate.

### Pattern 4: Negative Assertions

**Validate what should NOT exist**:

```ts
test("uses Faux-SQL approach with descriptive key names", () => {
  const template = Template.fromStack(stack);
  const templateJson = template.toJSON();
  const tables = Object.values(templateJson.Resources ?? {}).filter(
    (resource: any) => resource.Type === "AWS::DynamoDB::GlobalTable"
  );

  tables.forEach((table: any) => {
    const attrNames = table.Properties.AttributeDefinitions.map(
      (attr: any) => attr.AttributeName
    );
    expect(attrNames).not.toContain("PK"); // Should NOT have generic keys
    expect(attrNames).not.toContain("SK");
  });
});
```

**Why**: Validates design decisions (e.g., Faux-SQL vs Single-Table).

## Tips

- ✅ **Use actual config** - Import from `#config/default`, don't hardcode
- ✅ **Test config first** - Validate configuration before infrastructure
- ✅ **Prefer `Match.objectLike`** - Assert only critical properties
- ✅ **Use `resourceCountIs`** - Validate exact resource counts
- ✅ **Test negative cases** - Validate what should NOT exist
- ✅ **Keep tests focused** - One assertion per test when possible
- ✅ **Mirror structure** - Test file structure mirrors `lib/` structure

## CI (Quick Note)

- Run CDK template tests on every PR alongside unit and handler tests.
- They are fast and do not require AWS credentials.
- See `guides/development/cicd-guide-v2.md` for how they fit into the pipeline. E2E and LocalStack remain outside PRs unless explicitly enabled.
