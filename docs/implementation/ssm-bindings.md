# SSM Contracts and the Generic Bindings Pattern

This document explains how we publish and consume cross-service contract values via SSM Parameter Store using:

- infra-contracts (shared, strongly-typed interfaces)
- SSM publications (producer code that writes params)
- An ergonomic, generic `BindingsConstruct<T>` and small `ssm.ts` helpers (consumer code that reads params)

The goal is to eliminate ad-hoc SSM reads, provide a single, ergonomic API for consumers, and keep type-safety via shared contracts.

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Contracts (infra-contracts)](#2-contracts-infra-contracts)
3. [Publishing (Producer → SSM)](#3-publishing-producer--ssm)
4. [Consuming (Consumer → BindingsConstruct)](#4-consuming-consumer--bindingsconstruct)
   - 4.1. [Params variant (key → SSM suffix mapping)](#41-params-variant-key--ssm-suffix-mapping)
   - 4.2. [Producer vs Consumer serviceName](#42-producer-vs-consumer-servicename)
   - 4.3. [Design principles](#43-design-principles)
5. [Versioning and Rollout Checklist](#5-versioning-and-rollout-checklist)

---

## 1. Quick Start

- Producer (publisher)
  - Define a minimal interface in `infra-contracts` (no optional fields).
  - Publish only the required parameters under `/super-deals/<env>/<producer-service>/public/...`.
    ```ts
    // users-ms/lib/ssm-publications/auth/construct.ts
    publishStringParameters(this, basePath, {
      "auth/userPoolId": auth.userPool.pool.userPoolId,
    });
    ```
  - For secure values, call `publishSecureStringParameters()` so the parameters are stored as `SecureString`s (optionally passing an `encryptionKeyArn`).
    ```ts
    publishSecureStringParameters(this, `${basePath}/monitor`, {
      "slack/webhookUrl": secrets.slackWebhookUrl,
    });
    ```

- Consumer (reader)
  - Use the ergonomic `BindingsConstruct<T>`.
  - Provide a `params` map where each logical key points to the hierarchical suffix published in SSM.
  - Always set `producerServiceName` to the service that PUBLISHES the values.
    ```ts
    // Params example (auth)
    const authParams = { userPoolId: "auth/userPoolId" } as const;
    const auth = new BindingsConstruct<IAuthBindings>(
      this,
      "UsersMsAuthBindings",
      {
        envName: config.envName,
        producerServiceName: "users-ms",
        visibility: "public",
        params: authParams,
      }
    );
    ```

- Use the values
  - `bindings.values.<key>` returns a strongly-typed string for use in your constructs.
  - Example: `UserPool.fromUserPoolId(this, "ImportedUserPool", auth.values.userPoolId)`

## 2. Contracts (infra-contracts)

Expose only fields that consumers actually use; keep them required (no optionals):

```ts
// @super-deals/infra-contracts/src/users-ms/types.ts
export interface IAuthBindings {
  userPoolId: string;
}

export interface IIamBindings {
  merchantRoleArn: string;
}

export interface IWebsiteBindings {
  websiteUrl: string;
  sourceEmail: string;
}
```

## 3. Publishing (Producer → SSM)

The producer service (e.g., `users-ms`) writes parameters under a base path:

```
/super-deals/<env>/<producer-service>/<visibility>/<key>
```

Examples:

```ts
// users-ms/lib/ssm-publications/construct.ts
// builds basePath like /super-deals/dev/users-ms/public
new AuthBindingsConstruct(this, "AuthBindingsConstruct", {
  basePath,
  region,
  auth,
});
new IamBindingsConstruct(this, "IamBindingsConstruct", { basePath, iam });
```

```ts
// users-ms/lib/ssm-publications/auth/construct.ts
publishStringParameters(this, basePath, {
  "auth/userPoolId": auth.userPool.pool.userPoolId,
});
```

```ts
// users-ms/lib/ssm-publications/iam/construct.ts
publishStringParameters(this, basePath, {
  "iam/roles/merchant/arn": iam.roles.merchant.roleArn,
});
```

Notes

- Visibility: Prefer `public` for cross-repo consumption.
- Minimal surface: Publish only the keys that consumers use.

## 4. Consuming (Consumer → BindingsConstruct)

Each repo provides small SSM helpers in `src/helpers/ssm.ts`:

- `buildSsmPublicPath`, `buildSsmPrivatePath`
- `readParam`
- `readBindings(scope, basePath, params)`
- `readSecureBindings(scope, basePath, params)`
- `publishStringParameters(scope, basePath, values)`
- `publishSecureStringParameters(scope, basePath, values, { encryptionKeyArn })`

The generic `BindingsConstruct<T>` uses the helpers internally and expects a single params-oriented style:

### 4.1. Params variant (key → SSM suffix mapping)

```ts
// deals-ms/lib/auth/construct.ts
import BindingsConstruct from "#lib/utils/bindings/construct";
import type { IAuthBindings } from "@super-deals/infra-contracts";

const authParams = { userPoolId: "auth/userPoolId" } as const;

const authBindings = new BindingsConstruct<IAuthBindings>(
  this,
  "UsersMsAuthBindings",
  {
    envName: config.envName,
    producerServiceName: "users-ms",
    visibility: "public",
    params: authParams,
  }
);

const userPool = UserPool.fromUserPoolId(
  this,
  "ImportedUserPool",
  authBindings.values.userPoolId
);
```

```ts
// deals-ms/lib/iam/construct.ts
import BindingsConstruct from "#lib/utils/bindings/construct";
import type { IIamBindings } from "@super-deals/infra-contracts";

const iamParams = { merchantRoleArn: "iam/roles/merchant/arn" } as const;

const iamBindings = new BindingsConstruct<IIamBindings>(
  this,
  "UsersMsIamBindings",
  {
    envName: config.envName,
    producerServiceName: "users-ms",
    visibility: "public",
    params: iamParams,
  }
);

const merchantRole = Role.fromRoleArn(
  this,
  "ImportedMerchantRole",
  iamBindings.values.merchantRoleArn
);
```

### 4.2. Producer vs Consumer serviceName

- Always point the consumer to the producer by setting `producerServiceName` to the service that publishes the parameters (e.g., `"users-ms"`, `"website-ms"`).
- Avoid using `config.service.name` in consumers unless the consumer and producer are the same service.

### 4.3. Design principles

- Minimal contracts: Contracts expose only fields used by consumers.
- No optional values: Shared contracts should not contain optional fields.
- Strong typing end-to-end: `infra-contracts` types drive both the producer and consumer shapes, reducing errors.
- Single, ergonomic construct: `BindingsConstruct<T>` + helpers encapsulate environment, base paths, and reading logic.

## 5. Versioning and Rollout Checklist

- Add new keys additively; do not break consumers.
- Publish changes to `infra-contracts` with semver and update consumers.
- If you must change SSM paths, publish under a new prefix and deprecate the old one.
- Keep docs + CHANGELOG in sync with contract changes.
