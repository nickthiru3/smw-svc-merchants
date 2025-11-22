# AWS Configuration Guide

Guide for configuring AWS-specific settings (region, profile).

**File**: `config/aws.ts`

---

## Overview

AWS configuration defines AWS-specific settings:

- **Region**: AWS region (e.g., `us-east-1`)
- **Profile**: AWS CLI profile (optional)

---

## Configuration

```typescript
export function createAwsConfig(envName: string): IAwsConfig {
  return {
    region: getAwsRegion(envName),
    profile: process.env.AWS_PROFILE,
  };
}

function getAwsRegion(envName: string): string {
  const region =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.CDK_DEFAULT_REGION;

  if (region) {
    return region;
  }

  if (envName === "local") {
    return "us-east-1";
  }

  throw new Error(
    "AWS region is required. Set AWS_REGION environment variable."
  );
}
```

---

## Environment Variables

### `AWS_REGION`

**Purpose**: AWS region

**Required**: Yes (for non-local environments)

**Default**: `"us-east-1"` (local only)

**Example**: `AWS_REGION=us-east-1`

**Alternatives**: `AWS_DEFAULT_REGION`, `CDK_DEFAULT_REGION`

### `AWS_PROFILE`

**Purpose**: AWS CLI profile

**Required**: No

**Example**: `AWS_PROFILE=my-profile`

**Use Case**: Local development with multiple AWS accounts

---

## Usage

### In CDK App

```typescript
import config from "#config/default";

const app = new App();

new ServiceStack(app, "ServiceStack", {
  env: {
    account: config.accountId,
    region: config.aws.region,
  },
});
```

### In Lambda Handlers

```typescript
// AWS SDK automatically uses AWS_REGION
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});
```

---

## Best Practices

### 1. Use Environment Variables

✅ **Good**:

```bash
export AWS_REGION=us-east-1
```

❌ **Bad**:

```typescript
region: "us-east-1"; // Hardcoded!
```

### 2. Use AWS_PROFILE for Local Development

```bash
# ~/.aws/credentials
[default]
aws_access_key_id = ...
aws_secret_access_key = ...

[staging]
aws_access_key_id = ...
aws_secret_access_key = ...

# Use staging profile
export AWS_PROFILE=staging
```

### 3. Don't Commit AWS Credentials

Never commit AWS credentials to version control!

---

## Troubleshooting

### Error: "AWS region is required"

**Cause**: `AWS_REGION` not set for non-local environment.

**Solution**: Set `AWS_REGION` environment variable.

### Wrong AWS Account

**Cause**: Using wrong AWS profile or credentials.

**Solution**: Check `AWS_PROFILE` or AWS credentials.

---

## Related Guides

- [Environment Configuration](./environment-configuration.md) - Environment-specific settings
- [Configuration Management README](./README.md)
