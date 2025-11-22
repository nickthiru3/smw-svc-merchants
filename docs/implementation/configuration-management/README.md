# Configuration Management

Comprehensive guide for configuring your microservice across different environments and domains.

**Location**: `config/` directory contains all configuration files.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration Guides](#configuration-guides)
4. [Architecture](#architecture)
5. [Validation Strategy](#validation-strategy)
6. [Type System](#type-system)
7. [Adding New Configuration](#adding-new-configuration)
8. [Best Practices](#best-practices)

---

## Quick Start

### Local Development

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Set required variables
echo "ENV_NAME=local" >> .env
echo "SERVICE_NAME=svc-merchants" >> .env

# 3. Start LocalStack
docker-compose -f docker-compose.localstack.yml up -d

# 4. Deploy
npm run cdk:deploy
```

### Staging/Production

```bash
# Set environment
export ENV_NAME=staging  # or production

# Set required variables
export SERVICE_NAME=svc-merchants
export AWS_REGION=us-east-1
export GITHUB_REPO=my-org/svc-merchants

# Deploy
npm run cdk:deploy
```

---

## Configuration Guides

### By Domain

- **[Service Configuration](./service-configuration.md)** - Service name and display name
- **[Database Configuration](./database-configuration.md)** - DynamoDB tables and approach
- **[API Configuration](./api-configuration.md)** - API Gateway, CORS, stages, authorization
- **[Resources Configuration](./resources-configuration.md)** - Resource naming prefixes
- **[Features Configuration](./features-configuration.md)** - Feature toggles
- **[GitHub Configuration](./github-configuration.md)** - GitHub repo and CI/CD
- **[AWS Configuration](./aws-configuration.md)** - AWS region and profile

### By Environment

- **[Environment Configuration](./environment-configuration.md)** - LocalStack, staging, production overrides

---

---

## Overview

The configuration system uses a **modular, layered approach** with:

- ✅ **Domain-specific config files** - Each concern in its own file
- ✅ **Centralized types** - All interfaces in one place
- ✅ **Dual-layer validation** - Early detection + comprehensive final validation
- ✅ **Environment overrides** - Environment-specific settings
- ✅ **Type safety** - TypeScript + Zod runtime validation

**Key Principle**: **DO NOT edit `default.ts` directly**. Edit domain-specific files instead.

---

## Architecture

### File Structure

```
config/
├── README.md                   # This file
├── types.ts                    # TypeScript interfaces (centralized)
├── schema.ts                   # Zod validation schemas (centralized)
├── default.ts                  # Aggregates configs (DO NOT EDIT)
│
├── service.ts                  # Service metadata
├── database.ts                 # Database configuration
├── api.ts                      # API Gateway configuration
├── resources.ts                # Resource naming
├── features.ts                 # Feature toggles
├── github.ts                   # GitHub/CI configuration
├── aws.ts                      # AWS settings
│
├── localstack.ts               # LocalStack overrides
├── staging.ts                  # Staging overrides
└── production.ts               # Production overrides
```

### Configuration Flow

```
Domain-Specific Configs
    ↓
Partial Validation (per domain)
    ↓
default.ts (aggregates)
    ↓
Environment Overrides (localstack.ts, staging.ts, production.ts)
    ↓
Final Validation (schema.ts)
    ↓
IConfig Object (exported)
```

---

## Validation Strategy

We use a **dual-layer validation strategy** for early error detection and comprehensive validation.

### Layer 1: Partial Validation (Domain-Specific Files)

**Purpose**: Catch errors in individual configs immediately during module loading.

**Location**: Each domain-specific config file (`service.ts`, `resources.ts`, etc.)

**Pattern**:

```typescript
// config/service.ts
import { z } from "zod";

const ServiceConfigSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  displayName: z.string().min(1, "Service display name is required"),
});

const rawServiceConfig = {
  name: process.env.SERVICE_NAME || "svc-merchants",
  displayName: process.env.SERVICE_DISPLAY_NAME || "Merchants Microservice",
};

// Validate immediately
const result = ServiceConfigSchema.safeParse(rawServiceConfig);
if (!result.success) {
  throw new Error(`Invalid service configuration: ${result.error...}`);
}

export const serviceConfig = result.data;
```

**Benefits**:

- ✅ **Early detection**: Errors caught when config file is imported
- ✅ **Clear error messages**: Know exactly which config file has the issue
- ✅ **Fast feedback**: No need to wait for full config merge

**Files with Partial Validation**:

- `service.ts` - Service name and display name
- `resources.ts` - Resource prefixes (table, bucket, function, API)
- `features.ts` - Feature flags
- `github.ts` - GitHub repository and CodeStar connection
- `aws.ts` - AWS region and profile

### Layer 2: Final Validation (Centralized Schema)

**Purpose**: Validate the complete merged configuration with all environment overrides applied.

**Location**: `config/schema.ts`

**Pattern**:

```typescript
// config/schema.ts
import { z } from "zod";

export const ConfigSchema = z
  .object({
    envName: z.string().min(1),
    accountId: z.string().min(1),
    region: z.string().min(1),
    service: z.object({
      name: z.string().min(1),
      displayName: z.string().min(1),
    }),
    database: z.object({
      /* ... */
    }),
    api: z.object({
      /* ... */
    }),
    // ... all fields
  })
  .refine((cfg) => cfg.envName === "local" || !!cfg.github?.repo, {
    path: ["github", "repo"],
    message: "github.repo is required for non-local environments",
  });
```

**Benefits**:

- ✅ **Comprehensive validation**: All fields validated together
- ✅ **Cross-config dependencies**: Can validate relationships between configs
- ✅ **Single source of truth**: One place for all validation rules
- ✅ **Type safety**: Zod infers TypeScript types

**Used in**: `config/default.ts` after merging all configs

### Why Both Layers?

| Aspect            | Partial Validation | Final Validation    |
| ----------------- | ------------------ | ------------------- |
| **When**          | Module load time   | After merge         |
| **Scope**         | Single domain      | Complete config     |
| **Purpose**       | Early detection    | Comprehensive check |
| **Error Context** | Specific file      | Full config         |
| **Dependencies**  | None               | Cross-config        |

**Example Scenario**:

1. **Partial validation** catches: Missing `SERVICE_NAME` environment variable
   - Error: `"Invalid service configuration: Service name is required"`
   - Developer knows to check `config/service.ts` and `SERVICE_NAME` env var

2. **Final validation** catches: Missing GitHub config for staging environment
   - Error: `"github.repo is required for non-local environments"`
   - Developer knows to check environment-specific config and GitHub env vars

### Alternative Approaches Considered

#### ❌ Only Centralized Validation

- **Cons**: Errors only caught after full config merge
- **Cons**: Harder to debug which config file has the issue
- **Cons**: Slower feedback loop

#### ❌ Only Distributed Validation

- **Cons**: Can't validate cross-config dependencies
- **Cons**: Duplication of validation logic
- **Cons**: No single source of truth

#### ✅ Dual-Layer (Adopted)

- **Pros**: Best of both worlds
- **Pros**: Early detection + comprehensive validation
- **Pros**: Clear error messages at both levels

---

## Type System

### Centralized Types (`config/types.ts`)

**Decision**: All TypeScript interfaces are centralized in `config/types.ts`.

**Why Centralized?**

1. **Prevents Circular Dependencies**

   ```typescript
   // ✅ Good: No circular dependencies
   // config/service.ts
   import type { IServiceConfig } from "./types";

   // config/resources.ts
   import type { IResourcesConfig } from "./types";

   // config/default.ts
   import type { IConfig } from "./types";
   ```

   ```typescript
   // ❌ Bad: Circular dependencies
   // config/service.ts
   import type { IConfig } from "./default"; // Circular!

   // config/default.ts
   import { serviceConfig } from "./service"; // Circular!
   ```

2. **Single Source of Truth**
   - All interfaces defined once
   - Changes propagate automatically
   - No duplicate type definitions

3. **Easier Refactoring**
   - Change interface in one place
   - TypeScript compiler catches all usages
   - No risk of drift between files

4. **Standard TypeScript Pattern**
   - Similar to `@types/*` packages
   - Common in large TypeScript projects
   - Familiar to developers

**What's in `types.ts`?**

```typescript
// Main configuration interface
export interface IConfig {
  envName: string;
  accountId: string;
  region: string;
  service: IServiceConfig;
  database: IDatabaseConfig;
  api: IApiConfig;
  resources: IResourcesConfig;
  // ... all config domains
}

// Domain-specific interfaces
export interface IServiceConfig {
  /* ... */
}
export interface IResourcesConfig {
  /* ... */
}
export interface IFeaturesConfig {
  /* ... */
}
// ... etc.
```

**Alternative Considered**: Types in individual files

- ❌ Would cause circular dependencies
- ❌ Would duplicate type definitions
- ❌ Harder to maintain consistency
- ❌ More complex import graph

---

## Configuration Files

### Core Files

#### `types.ts` - TypeScript Interfaces

**Purpose**: Central location for all configuration type definitions.

**Contains**:

- `IConfig` - Main configuration interface
- `IServiceConfig` - Service metadata
- `IDatabaseConfig` - Database configuration
- `IApiConfig` - API Gateway configuration
- `IResourcesConfig` - Resource naming
- `IFeaturesConfig` - Feature toggles
- `IGitHubConfig` - GitHub/CI configuration
- `IAwsConfig` - AWS settings
- `IEndpointsConfig` - Service endpoints (LocalStack)
- `IDevelopmentConfig` - Development settings

**Usage**:

```typescript
import type { IConfig, IServiceConfig } from "#config/types";
```

#### `schema.ts` - Zod Validation Schemas

**Purpose**: Runtime validation of the complete merged configuration.

**Contains**:

- `ConfigSchema` - Main Zod schema for `IConfig`
- Validates all required fields
- Enforces environment-specific requirements
- Validates cross-config dependencies

**Usage**:

```typescript
import { ConfigSchema } from "#config/schema";

const result = ConfigSchema.safeParse(config);
if (!result.success) {
  throw new Error(`Invalid configuration: ${result.error}`);
}
```

#### `default.ts` - Configuration Aggregator

**Purpose**: Aggregates domain-specific configs and applies environment overrides.

**⚠️ IMPORTANT: DO NOT EDIT THIS FILE DIRECTLY!**

**What it does**:

1. Imports domain-specific configs
2. Creates default config from domain configs
3. Applies environment-specific overrides
4. Validates final config with Zod
5. Exports validated config

**Usage**:

```typescript
import config from "#config/default";

const { envName, service, database } = config;
```

### Domain-Specific Files

#### `service.ts` - Service Metadata

**Purpose**: Service name and display name.

**Environment Variables**:

- `SERVICE_NAME` - Technical service name (used in resource naming)
- `SERVICE_DISPLAY_NAME` - Human-readable service name

**Example**:

```typescript
export const serviceConfig: IServiceConfig = {
  name: process.env.SERVICE_NAME || "svc-merchants",
  displayName: process.env.SERVICE_DISPLAY_NAME || "Merchants Microservice",
};
```

#### `database.ts` - Database Configuration

**Purpose**: DynamoDB table definitions and database approach selection.

**Key Features**:

- Choose between Faux-SQL and Single-Table approaches
- Define table schemas (partition keys, sort keys, GSIs)
- Type-safe configuration

**See**: [Database Setup Guide](../docs/implementation/database-setup.md)

#### `api.ts` - API Gateway Configuration

**Purpose**: API Gateway REST API, CORS, stages, and authorization settings.

**Key Features**:

- REST API configuration (endpoint type, CloudWatch role)
- CORS settings (environment-specific origins)
- Stage configuration (throttling, logging, caching)
- Authorization configuration (Cognito, OAuth)

**See**: [Adding Endpoints - Part 2](../docs/implementation/adding-endpoints-part-2-api-gateway.md)

#### `resources.ts` - Resource Naming

**Purpose**: Prefixes for AWS resource names (tables, buckets, functions, APIs).

**Environment Variables**:

- `TABLE_PREFIX` - DynamoDB table prefix
- `BUCKET_PREFIX` - S3 bucket prefix
- `FUNCTION_PREFIX` - Lambda function prefix
- `API_PREFIX` - API Gateway prefix

**Default**: All prefixes default to `SERVICE_NAME`.

#### `features.ts` - Feature Toggles

**Purpose**: Feature flags for enabling/disabling functionality.

**Environment Variables**:

- `PERMISSIONS_ENABLED` - Enable OAuth permission scopes (default: false)

**Example**:

```typescript
export const featuresConfig: IFeaturesConfig = {
  permissionsEnabled: process.env.PERMISSIONS_ENABLED === "true",
};
```

#### `github.ts` - GitHub Configuration

**Purpose**: GitHub repository and CodeStar connection for CI/CD.

**Environment Variables**:

- `GITHUB_REPO` - GitHub repository (e.g., `org/repo`)
- `GITHUB_BRANCH` - Deployment branch (default: `release`)
- `CODESTAR_CONNECTION_ID` - AWS CodeStar connection ID

**Note**: Only required for non-local environments.

**Factory Function**:

```typescript
export function createGitHubConfig(envName: string): IGitHubConfig | undefined {
  // Returns undefined for local, validated config for other environments
}
```

#### `aws.ts` - AWS Configuration

**Purpose**: AWS-specific settings (region, profile).

**Environment Variables**:

- `AWS_REGION` (or `AWS_DEFAULT_REGION` / `CDK_DEFAULT_REGION`)
- `AWS_PROFILE` - AWS CLI profile (optional)

**Factory Function**:

```typescript
export function createAwsConfig(envName: string): IAwsConfig {
  // Returns validated AWS config
}
```

### Environment-Specific Files

#### `localstack.ts` - LocalStack Overrides

**Purpose**: Configuration for running against LocalStack (local AWS emulator).

**Key Overrides**:

- `endpoints` - All AWS services point to `http://localhost:4566`
- `development` - Debug logs enabled, faster timeouts

#### `staging.ts` - Staging Overrides

**Purpose**: Configuration for staging/pre-production environment.

**Characteristics**:

- Minimal overrides (inherits most from `default.ts`)
- Uses real AWS services

#### `production.ts` - Production Overrides

**Purpose**: Configuration for production environment.

**Characteristics**:

- Minimal overrides (inherits most from `default.ts`)
- Stricter validation
- Production-grade timeouts

---

## Adding New Configuration

### For Domain-Specific Configuration

**Step 1**: Create new config file

```typescript
// config/my-feature.ts
import { z } from "zod";
import type { IMyFeatureConfig } from "./types";

const MyFeatureConfigSchema = z.object({
  enabled: z.boolean(),
  timeout: z.number().int().positive(),
});

const rawConfig: IMyFeatureConfig = {
  enabled: process.env.MY_FEATURE_ENABLED === "true",
  timeout: parseInt(process.env.MY_FEATURE_TIMEOUT || "30", 10),
};

const result = MyFeatureConfigSchema.safeParse(rawConfig);
if (!result.success) {
  throw new Error(`Invalid my-feature configuration: ${result.error...}`);
}

export const myFeatureConfig: IMyFeatureConfig = result.data;
```

**Step 2**: Add interface to `types.ts`

```typescript
// config/types.ts
export interface IMyFeatureConfig {
  readonly enabled: boolean;
  readonly timeout: number;
}

export interface IConfig {
  // ... existing fields
  myFeature: IMyFeatureConfig;
}
```

**Step 3**: Add to Zod schema in `schema.ts`

```typescript
// config/schema.ts
export const ConfigSchema = z.object({
  // ... existing fields
  myFeature: z.object({
    enabled: z.boolean(),
    timeout: z.number().int().positive(),
  }),
});
```

**Step 4**: Import in `default.ts`

```typescript
// config/default.ts
import { myFeatureConfig } from "./my-feature";

function createDefaultConfig(envName: string): IConfig {
  return {
    // ... existing fields
    myFeature: myFeatureConfig,
  };
}
```

### For Environment-Specific Configuration

Add overrides to environment files:

```typescript
// config/production.ts
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  myFeature: {
    enabled: true,
    timeout: 60,
  },
};
```

---

## Best Practices

### 1. Use Modular Config Files

✅ **Good** - Edit domain-specific files:

```typescript
// config/service.ts
export const serviceConfig: IServiceConfig = {
  name: process.env.SERVICE_NAME || "svc-merchants",
};
```

❌ **Bad** - Edit default.ts directly:

```typescript
// config/default.ts - DON'T DO THIS!
const defaultConfig: IConfig = {
  service: { name: "svc-merchants" }, // Don't edit here!
};
```

### 2. Environment Variables Over Hardcoded Values

✅ **Good**:

```typescript
name: process.env.SERVICE_NAME || "svc-merchants";
```

❌ **Bad**:

```typescript
name: "svc-merchants"; // Hardcoded!
```

### 3. Validate Early

✅ **Good** - Validate in domain-specific file:

```typescript
const result = ConfigSchema.safeParse(rawConfig);
if (!result.success) {
  throw new Error(`Invalid config: ${result.error...}`);
}
```

❌ **Bad** - No validation:

```typescript
export const config = rawConfig; // No validation!
```

### 4. Use Readonly for Immutability

✅ **Good**:

```typescript
export interface IServiceConfig {
  readonly name: string;
  readonly displayName: string;
}
```

❌ **Bad**:

```typescript
export interface IServiceConfig {
  name: string; // Mutable!
  displayName: string;
}
```

### 5. Provide Sensible Defaults

✅ **Good**:

```typescript
name: process.env.SERVICE_NAME || "svc-merchants";
```

❌ **Bad**:

```typescript
name: process.env.SERVICE_NAME; // Undefined if not set!
```

### 6. Fail Fast for Required Values

✅ **Good**:

```typescript
const serviceName = process.env.SERVICE_NAME;
if (!serviceName) {
  throw new Error("SERVICE_NAME is required");
}
```

❌ **Bad**:

```typescript
const serviceName = process.env.SERVICE_NAME || ""; // Empty string!
```

---

## Related Documentation

### Related Implementation Guides

- **[Database Setup](../database-setup.md)** - Database configuration details
- **[Adding Endpoints - Part 2](../adding-endpoints-part-2-api-gateway.md)** - API Gateway configuration
- **[Environment Variables](../environment-variables.md)** - CDK vs Lambda contexts

### Testing Documentation

The configuration system follows the **consolidated testing documentation strategy**:

- **Implementation guides** (e.g., `adding-endpoints-part-1-lambda-handlers.md`) provide:
  - Brief "What to Test" sections
  - Quick example patterns
  - **References to detailed testing guides**

- **Detailed testing guides** (`docs/testing/*.md`) provide:
  - Comprehensive "How to Test" instructions
  - Multiple examples and edge cases
  - Best practices and patterns

**See**:

- [Testing Strategy](../docs/testing/testing-strategy.md) - Overall testing approach
- [CDK Template Testing Guide](../docs/testing/cdk-template-testing-guide.md) - Infrastructure testing
- [Handler Testing Guide](../docs/testing/handler-testing-guide.md) - Lambda handler testing

This approach prevents duplication and ensures testing guidance stays synchronized.

---

## Summary

The configuration system provides:

- ✅ **Modular**: Each concern in its own file
- ✅ **Type-safe**: TypeScript + Zod validation
- ✅ **Validated**: Dual-layer validation (partial + final)
- ✅ **Flexible**: Environment variables + defaults + overrides
- ✅ **Centralized types**: No circular dependencies
- ✅ **Developer-friendly**: Clear error messages and documentation

**Remember**: Edit domain-specific files, not `default.ts`!
