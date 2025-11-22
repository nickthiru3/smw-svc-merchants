# Service Configuration Guide

Guide for configuring service metadata (name, display name).

**File**: `config/service.ts`

---

## Overview

Service configuration defines the basic metadata for your microservice:

- **Service name**: Technical identifier used in resource naming
- **Display name**: Human-readable name for UI/documentation

---

## Configuration File

**Location**: `config/service.ts`

```typescript
import { z } from "zod";
import type { IServiceConfig } from "./types";

const ServiceConfigSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  displayName: z.string().min(1, "Service display name is required"),
});

const rawServiceConfig: IServiceConfig = {
  name: process.env.SERVICE_NAME || "svc-merchants",
  displayName:
    process.env.SERVICE_DISPLAY_NAME ||
    process.env.SERVICE_NAME ||
    "Merchants Microservice",
};

// Validate service config
const result = ServiceConfigSchema.safeParse(rawServiceConfig);
if (!result.success) {
  throw new Error(
    `Invalid service configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
  );
}

export const serviceConfig: IServiceConfig = result.data;
```

---

## Environment Variables

### `SERVICE_NAME`

**Purpose**: Technical service name used in resource naming

**Required**: No (has default)

**Default**: `"svc-merchants"`

**Example**: `SERVICE_NAME=svc-merchants`

**Used In**:

- CloudFormation stack names
- Resource prefixes (DynamoDB tables, Lambda functions, etc.)
- API Gateway names
- CloudWatch log groups

### `SERVICE_DISPLAY_NAME`

**Purpose**: Human-readable service name

**Required**: No (has default)

**Default**: Falls back to `SERVICE_NAME` or `"Merchants Microservice"`

**Example**: `SERVICE_DISPLAY_NAME="Merchants Microservice"`

**Used In**:

- Documentation
- UI displays
- Monitoring dashboards

---

## Usage

### In CDK Constructs

```typescript
import config from "#config/default";

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const serviceName = config.service.name;
    const displayName = config.service.displayName;

    // Use in resource names
    new RestApi(this, "RestApi", {
      restApiName: serviceName,
      description: `API Gateway for ${displayName}`,
    });
  }
}
```

### In Lambda Handlers

**Don't import config in handlers!** Use environment variables instead:

```typescript
// ❌ Bad - Don't do this
import config from "#config/default";
const serviceName = config.service.name;

// ✅ Good - Use environment variables
const serviceName = process.env.SERVICE_NAME;
```

---

## Validation

Service configuration uses **partial validation** (validated when file is imported):

```typescript
const ServiceConfigSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  displayName: z.string().min(1, "Service display name is required"),
});
```

**Error Example**:

```
Error: Invalid service configuration: Service name is required
```

---

## Best Practices

### 1. Use Environment Variables

✅ **Good**:

```typescript
name: process.env.SERVICE_NAME || "svc-merchants";
```

❌ **Bad**:

```typescript
name: "svc-merchants"; // Hardcoded!
```

### 2. Provide Sensible Defaults

✅ **Good**:

```typescript
name: process.env.SERVICE_NAME || "svc-merchants";
```

❌ **Bad**:

```typescript
name: process.env.SERVICE_NAME; // Undefined if not set!
```

### 3. Use Consistent Naming

- Service name: lowercase, hyphenated (e.g., `svc-merchants`)
- Display name: Title case (e.g., `Merchants Microservice`)

### 4. Don't Change Service Name After Deployment

Changing the service name will create new resources instead of updating existing ones!

---

## Troubleshooting

### Error: "Service name is required"

**Cause**: `SERVICE_NAME` environment variable is not set and no default is provided.

**Solution**: Set `SERVICE_NAME` environment variable or ensure default value is present.

### Resources Created with Wrong Name

**Cause**: `SERVICE_NAME` was changed after initial deployment.

**Solution**:

1. Don't change service name after deployment
2. If you must change it, manually migrate resources or redeploy

---

## Related Configuration

- [Resource Configuration](./resources-configuration.md) - Uses service name for resource prefixes
- [API Configuration](./api-configuration.md) - Uses service name for API Gateway
- [Environment Configuration](./environment-configuration.md) - Environment-specific overrides

---

## Related Guides

- [Configuration Management README](./README.md) - Overview and architecture
- [Adding New Configuration](./README.md#adding-new-configuration)
