# Configuration Management Guide

This guide explains how to configure your microservice for different environments (local, staging, production) using the centralized configuration system.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Configuration Structure](#2-configuration-structure)
   - 2.1. [Core Configuration Interface (`IConfig`)](#21-core-configuration-interface-iconfig)
3. [Configuration Files](#3-configuration-files)
   - 3.1. [`.env` and `.env.example` - Environment Variables](#31-env-and-envexample---environment-variables)
     - 3.1.1. [`.env.example` (Template)](#311-envexample-template)
     - 3.1.2. [`.env` (Actual Values)](#312-env-actual-values)
     - 3.1.3. [Setup Workflow](#313-setup-workflow)
     - 3.1.4. [Security Best Practices](#314-security-best-practices)
     - 3.1.5. [Relationship to Config System](#315-relationship-to-config-system)
   - 3.2. [`config/default.ts` - Base Configuration](#32-configdefaultts---base-configuration)
   - 3.3. [`config/localstack.ts` - Local Development](#33-configlocalstackts---local-development)
   - 3.4. [`config/staging.ts` - Staging Environment](#34-configstagingts---staging-environment)
   - 3.5. [`config/production.ts` - Production Environment](#35-configproductionts---production-environment)
   - 3.6. [`config/database.ts` - Database Configuration](#36-configdatabasets---database-configuration)
4. [Environment Variables](#4-environment-variables)
   - 4.1. [Required for All Environments](#41-required-for-all-environments)
   - 4.2. [Required for Deployed Environments (Staging/Production)](#42-required-for-deployed-environments-stagingproduction)
   - 4.3. [Optional](#43-optional)
5. [Configuration Usage in Code](#5-configuration-usage-in-code)
   - 5.1. [In CDK Constructs](#51-in-cdk-constructs)
   - 5.2. [In Lambda Handlers](#52-in-lambda-handlers)
6. [Configuration Validation](#6-configuration-validation)
   - 6.1. [Zod Schema](#61-zod-schema)
7. [Configuration Workflow](#7-configuration-workflow)
   - 7.1. [Local Development](#71-local-development)
   - 7.2. [Staging/Production Deployment](#72-stagingproduction-deployment)
8. [Adding New Configuration](#8-adding-new-configuration)
   - 8.1. [Add to `IConfig` Interface](#81-add-to-iconfig-interface)
   - 8.2. [Add to Zod Schema](#82-add-to-zod-schema)
   - 8.3. [Add Default Value](#83-add-default-value)
   - 8.4. [Override in Environment Configs (if needed)](#84-override-in-environment-configs-if-needed)
9. [Best Practices](#9-best-practices)
   - 9.1. [Environment Variables Over Hardcoded Values](#91-environment-variables-over-hardcoded-values)
   - 9.2. [Sensible Defaults](#92-sensible-defaults)
   - 9.3. [Fail Fast for Required Values](#93-fail-fast-for-required-values)
   - 9.4. [Use Partial<IConfig> for Overrides](#94-use-partialiconfig-for-overrides)
   - 9.5. [Validate with Zod](#95-validate-with-zod)
   - 9.6. [Don't Import Config in Handlers](#96-dont-import-config-in-handlers)
   - 9.7. [Use SSM for Service Discovery](#97-use-ssm-for-service-discovery)
10. [Troubleshooting](#10-troubleshooting)
    - 10.1. [Configuration Validation Errors](#101-configuration-validation-errors)
    - 10.2. [Missing AWS Credentials](#102-missing-aws-credentials)
    - 10.3. [LocalStack Connection Issues](#103-localstack-connection-issues)
    - 10.4. [Zod Validation Errors](#104-zod-validation-errors)
11. [Related Guides](#11-related-guides)
12. [Summary](#12-summary)

---

## 1. Overview

The microservice uses a **layered configuration approach**:

1. **Base Configuration** (`config/default.ts`) - Default values for all environments
2. **Environment Overrides** (`config/{env}.ts`) - Environment-specific overrides
3. **Runtime Variables** (Environment variables) - Dynamic values at deployment time
4. **Specialized Configs** (e.g., `config/database.ts`) - Domain-specific configuration

---

## 2. Configuration Structure

### 2.1. Core Configuration Interface (`IConfig`)

```typescript
export interface IConfig {
  // Environment identification
  envName: string; // "local" | "staging" | "production"
  accountId: string; // AWS account ID
  region: string; // AWS region (e.g., "us-east-1")

  // Service metadata
  service: {
    name: string; // Service name (e.g., "svc-merchants")
    displayName: string; // Human-readable name
  };

  // Database configuration
  database: IDatabaseConfig; // See database-setup.md

  // GitHub/CI-CD configuration
  github?: {
    repo: string; // GitHub repository
    branch: string; // Deployment branch
    codestarConnectionId: string; // AWS CodeStar connection
  };

  // AWS configuration
  aws?: {
    region: string; // AWS region override
    profile?: string; // AWS CLI profile (local dev)
  };

  // Service endpoints (LocalStack override)
  endpoints?: {
    dynamodb?: string; // DynamoDB endpoint URL
    s3?: string; // S3 endpoint URL
    // ... other AWS service endpoints
  };

  // Resource naming
  resources: {
    tablePrefix: string; // DynamoDB table prefix
    bucketPrefix: string; // S3 bucket prefix
    functionPrefix: string; // Lambda function prefix
    apiPrefix: string; // API Gateway prefix
  };

  // Feature toggles
  features?: {
    permissionsEnabled: boolean; // Enable/disable auth
  };

  // Development settings
  development?: {
    enableDebugLogs?: boolean;
    lambdaTimeout?: number;
    enableHotReload?: boolean;
    skipValidations?: boolean;
  };
}
```

---

## 3. Configuration Files

### 3.1. `.env` and `.env.example` - Environment Variables

**Purpose**: Store environment-specific values for local development.

#### 3.1.1. `.env.example` (Template)

**Location**: Root of microservice project  
**Purpose**: Template file committed to git, shows required variables  
**Usage**: Copy to `.env` when bootstrapping from template

**Content**:

```bash
# Environment Configuration
ENV_NAME=environment-name - used for resource naming and API path prefix e.g. local, dev, staging, prod
APP_BASE_PATH=your-app-name - used for API path prefix e.g. smw

# Service Configuration
SERVICE_NAME=your-service-name - used for resource naming and API path prefix
SERVICE_DISPLAY_NAME=Your Service Display Name - used for display purposes

# Repository Configuration (for CI/CD)
GITHUB_REPO=your-org/your-repo
GITHUB_BRANCH=branch-name - used for CI/CD pipeline e.g. main/master, release

# AWS Configuration - Don't put static AWS credentials in .env; prefer an AWS profile/SSO (for organizations)
AWS_PROFILE=your-aws-profile-name
AWS_DEFAULT_REGION=region-name - e.g. us-east-1, us-west-2

# CodeStar Connection for GitHub integration - Get this ID after creating a CodeStar connection in AWS Console
CODESTAR_CONNECTION_ID=your-codestar-connection-id - used for GitHub repository integration

# Application Configuration - Add any application-specific environment variables here. For example:
# API_URL=http://localhost:3000
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Additional notes:
# - Resource naming is derived from SERVICE_NAME
# - Parameter Store base path is derived from APP_BASE_PATH (defaults handled in code)
# - The .env file is ignored by .gitignore, so it's safe to store environment-specific values here
# - For production deployments, use AWS Secrets Manager or Parameter Store instead of .env
```

**Notes**:

- Use descriptive placeholder values with examples
- Include comments explaining each variable's purpose
- Don't include actual credentials or sensitive values
- This file is committed to git

#### 3.1.2. `.env` (Actual Values)

**Location**: Root of microservice project  
**Purpose**: Contains actual environment-specific values  
**Usage**: Created by copying `.env.example` and filling in real values

**Example for `svc-merchants`**:

```bash
# Environment Configuration
ENV_NAME=dev
APP_BASE_PATH=/smw

# Service Configuration
SERVICE_NAME=svc-merchants
SERVICE_DISPLAY_NAME=Merchants Microservice

# Repository Configuration (for CI/CD)
GITHUB_REPO=nickthiru3/smw-svc-merchants
GITHUB_BRANCH=main

# AWS Configuration
AWS_PROFILE=smw-dev
AWS_DEFAULT_REGION=us-east-1

# CodeStar Connection for GitHub integration
# CODESTAR_CONNECTION_ID=your-codestar-connection-id

# Application Configuration
# Add any application-specific environment variables here
```

**Notes**:

- This file is **ignored by git** (in `.gitignore`)
- Contains actual values for your environment
- Never commit this file to version control
- For AWS credentials, prefer AWS profiles/SSO over hardcoded keys

#### 3.1.3. Setup Workflow

**When Bootstrapping from Template**:

1. **Copy template**:

   ```bash
   cp .env.example .env
   ```

2. **Update values** in `.env`:
   - Set `SERVICE_NAME` to your microservice name
   - Set `SERVICE_DISPLAY_NAME` to human-readable name
   - Set `GITHUB_REPO` to your repository
   - Set `AWS_PROFILE` to your AWS CLI profile name
   - Set `AWS_DEFAULT_REGION` to your preferred region
   - Update `APP_BASE_PATH` if needed

3. **Verify**:

   ```bash
   cat .env | grep SERVICE_NAME
   # Should show: SERVICE_NAME=your-service-name
   ```

4. **Load in CDK** (handled automatically):
   - `bin/app.ts` calls `dotenv.config()` at startup
   - Loads `.env` into `process.env`
   - Config object reads from `process.env`

#### 3.1.4. Security Best Practices

✅ **DO**:

- Use `.env` for local development configuration
- Keep `.env.example` up to date with required variables
- Use AWS profiles/SSO for credentials (not hardcoded keys)
- Document each variable's purpose in comments

❌ **DON'T**:

- Commit `.env` to git (ensure it's in `.gitignore`)
- Store production secrets in `.env` (use AWS Secrets Manager)
- Hardcode AWS credentials (use `aws configure` or SSO)
- Share your `.env` file with others

#### 3.1.5. Relationship to Config System

```
.env file
    ↓
dotenv.config() (in bin/app.ts)
    ↓
process.env
    ↓
config/default.ts (reads process.env)
    ↓
IConfig object
    ↓
CDK constructs (use config object)
```

**See**: [Environment Variables Guide](./environment-variables.md) for comprehensive details on environment variable usage in CDK vs Lambda contexts.

---

### 3.2. `config/default.ts` - Base Configuration

**Purpose**: Defines default values and loads environment-specific overrides.

**Key Features**:

- Defines `IConfig` interface (single source of truth)
- Provides sensible defaults for all environments
- Loads environment-specific config based on `ENV_NAME`
- Validates configuration with Zod schema
- Reads from environment variables with fallbacks

**Environment Variable Resolution**:

```typescript
// Example: AWS Account ID resolution
accountId:
  process.env.AWS_ACCOUNT_ID ||
  process.env.CDK_DEFAULT_ACCOUNT ||
  (envName === "local" ? "000000000000" : throw Error)
```

**Configuration Loading**:

```typescript
function loadConfig(): IConfig {
  const envName = process.env.ENV_NAME || "local";

  // Load environment-specific overrides
  let envConfig: Partial<IConfig> = {};
  switch (envName) {
    case "localstack":
      envConfig = localstackConfig;
      break;
    case "staging":
      envConfig = stagingConfig;
      break;
    case "production":
      envConfig = productionConfig;
      break;
  }

  // Merge with defaults
  const config = { ...defaultConfig, ...envConfig };

  // Validate with Zod
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error}`);
  }

  return result.data;
}
```

---

### 3.3. `config/localstack.ts` - Local Development

**Purpose**: Configuration for running against LocalStack (local AWS emulator).

**Key Overrides**:

- `envName: "localstack"`
- `region: "us-east-1"` (LocalStack default)
- `endpoints`: All AWS services point to `http://localhost:4566`
- `resources`: Simple naming (no account separation needed)
- `development`: Debug logs enabled, faster timeouts

**Example**:

```typescript
export const localstackConfig: Partial<IConfig> = {
  envName: "localstack",
  region: "us-east-1",

  endpoints: {
    dynamodb: "http://localhost:4566",
    s3: "http://localhost:4566",
    lambda: "http://localhost:4566",
    // ... all services point to LocalStack
  },

  resources: {
    tablePrefix: "localstack-merchants",
    bucketPrefix: "localstack-merchants",
    functionPrefix: "localstack-merchants",
    apiPrefix: "localstack-merchants",
  },

  development: {
    enableDebugLogs: true,
    lambdaTimeout: 30,
    enableHotReload: true,
    skipValidations: true,
  },
};
```

---

### 3.4. `config/staging.ts` - Staging Environment

**Purpose**: Configuration for staging/pre-production environment.

**Key Characteristics**:

- Minimal overrides (inherits most from `default.ts`)
- Uses real AWS services (not LocalStack)
- Environment variables provide account ID, region, GitHub config

**Example**:

```typescript
export const stagingConfig: Partial<IConfig> = {
  envName: "staging",
  // Most values come from default.ts + environment variables
  // Add staging-specific overrides here if needed
};
```

---

### 3.5. `config/production.ts` - Production Environment

**Purpose**: Configuration for production environment.

**Key Characteristics**:

- Minimal overrides (inherits most from `default.ts`)
- Stricter validation (no `skipValidations`)
- Production-grade timeouts and settings

**Example**:

```typescript
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  // Most values come from default.ts + environment variables
  // Add production-specific overrides here if needed
};
```

---

### 3.6. `config/database.ts` - Database Configuration

**Purpose**: Centralized DynamoDB table definitions and database approach selection.

**See**: [Database Setup Guide](./database-setup.md) for detailed documentation.

**Key Features**:

- Choose between Faux-SQL and Single-Table approaches
- Define table schemas (partition keys, sort keys, GSIs)
- Type-safe configuration with TypeScript interfaces

---

## 4. Environment Variables

### 4.1. Required for All Environments

| Variable         | Description      | Example                          |
| ---------------- | ---------------- | -------------------------------- |
| `ENV_NAME`       | Environment name | `local`, `staging`, `production` |
| `AWS_ACCOUNT_ID` | AWS account ID   | `123456789012`                   |
| `AWS_REGION`     | AWS region       | `us-east-1`                      |
| `SERVICE_NAME`   | Service name     | `svc-merchants`                  |

### 4.2. Required for Deployed Environments (Staging/Production)

| Variable                 | Description             | Example                            |
| ------------------------ | ----------------------- | ---------------------------------- |
| `GITHUB_REPO`            | GitHub repository       | `nickthiru/smw-svc-merchants`      |
| `GITHUB_BRANCH`          | Deployment branch       | `main`, `release`                  |
| `CODESTAR_CONNECTION_ID` | AWS CodeStar connection | `arn:aws:codestar-connections:...` |

### 4.3. Optional

| Variable               | Description         | Default                |
| ---------------------- | ------------------- | ---------------------- |
| `SERVICE_DISPLAY_NAME` | Human-readable name | Same as `SERVICE_NAME` |
| `AWS_PROFILE`          | AWS CLI profile     | None                   |
| `AWS_DEFAULT_REGION`   | Fallback region     | None                   |

---

## 5. Configuration Usage in Code

### 5.1. In CDK Constructs

```typescript
import config from "#config/default";

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Access config values
    const { envName, service, database } = config;

    // Use in constructs
    const db = new DatabaseConstruct(this, "Database", { config });
  }
}
```

### 5.2. In Lambda Handlers

**Don't use `config` directly in handlers!** Instead:

1. **Pass values via environment variables** (set in construct)
2. **Use SSM Parameter Store** for service discovery
3. **Use Secrets Manager** for sensitive values

**Example** (in construct):

```typescript
const lambda = new NodejsFunction(this, "Handler", {
  entry: "src/handlers/merchants/get/handler.ts",
  environment: {
    TABLE_NAME: db.tables.get("Merchants").tableName,
    ENV_NAME: config.envName,
    REGION: config.region,
  },
});
```

**Example** (in handler):

```typescript
// ✅ Good - Read from environment variables
const tableName = process.env.TABLE_NAME;
const envName = process.env.ENV_NAME;

// ❌ Bad - Don't import config in handlers
// import config from "#config/default"; // NO!
```

---

## 6. Configuration Validation

### 6.1. Zod Schema

The configuration is validated at runtime using Zod:

```typescript
const ConfigSchema = z.object({
  envName: z.string().min(1),
  accountId: z.string().min(1),
  region: z.string().min(1),
  service: z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
  }),
  database: z.object({
    approach: z.enum(["faux-sql", "single-table"]),
    // ... database schema
  }),
  // ... other fields
});
```

**Benefits**:

- Type-safe configuration at runtime
- Clear error messages for invalid config
- Prevents deployment with missing/invalid values

---

## 7. Configuration Workflow

### 7.1. Local Development

1. **Set environment variables** (or use defaults):

   ```bash
   export ENV_NAME=local
   export AWS_ACCOUNT_ID=000000000000
   export AWS_REGION=us-east-1
   export SERVICE_NAME=svc-merchants
   ```

2. **Run LocalStack** (if needed):

   ```bash
   docker-compose up -d localstack
   ```

3. **Deploy to LocalStack**:
   ```bash
   npm run deploy:local
   ```

### 7.2. Staging/Production Deployment

1. **Set environment variables** in CI/CD pipeline:
   - `ENV_NAME=staging` or `ENV_NAME=production`
   - `AWS_ACCOUNT_ID` (from AWS Secrets Manager)
   - `AWS_REGION`
   - `GITHUB_REPO`, `GITHUB_BRANCH`, `CODESTAR_CONNECTION_ID`

2. **Deploy via CI/CD**:
   ```bash
   npm run deploy:staging  # or deploy:production
   ```

---

## 8. Adding New Configuration

### 8.1. Add to `IConfig` Interface

```typescript
export interface IConfig {
  // ... existing fields

  // New field
  myNewFeature?: {
    enabled: boolean;
    timeout: number;
  };
}
```

### 8.2. Add to Zod Schema

```typescript
const ConfigSchema = z.object({
  // ... existing fields

  myNewFeature: z
    .object({
      enabled: z.boolean(),
      timeout: z.number().int().positive(),
    })
    .optional(),
});
```

### 8.3. Add Default Value

```typescript
const defaultConfig: IConfig = {
  // ... existing fields

  myNewFeature: {
    enabled: false,
    timeout: 30,
  },
};
```

### 8.4. Override in Environment Configs (if needed)

```typescript
// config/production.ts
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  myNewFeature: {
    enabled: true,
    timeout: 60,
  },
};
```

---

## 9. Best Practices

### 9.1. Environment Variables Over Hardcoded Values

✅ **Good**:

```typescript
accountId: process.env.AWS_ACCOUNT_ID || "000000000000";
```

❌ **Bad**:

```typescript
accountId: "123456789012"; // Hardcoded!
```

### 9.2. Sensible Defaults

Provide defaults for local development:

```typescript
envName: process.env.ENV_NAME || "local";
```

### 9.3. Fail Fast for Required Values

Throw errors for missing required values in deployed environments:

```typescript
accountId: process.env.AWS_ACCOUNT_ID ||
  (envName === "local"
    ? "000000000000"
    : (() => {
        throw new Error("AWS_ACCOUNT_ID is required");
      })());
```

### 9.4. Use Partial<IConfig> for Overrides

Environment-specific configs should use `Partial<IConfig>`:

```typescript
const stagingConfig: Partial<IConfig> = {
  envName: "staging",
  // Only override what's needed
};
```

### 9.5. Validate with Zod

Always validate the final merged config:

```typescript
const result = ConfigSchema.safeParse(config);
if (!result.success) {
  throw new Error(`Invalid configuration: ${result.error}`);
}
```

### 9.6. Don't Import Config in Handlers

Pass values via environment variables instead:

```typescript
// In construct
environment: {
  TABLE_NAME: db.tables.get("Merchants").tableName,
}

// In handler
const tableName = process.env.TABLE_NAME;
```

### 9.7. Use SSM for Service Discovery

For cross-service communication, use SSM Parameter Store:

```typescript
// Publish this service's config
new StringParameter(this, "ApiEndpoint", {
  parameterName: `/services/${serviceName}/${envName}/api-endpoint`,
  stringValue: api.url,
});

// Read other service's config
const userPoolId = StringParameter.valueFromLookup(
  this,
  `/services/auth/${envName}/user-pool-id`
);
```

---

## 10. Troubleshooting

### 10.1. Configuration Validation Errors

**Error**: `Invalid configuration: envName: Required`

**Solution**: Set `ENV_NAME` environment variable:

```bash
export ENV_NAME=local
```

### 10.2. Missing AWS Credentials

**Error**: `AWS account ID is required`

**Solution**: Set AWS credentials:

```bash
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1
```

### 10.3. LocalStack Connection Issues

**Error**: `Cannot connect to http://localhost:4566`

**Solution**: Start LocalStack:

```bash
docker-compose up -d localstack
```

### 10.4. Zod Validation Errors

**Error**: `database.approach: Invalid enum value`

**Solution**: Check `config/database.ts` - `approach` must be `"faux-sql"` or `"single-table"`.

---

## 11. Related Guides

- **[Database Setup](./database-setup.md)** - Configure DynamoDB tables
- **[Deployment](./deployment.md)** - Deploy to AWS environments
- **[Using Constructs](./using-constructs.md)** - Use config in CDK constructs
- **[SSM Bindings Pattern](../../../../docs/guides/patterns/ssm-bindings.md)** - Service discovery

---

## 12. Summary

The configuration system provides:

- ✅ **Type-safe** configuration with TypeScript + Zod
- ✅ **Environment-specific** overrides (local, staging, production)
- ✅ **Flexible** - Environment variables, defaults, and overrides
- ✅ **Validated** - Runtime validation prevents invalid deployments
- ✅ **Centralized** - Single source of truth for all config

**Next Steps**: See [Database Setup](./database-setup.md) to configure your DynamoDB tables.
