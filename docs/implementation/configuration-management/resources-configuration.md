# Resources Configuration Guide

Guide for configuring AWS resource naming prefixes.

**File**: `config/resources.ts`

---

## Overview

Resources configuration defines prefixes for AWS resource names:

- **Table prefix**: DynamoDB tables
- **Bucket prefix**: S3 buckets
- **Function prefix**: Lambda functions
- **API prefix**: API Gateway

All prefixes default to the service name.

---

## Configuration

```typescript
export const resourcesConfig: IResourcesConfig = {
  tablePrefix: process.env.TABLE_PREFIX || getServiceName(),
  bucketPrefix: process.env.BUCKET_PREFIX || getServiceName(),
  functionPrefix: process.env.FUNCTION_PREFIX || getServiceName(),
  apiPrefix: process.env.API_PREFIX || getServiceName(),
};
```

---

## Environment Variables

### `TABLE_PREFIX`

**Purpose**: Prefix for DynamoDB table names

**Default**: Service name

**Example**: `TABLE_PREFIX=merchants`

**Result**: `merchants-Merchants`, `merchants-Users`

### `BUCKET_PREFIX`

**Purpose**: Prefix for S3 bucket names

**Default**: Service name

**Example**: `BUCKET_PREFIX=merchants`

**Result**: `merchants-uploads`, `merchants-assets`

### `FUNCTION_PREFIX`

**Purpose**: Prefix for Lambda function names

**Default**: Service name

**Example**: `FUNCTION_PREFIX=merchants`

**Result**: `merchants-GetMerchants`, `merchants-PostMerchants`

### `API_PREFIX`

**Purpose**: Prefix for API Gateway names

**Default**: Service name

**Example**: `API_PREFIX=merchants`

**Result**: `merchants-api`

---

## Usage

### In CDK Constructs

```typescript
import config from "#config/default";

// DynamoDB table
const table = new Table(this, "MerchantsTable", {
  tableName: `${config.resources.tablePrefix}-Merchants`,
});

// Lambda function
const fn = new Function(this, "GetMerchantsFunction", {
  functionName: `${config.resources.functionPrefix}-GetMerchants`,
});

// S3 bucket
const bucket = new Bucket(this, "UploadsBucket", {
  bucketName: `${config.resources.bucketPrefix}-uploads`,
});
```

---

## Best Practices

### 1. Use Consistent Prefixes

✅ **Good** - All resources use same prefix:

```
merchants-Merchants
merchants-GetMerchants
merchants-uploads
```

❌ **Bad** - Inconsistent prefixes:

```
merchants-Merchants
svc-merchants-GetMerchants
uploads
```

### 2. Don't Change After Deployment

Changing prefixes will create new resources!

### 3. Use Service Name as Default

Most cases don't need custom prefixes.

---

## Configuration Structure

```typescript
export interface IResourcesConfig {
  readonly tablePrefix: string;
  readonly bucketPrefix: string;
  readonly functionPrefix: string;
  readonly apiPrefix: string;
}
```

---

## Examples

### Example 1: Default Prefixes

```bash
# .env
SERVICE_NAME=svc-merchants
# No custom prefixes set
```

**Result**:

```
DynamoDB: svc-merchants-Merchants
Lambda:   svc-merchants-GetMerchants
S3:       svc-merchants-uploads
API:      svc-merchants
```

### Example 2: Custom Prefixes

```bash
# .env
SERVICE_NAME=svc-merchants
TABLE_PREFIX=merchants
FUNCTION_PREFIX=merchants
BUCKET_PREFIX=merchants
API_PREFIX=merchants
```

**Result**:

```
DynamoDB: merchants-Merchants
Lambda:   merchants-GetMerchants
S3:       merchants-uploads
API:      merchants
```

### Example 3: Environment-Specific Prefixes

```bash
# Staging
SERVICE_NAME=svc-merchants
TABLE_PREFIX=staging-merchants

# Production
SERVICE_NAME=svc-merchants
TABLE_PREFIX=prod-merchants
```

**Result**:

```
Staging:    staging-merchants-Merchants
Production: prod-merchants-Merchants
```

---

## Advanced Usage

### Dynamic Prefix Based on Environment

```typescript
// config/resources.ts
const envPrefix = envName === "production" ? "prod" : envName;

export const resourcesConfig: IResourcesConfig = {
  tablePrefix: `${envPrefix}-${getServiceName()}`,
  bucketPrefix: `${envPrefix}-${getServiceName()}`,
  functionPrefix: `${envPrefix}-${getServiceName()}`,
  apiPrefix: `${envPrefix}-${getServiceName()}`,
};
```

### Conditional Prefixes

```typescript
// Different prefix for local vs deployed
const prefix =
  envName === "local"
    ? "local-merchants"
    : process.env.TABLE_PREFIX || getServiceName();
```

---

## Troubleshooting

### Resource Name Too Long

**Cause**: AWS has length limits for resource names (e.g., S3 bucket names max 63 chars).

**Solution**: Use shorter prefixes:

```bash
BUCKET_PREFIX=merch  # Instead of svc-merchants
```

### Resource Name Conflicts

**Cause**: Multiple services using same prefix.

**Solution**: Use unique prefixes per service:

```bash
# Service 1
TABLE_PREFIX=merchants

# Service 2
TABLE_PREFIX=orders
```

### Can't Find Resources

**Cause**: Prefix changed after deployment.

**Solution**:

1. Don't change prefixes after deployment
2. If you must, manually migrate resources
3. Update all references in code

---

## Related Configuration

- [Service Configuration](./service-configuration.md) - Service name used as default prefix
- [Database Configuration](./database-configuration.md) - Uses table prefix
- [Environment Configuration](./environment-configuration.md) - Environment-specific prefixes

---

## Related Guides

- [Configuration Management README](./README.md)
- [Database Setup](../database-setup.md) - Table naming
