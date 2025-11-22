# Environment Configuration Guide

Guide for configuring environment-specific settings (local, staging, production).

**Files**: `config/localstack.ts`, `config/staging.ts`, `config/production.ts`

---

## Overview

Environment configuration provides **environment-specific overrides** for base configuration:

- **LocalStack** (`config/localstack.ts`) - Local development with AWS emulator
- **Staging** (`config/staging.ts`) - Pre-production environment
- **Production** (`config/production.ts`) - Production environment

---

## How It Works

### Configuration Flow

```
1. Domain configs loaded (service.ts, database.ts, etc.)
   ↓
2. Base config created (default.ts aggregates domain configs)
   ↓
3. Environment override applied (localstack.ts, staging.ts, production.ts)
   ↓
4. Final validation (schema.ts)
   ↓
5. Validated config exported
```

### Environment Selection

Environment is determined by `ENV_NAME` environment variable:

```typescript
const envName = process.env.ENV_NAME || "local";

// Load appropriate override
const envConfigs = {
  local: localstackConfig,
  staging: stagingConfig,
  production: productionConfig,
};

const envConfig = envConfigs[envName] || {};
```

---

## LocalStack Configuration

**File**: `config/localstack.ts`

**Purpose**: Override AWS endpoints to point to LocalStack for local development.

```typescript
import type { IConfig } from "./types";

export const localstackConfig: Partial<IConfig> = {
  envName: "local",

  // Point all AWS services to LocalStack
  endpoints: {
    dynamodb: "http://localhost:4566",
    s3: "http://localhost:4566",
    sns: "http://localhost:4566",
    sqs: "http://localhost:4566",
    ses: "http://localhost:4566",
    ssm: "http://localhost:4566",
    cognito: "http://localhost:4566",
  },

  // Development-friendly settings
  development: {
    enableDebugLogs: true,
    disableXRay: true,
    reducedTimeouts: true,
  },
};
```

### LocalStack Endpoints

All AWS SDK calls are redirected to `http://localhost:4566`:

```typescript
// In CDK constructs
const table = new Table(this, "Table", {
  // ... config
});

// In Lambda handlers (via environment variables)
const ddbClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT, // http://localhost:4566
});
```

### Development Settings

- **Debug logs**: Enabled for verbose output
- **X-Ray**: Disabled (not needed locally)
- **Timeouts**: Reduced for faster feedback

---

## Staging Configuration

**File**: `config/staging.ts`

**Purpose**: Pre-production environment configuration.

```typescript
import type { IConfig } from "./types";

export const stagingConfig: Partial<IConfig> = {
  envName: "staging",

  // Staging-specific overrides (if any)
  // Most settings inherit from default.ts
};
```

### Characteristics

- ✅ Uses real AWS services (not LocalStack)
- ✅ Inherits most settings from `default.ts`
- ✅ Minimal overrides (only what's different)
- ✅ Similar to production but separate resources

### When to Override

Override in staging when you need:

- Different API rate limits
- Different database capacity
- Different monitoring thresholds
- Testing-specific features

---

## Production Configuration

**File**: `config/production.ts`

**Purpose**: Production environment configuration.

```typescript
import type { IConfig } from "./types";

export const productionConfig: Partial<IConfig> = {
  envName: "production",

  // Production-specific overrides (if any)
  // Most settings inherit from default.ts
};
```

### Characteristics

- ✅ Uses real AWS services
- ✅ Inherits most settings from `default.ts`
- ✅ Minimal overrides
- ✅ Production-grade settings

### When to Override

Override in production when you need:

- Higher API rate limits
- Increased database capacity
- Stricter monitoring thresholds
- Production-only features

---

## Environment Variables

### `ENV_NAME`

**Purpose**: Determines which environment configuration to load

**Required**: No (defaults to `"local"`)

**Values**: `"local"` | `"staging"` | `"production"`

**Example**: `ENV_NAME=staging`

**Used In**:

- Configuration loading (`config/default.ts`)
- Resource naming (stack names, resource prefixes)
- Conditional logic (deletion protection, logging levels)

---

## Usage

### Setting Environment

#### Local Development

```bash
# .env file
ENV_NAME=local
```

#### Staging Deployment

```bash
# CI/CD pipeline
export ENV_NAME=staging
cdk deploy
```

#### Production Deployment

```bash
# CI/CD pipeline
export ENV_NAME=production
cdk deploy
```

### Accessing in Code

```typescript
import config from "#config/default";

const envName = config.envName; // "local" | "staging" | "production"

// Conditional logic based on environment
if (envName === "production") {
  // Production-specific logic
}
```

---

## Adding Environment-Specific Overrides

### Step 1: Identify What to Override

Only override what's **different** from the base configuration:

```typescript
// ✅ Good - Override only what's different
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  api: {
    stages: [
      {
        throttling: {
          rateLimit: 10000, // Higher than default
          burstLimit: 5000,
        },
      },
    ],
  },
};

// ❌ Bad - Don't duplicate base config
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  service: { name: "svc-merchants" }, // Already in default.ts!
  // ... duplicating everything
};
```

### Step 2: Add Override

```typescript
// config/production.ts
export const productionConfig: Partial<IConfig> = {
  envName: "production",

  // Override specific settings
  api: {
    stages: [
      {
        throttling: {
          rateLimit: 10000,
          burstLimit: 5000,
        },
      },
    ],
  },
};
```

### Step 3: Test

```bash
# Test production config
ENV_NAME=production npm run build

# Verify override applied
ENV_NAME=production cdk synth
```

---

## Best Practices

### 1. Minimal Overrides

✅ **Good** - Override only what's different:

```typescript
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  api: {
    stages: [{ throttling: { rateLimit: 10000 } }],
  },
};
```

❌ **Bad** - Duplicating base config:

```typescript
export const productionConfig: Partial<IConfig> = {
  envName: "production",
  service: { name: "svc-merchants" }, // Duplicate!
  database: {
    /* ... */
  }, // Duplicate!
  // ...
};
```

### 2. Use Partial<IConfig>

```typescript
// ✅ Good - Partial allows overriding subset
export const stagingConfig: Partial<IConfig> = {
  envName: "staging",
};

// ❌ Bad - Full IConfig requires all fields
export const stagingConfig: IConfig = {
  envName: "staging",
  // Error: Missing required fields!
};
```

### 3. Document Why You Override

```typescript
export const productionConfig: Partial<IConfig> = {
  envName: "production",

  // Higher rate limits for production traffic
  api: {
    stages: [
      {
        throttling: {
          rateLimit: 10000, // 10x default for production load
          burstLimit: 5000,
        },
      },
    ],
  },
};
```

### 4. Keep LocalStack Separate

LocalStack config should only contain:

- Endpoint overrides
- Development settings

Don't mix with staging/production overrides.

---

## Troubleshooting

### Error: "Invalid environment name"

**Cause**: `ENV_NAME` is set to an unsupported value.

**Solution**: Use `"local"`, `"staging"`, or `"production"`.

### LocalStack Connection Refused

**Cause**: LocalStack is not running or wrong endpoint.

**Solution**:

```bash
# Start LocalStack
docker-compose -f docker-compose.localstack.yml up -d

# Verify endpoint
curl http://localhost:4566/_localstack/health
```

### Override Not Applied

**Cause**: Environment variable not set or wrong environment selected.

**Solution**:

```bash
# Check environment
echo $ENV_NAME

# Set environment
export ENV_NAME=staging
```

---

## Related Configuration

- [Service Configuration](./service-configuration.md) - Service metadata
- [Database Configuration](./database-configuration.md) - Database settings
- [API Configuration](./api-configuration.md) - API Gateway settings

---

## Related Guides

- [Configuration Management README](./README.md) - Overview and architecture
- [LocalStack Setup](../localstack-setup.md) - Setting up LocalStack for local development
