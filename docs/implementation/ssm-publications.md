# SSM Publications Implementation Guide

**Purpose**: Publish service configuration to AWS Systems Manager Parameter Store for other services to consume  
**When needed**: Other services or clients need to discover your resources (User Pool ID, IAM roles, API URLs)  
**Prerequisites**: Resources to publish (Auth, IAM, API, etc.) already created  
**Related**: [SSM Bindings Guide](./ssm-bindings.md) for consuming published parameters

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1. [Purpose](#11-purpose)
   - 1.2. [When to Use](#12-when-to-use)
2. [Key Concepts](#2-key-concepts)
   - 2.1. [SSM Parameter Store](#21-ssm-parameter-store)
   - 2.2. [Parameter Naming Convention](#22-parameter-naming-convention)
   - 2.3. [infra-contracts Package](#23-infra-contracts-package)
3. [Architecture](#3-architecture)
   - 3.1. [Construct Hierarchy](#31-construct-hierarchy)
   - 3.2. [Integration with Service Stack](#32-integration-with-service-stack)
   - 3.3. [Producer-Consumer Pattern](#33-producer-consumer-pattern)
4. [Implementation](#4-implementation)
   - 4.1. [Step 1: Understand Existing Structure](#41-step-1-understand-existing-structure)
   - 4.2. [Step 2: Review Main Publications Construct](#42-step-2-review-main-publications-construct)
   - 4.3. [Step 3: Review Auth Publications](#43-step-3-review-auth-publications)
   - 4.4. [Step 4: Review IAM Publications](#44-step-4-review-iam-publications)
   - 4.5. [Step 5: Add New Publications](#45-step-5-add-new-publications)
5. [Parameter Types](#5-parameter-types)
   - 5.1. [String Parameters (Default)](#51-string-parameters-default)
   - 5.2. [Secure String Parameters](#52-secure-string-parameters)
6. [Testing](#6-testing)
   - 6.1. [Unit Tests (CDK Template)](#61-unit-tests-cdk-template)
   - 6.2. [Integration Testing](#62-integration-testing)
7. [Best Practices](#7-best-practices)
   - 7.1. [Parameter Design](#71-parameter-design)
   - 7.2. [Contract Management](#72-contract-management)
   - 7.3. [Security](#73-security)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Overview

The SSM Publications construct publishes service configuration to AWS Systems Manager Parameter Store, enabling service discovery by other services and clients. This creates a contract-based integration pattern where producer services publish parameters and consumer services read them.

### 1.1. Purpose

- **Service Discovery**: Enable other services to discover your resources
- **Loose Coupling**: Services don't need hardcoded references
- **Type Safety**: Use `infra-contracts` package for shared interfaces
- **Centralized Config**: Single source of truth for cross-service configuration

### 1.2. When to Use

✅ **Publish parameters when**:

- Frontend needs your User Pool ID/Client ID for authentication
- Other microservices need to reference your IAM roles
- Admin tools need access to your infrastructure
- Monitoring systems need your service configuration

❌ **Don't publish when**:

- Resources are internal-only (not consumed by other services)
- Sensitive secrets (use AWS Secrets Manager instead)
- Frequently changing values (use API endpoints instead)

---

## 2. Key Concepts

### 2.1. SSM Parameter Store

**What**: AWS service for storing configuration data and secrets

**Benefits**:

- Hierarchical parameter naming
- Version history
- Access control via IAM
- Integration with CloudFormation

### 2.2. Parameter Naming Convention

**Structure**: `/app-name/<env>/<service-name>/<visibility>/<key>`

**Examples**:

```
/smw/dev/svc-merchants/public/auth/userPoolId
/smw/dev/svc-merchants/public/auth/userPoolClientId
/smw/dev/svc-merchants/public/iam/roles/merchant/arn
/smw/prod/svc-merchants/public/api/url
```

**Components**:

- `app-name`: Application name (e.g., `smw` for SaveMyWaste)
- `env`: Environment (dev, staging, prod)
- `service-name`: Service identifier (e.g., `svc-merchants`)
- `visibility`: `public` (cross-service) or `private` (internal)
- `key`: Hierarchical key (e.g., `auth/userPoolId`)

### 2.3. infra-contracts Package

**Purpose**: Shared TypeScript interfaces for type-safe parameter consumption

**Location**: Separate npm package (e.g., `@smw/infra-contracts`)

**Example**:

```typescript
// @smw/infra-contracts/src/svc-merchants/types.ts
export interface IAuthBindings {
  userPoolId: string;
}

export interface IIamBindings {
  merchantRoleArn: string;
  customerRoleArn: string;
}
```

**Benefits**:

- Type safety across services
- Contract versioning
- Breaking change detection
- IDE autocomplete

---

## 3. Architecture

### 3.1. Construct Hierarchy

```
SsmPublicationsConstruct
├── AuthBindingsConstruct
│   └── Publishes auth parameters (User Pool ID, Client ID)
└── IamBindingsConstruct
    └── Publishes IAM parameters (Role ARNs)
```

### 3.2. Integration with Service Stack

```
service-stack.ts
├── AuthConstruct (creates User Pool, Identity Pool)
├── IamConstruct (creates IAM roles)
├── ApiConstruct (creates API Gateway)
└── SsmPublicationsConstruct ← Last construct (publishes all resources)
    ├── Reads from AuthConstruct
    ├── Reads from IamConstruct
    └── Publishes to SSM Parameter Store
```

### 3.3. Producer-Consumer Pattern

```
Producer Service (svc-merchants)
    ↓
SsmPublicationsConstruct
    ↓
SSM Parameter Store
    ↓
SsmBindingsConstruct
    ↓
Consumer Service (web-app, other-ms)
```

---

## 4. Implementation

### 4.1. Step 1: Understand Existing Structure

The `SsmPublicationsConstruct` is already wired in `service-stack.ts`:

```typescript
// lib/service-stack.ts
// 8. SSM Publications - Publish service configs for other services to consume
new SsmPublicationsConstruct(this, "SsmPublicationsConstruct", {
  config,
  auth,
  iam,
});
```

**Note**: This is the **last construct** in the stack because it depends on all other resources being created first.

### 4.2. Step 2: Review Main Publications Construct

**Location**: `lib/ssm-publications/construct.ts`

```typescript
class SsmPublicationsConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ISsmPublicationsConstructProps
  ) {
    super(scope, id);

    const { config, auth, iam } = props;

    const envName = config.envName; // e.g., "dev"
    const serviceName = config.service.name; // e.g., "svc-merchants"

    // Build base path: /smw/{env}/{service}/public
    const basePath = buildSsmPublicPath(envName, serviceName);

    // Publish auth parameters
    new AuthBindingsConstruct(this, "AuthBindingsConstruct", {
      basePath,
      auth,
    });

    // Publish IAM parameters
    new IamBindingsConstruct(this, "IamBindingsConstruct", {
      basePath,
      iam,
    });
  }
}
```

### 4.3. Step 3: Review Auth Publications

**Location**: `lib/ssm-publications/auth/construct.ts`

```typescript
class AuthBindingsConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: IAuthBindingsConstructProps
  ) {
    super(scope, id);

    const { basePath, auth } = props;

    // Publish only required bindings consumed by downstream services
    const authBindings: Record<string, string> = {
      "auth/userPoolId": auth.userPool.pool.userPoolId,
      // Add more as needed:
      // "auth/userPoolClientId": auth.userPool.poolClient.userPoolClientId,
      // "auth/identityPoolId": auth.identityPool.pool.ref,
    };

    publishStringParameters(this, basePath, authBindings);
  }
}
```

**Result**: Creates SSM parameter at `/smw/dev/svc-merchants/public/auth/userPoolId`

### 4.4. Step 4: Review IAM Publications

**Location**: `lib/ssm-publications/iam/construct.ts`

```typescript
class IamBindingsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IIamBindingsConstructProps) {
    super(scope, id);

    const { basePath, iam } = props;

    const iamBindings: Record<string, string> = {
      "iam/roles/merchant/arn": iam.roles.merchant.roleArn,
      // Add more as needed:
      // "iam/roles/customer/arn": iam.roles.customer.roleArn,
      // "iam/roles/authenticated/arn": iam.roles.authenticated.roleArn,
    };

    publishStringParameters(this, basePath, iamBindings);
  }
}
```

**Result**: Creates SSM parameter at `/smw/dev/svc-merchants/public/iam/roles/merchant/arn`

### 4.5. Step 5: Add New Publications

**Example**: Publish API URL

1. **Create new publications construct**:

```typescript
// lib/ssm-publications/api/construct.ts
import { Construct } from "constructs";
import ApiConstruct from "#lib/api/construct";
import { publishStringParameters } from "#src/helpers/ssm";

interface IApiBindingsConstructProps {
  readonly basePath: string;
  readonly api: ApiConstruct;
}

class ApiBindingsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IApiBindingsConstructProps) {
    super(scope, id);

    const { basePath, api } = props;

    const apiBindings: Record<string, string> = {
      "api/url": api.restApi.url,
      "api/id": api.restApi.restApiId,
    };

    publishStringParameters(this, basePath, apiBindings);
  }
}

export default ApiBindingsConstruct;
```

2. **Wire into main publications construct**:

```typescript
// lib/ssm-publications/construct.ts
import ApiBindingsConstruct from "./api/construct";
import ApiConstruct from "#lib/api/construct";

interface ISsmPublicationsConstructProps {
  readonly config: IConfig;
  readonly auth: AuthConstruct;
  readonly iam: IamConstruct;
  readonly api: ApiConstruct; // Add this
}

class SsmPublicationsConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ISsmPublicationsConstructProps
  ) {
    super(scope, id);

    const { config, auth, iam, api } = props;

    const basePath = buildSsmPublicPath(config.envName, config.service.name);

    new AuthBindingsConstruct(this, "AuthBindingsConstruct", {
      basePath,
      auth,
    });
    new IamBindingsConstruct(this, "IamBindingsConstruct", { basePath, iam });
    new ApiBindingsConstruct(this, "ApiBindingsConstruct", { basePath, api }); // Add this
  }
}
```

3. **Update service-stack.ts**:

```typescript
// lib/service-stack.ts
const api = new ApiConstruct(this, "ApiConstruct", {
  config,
  auth,
  db,
  permissions,
});

new SsmPublicationsConstruct(this, "SsmPublicationsConstruct", {
  config,
  auth,
  iam,
  api, // Add this
});
```

---

## 5. Parameter Types

### 5.1. String Parameters (Default)

**Use for**: Most configuration values

**Helper**: `publishStringParameters()`

```typescript
publishStringParameters(this, basePath, {
  "auth/userPoolId": auth.userPool.pool.userPoolId,
  "api/url": api.restApi.url,
});
```

### 5.2. Secure String Parameters

**Use for**: Sensitive values (API keys, webhooks)

**Helper**: `publishSecureStringParameters()`

```typescript
publishSecureStringParameters(
  this,
  basePath,
  {
    "monitor/slack/webhookUrl": secrets.slackWebhookUrl,
  },
  {
    encryptionKeyArn: kmsKey.keyArn, // Optional: use custom KMS key
  }
);
```

**Benefits**:

- Encrypted at rest
- Requires KMS permissions to read
- Audit trail in CloudTrail

---

## 6. Testing

### 6.1. Unit Tests (CDK Template)

**Location**: `test/lib/ssm-publications/construct.test.ts`

**Test parameter creation**:

```typescript
import { Template } from "aws-cdk-lib/assertions";

test("publishes User Pool ID to SSM", () => {
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/smw/dev/svc-merchants/public/auth/userPoolId",
    Type: "String",
    Value: { Ref: Match.anyValue() }, // References User Pool
  });
});

test("publishes merchant role ARN to SSM", () => {
  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/smw/dev/svc-merchants/public/iam/roles/merchant/arn",
    Type: "String",
    Value: { "Fn::GetAtt": [Match.anyValue(), "Arn"] }, // References IAM Role
  });
});
```

### 6.2. Integration Testing

**Verify parameters in AWS Console**:

1. **Deploy stack**:

   ```bash
   npm run deploy:dev
   ```

2. **Check parameters**:

   ```bash
   aws ssm get-parameters-by-path \
     --path "/smw/dev/svc-merchants/public" \
     --recursive
   ```

3. **Verify values**:
   ```bash
   aws ssm get-parameter \
     --name "/smw/dev/svc-merchants/public/auth/userPoolId"
   ```

**Test consumption by other services**:

```typescript
// In consumer service
import { StringParameter } from "aws-cdk-lib/aws-ssm";

const userPoolId = StringParameter.valueFromLookup(
  this,
  "/smw/dev/svc-merchants/public/auth/userPoolId"
);

console.log("Imported User Pool ID:", userPoolId);
```

---

## 7. Best Practices

### 7.1. Parameter Design

✅ **DO**:

- Publish only what consumers need
- Use hierarchical keys (e.g., `auth/userPoolId`)
- Keep parameter names stable (avoid breaking changes)
- Document published parameters in README

❌ **DON'T**:

- Publish internal implementation details
- Use flat parameter names (e.g., `userPoolId` instead of `auth/userPoolId`)
- Change parameter names without versioning
- Publish sensitive secrets (use Secrets Manager)

### 7.2. Contract Management

✅ **DO**:

- Define interfaces in `infra-contracts` package
- Version contracts with semver
- Add new parameters additively (don't break existing)
- Keep contracts minimal (required fields only)

❌ **DON'T**:

- Include optional fields in contracts
- Remove parameters without deprecation period
- Change parameter types without major version bump

### 7.3. Security

✅ **DO**:

- Use `public` visibility for cross-service parameters
- Use `private` visibility for internal parameters
- Use SecureString for sensitive values
- Restrict IAM permissions to specific paths

❌ **DON'T**:

- Publish secrets or API keys as plain strings
- Grant `ssm:*` permissions
- Publish production credentials to dev environment

---

## 8. Troubleshooting

### 8.1. Parameter Not Found

**Symptom**: Consumer service can't find published parameter

**Causes**:

1. Parameter not published (check CloudFormation)
2. Path mismatch (typo in parameter name)
3. Environment mismatch (dev vs prod)

**Solution**:

```bash
# List all parameters for service
aws ssm get-parameters-by-path \
  --path "/smw/dev/svc-merchants/public" \
  --recursive

# Verify exact parameter name
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Values=/smw/dev/svc-merchants/public/auth/userPoolId"
```

### 8.2. Parameter Value Empty

**Symptom**: Parameter exists but value is empty or incorrect

**Causes**:

1. Resource not created before publication
2. Circular dependency
3. CloudFormation reference issue

**Solution**:

- Ensure SsmPublicationsConstruct is last in service-stack.ts
- Verify resource exists before publishing
- Check CloudFormation template for correct references

### 8.3. Consumer Can't Read Parameter

**Symptom**: Access denied when reading parameter

**Cause**: Missing IAM permissions

**Solution**:

```typescript
// Grant consumer service permission to read parameters
consumerRole.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ssm:GetParameter", "ssm:GetParameters"],
    resources: [
      `arn:aws:ssm:${region}:${account}:parameter/smw/${env}/svc-merchants/public/*`,
    ],
  })
);
```

---

## Related Guides

- [SSM Bindings](./ssm-bindings.md) - Consuming published parameters
- [Authentication & Authorization](./authentication.md) - Publishing auth parameters
- [IAM Roles](./iam-roles.md) - Publishing role ARNs
- [End-to-End Auth](../../../docs/guides/auth/end-to-end-auth.md) - Cross-service auth patterns

---

**Last Updated**: November 2025  
**Related Constructs**: `AuthConstruct`, `IamConstruct`, `ApiConstruct`
