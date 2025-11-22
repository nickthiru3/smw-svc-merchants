# Using CDK Constructs

**Guide**: How to use and configure existing CDK constructs

---

## Overview

This microservice uses CDK constructs to encapsulate infrastructure. This guide covers how to use the existing constructs in `lib/`.

**Prerequisites:**

- ✅ Understanding of AWS CDK basics
- ✅ Familiarity with the service stack architecture

---

## Available Constructs

### Core Constructs

- **[DatabaseConstruct](../architecture/constructs/database.md)** - DynamoDB table configuration
- **[ApiConstruct](../architecture/constructs/api.md)** - API Gateway + Lambda endpoints
- **[AuthConstruct](../architecture/constructs/auth.md)** - Cognito User Pool, Identity Pool, Groups
- **[MonitorConstruct](../architecture/constructs/monitor.md)** - CloudWatch alarms, SNS topics
- **[IamConstruct](../architecture/constructs/iam.md)** - IAM roles for authenticated users
- **[PermissionsConstruct](../architecture/constructs/permissions.md)** - OAuth scopes (optional)

### Supporting Constructs

- **[SsmBindingsConstruct](../architecture/constructs/ssm-bindings.md)** - Read external service configs
- **[SsmPublicationsConstruct](../architecture/constructs/ssm-publications.md)** - Publish service configs

---

## Common Tasks

### Adding a New Endpoint

See the detailed guides:

- [Part 1: Lambda Handlers](./adding-endpoints-part-1-lambda-handlers.md)
- [Part 2: API Gateway Integration](./adding-endpoints-part-2-api-gateway.md)

**Quick reference**:

1. Create Lambda handler in `src/handlers/`
2. Update `lib/api/construct.ts` to add endpoint
3. Grant necessary permissions (DynamoDB, etc.)

### Configuring DynamoDB Table

See `lib/db/construct.ts` for table configuration.

**To add a GSI**:

```typescript
// lib/db/construct.ts
table.addGlobalSecondaryIndex({
  indexName: "GSI3",
  partitionKey: {
    name: "GSI3PK",
    type: AttributeType.STRING,
  },
  sortKey: {
    name: "GSI3SK",
    type: AttributeType.STRING,
  },
  projectionType: ProjectionType.ALL,
});
```

### Adding CloudWatch Alarms

See `lib/monitor/construct.ts` for monitoring configuration.

**To add an alarm**:

```typescript
// lib/monitor/construct.ts
const errorAlarm = new Alarm(this, "LambdaErrorAlarm", {
  metric: lambdaFunction.metricErrors(),
  threshold: 5,
  evaluationPeriods: 1,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});

errorAlarm.addAlarmAction(new SnsAction(this.alarmTopic));
```

---

## Configuration

### Environment-Specific Config

Configuration is managed in `config/{env}.ts`:

```typescript
// config/dev.ts
export const config: IConfig = {
  envName: "dev",
  serviceName: "merchants",
  region: "us-east-1",

  // DynamoDB
  dynamodb: {
    billingMode: "PAY_PER_REQUEST",
    pointInTimeRecovery: true,
  },

  // API Gateway
  api: {
    throttle: {
      rateLimit: 1000,
      burstLimit: 2000,
    },
  },

  // Monitoring
  monitoring: {
    alarmEmail: "dev-team@example.com",
  },
};
```

### SSM Parameter Bindings

Read external service configurations:

```typescript
// lib/ssm-bindings/construct.ts
const userPoolId = ssmBindings.getUserPoolId("users");
const apiUrl = ssmBindings.getApiUrl("orders");
```

---

## Story 001 Notes

**Constructs used for Story 001**:

- DatabaseConstruct - Merchants table with GSI1 for category queries
- ApiConstruct - GET /merchants endpoint
- AuthConstruct - Cognito authorizer for API

**See**: [Story 001 Implementation Log](./story-001-implementation-log.md)
