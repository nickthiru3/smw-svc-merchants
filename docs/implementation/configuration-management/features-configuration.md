# Features Configuration Guide

Guide for configuring feature toggles.

**File**: `config/features.ts`

---

## Overview

Features configuration provides feature flags for enabling/disabling functionality:

- **Permissions**: OAuth permission scopes
- **Future features**: Add more as needed

---

## Configuration

```typescript
export const featuresConfig: IFeaturesConfig = {
  permissionsEnabled:
    process.env.PERMISSIONS_ENABLED === "true" ||
    process.env.PERMISSIONS_ENABLED === "1",
};
```

---

## Environment Variables

### `PERMISSIONS_ENABLED`

**Purpose**: Enable OAuth permission scopes

**Default**: `false`

**Values**: `"true"` | `"1"` | `"false"` | `"0"`

**Example**: `PERMISSIONS_ENABLED=true`

**Effect**:

- When enabled: API endpoints check OAuth scopes
- When disabled: API endpoints skip scope checks

---

## Usage

### In CDK Constructs

```typescript
import config from "#config/default";

if (config.features.permissionsEnabled) {
  // Create OAuth resource server
  new ResourceServer(this, "ResourceServer", {
    // ...
  });
}
```

### In Lambda Handlers

```typescript
// Via environment variable
const permissionsEnabled = process.env.PERMISSIONS_ENABLED === "true";

if (permissionsEnabled) {
  // Check OAuth scopes
  const scopes = event.requestContext.authorizer.claims.scope;
  if (!scopes.includes("merchants:read")) {
    return { statusCode: 403, body: "Forbidden" };
  }
}
```

---

## Adding New Features

### Step 1: Add to Interface

```typescript
// config/types.ts
export interface IFeaturesConfig {
  readonly permissionsEnabled: boolean;
  readonly newFeatureEnabled: boolean; // Add new feature
}
```

### Step 2: Add to Config

```typescript
// config/features.ts
export const featuresConfig: IFeaturesConfig = {
  permissionsEnabled: process.env.PERMISSIONS_ENABLED === "true",
  newFeatureEnabled: process.env.NEW_FEATURE_ENABLED === "true",
};
```

### Step 3: Add to Schema

```typescript
// config/schema.ts
const FeaturesConfigSchema = z.object({
  permissionsEnabled: z.boolean(),
  newFeatureEnabled: z.boolean(),
});
```

### Step 4: Use in Code

```typescript
if (config.features.newFeatureEnabled) {
  // New feature logic
}
```

---

## Best Practices

### 1. Default to Disabled

✅ **Good**:

```typescript
newFeatureEnabled: process.env.NEW_FEATURE_ENABLED === "true";
```

❌ **Bad**:

```typescript
newFeatureEnabled: process.env.NEW_FEATURE_ENABLED !== "false"; // Enabled by default!
```

### 2. Use Boolean Flags

✅ **Good**:

```typescript
permissionsEnabled: boolean;
```

❌ **Bad**:

```typescript
permissionsLevel: "none" | "basic" | "full"; // Too complex!
```

### 3. Remove Flags After Rollout

Once a feature is fully rolled out, remove the flag and make it permanent.

---

## Feature Flag Patterns

### Pattern 1: Simple Boolean Flag

```typescript
// config/features.ts
export const featuresConfig: IFeaturesConfig = {
  newFeatureEnabled: process.env.NEW_FEATURE_ENABLED === "true",
};

// In code
if (config.features.newFeatureEnabled) {
  // New feature logic
} else {
  // Old logic
}
```

### Pattern 2: Environment-Specific Flags

```typescript
// config/features.ts
export const featuresConfig: IFeaturesConfig = {
  betaFeaturesEnabled:
    envName === "staging" || process.env.BETA_FEATURES_ENABLED === "true",
};
```

### Pattern 3: Gradual Rollout

```typescript
// config/features.ts
export const featuresConfig: IFeaturesConfig = {
  newFeatureRolloutPercentage: parseInt(
    process.env.NEW_FEATURE_ROLLOUT || "0",
    10
  ),
};

// In code
const userId = event.requestContext.authorizer.claims.sub;
const userHash = hashUserId(userId);
const rolloutPercentage = config.features.newFeatureRolloutPercentage;

if (userHash % 100 < rolloutPercentage) {
  // New feature for this user
}
```

---

## Configuration Structure

```typescript
export interface IFeaturesConfig {
  readonly permissionsEnabled: boolean;
  // Add more features as needed
}
```

---

## Examples

### Example 1: Enable Permissions

```bash
# .env
PERMISSIONS_ENABLED=true
```

**Effect**: API endpoints check OAuth scopes before allowing access.

### Example 2: Disable Permissions (Development)

```bash
# .env
PERMISSIONS_ENABLED=false
```

**Effect**: API endpoints skip OAuth scope checks (faster development).

### Example 3: Environment-Specific Features

```bash
# Staging - enable beta features
ENV_NAME=staging
BETA_FEATURES_ENABLED=true

# Production - disable beta features
ENV_NAME=production
BETA_FEATURES_ENABLED=false
```

---

## Troubleshooting

### Feature Not Enabling

**Cause**: Environment variable not set correctly.

**Solution**: Check exact value:

```bash
echo $PERMISSIONS_ENABLED  # Should be "true" or "1"
```

### Feature Enabled in Wrong Environment

**Cause**: Environment variable set globally.

**Solution**: Use environment-specific config:

```typescript
// config/production.ts
export const productionConfig: Partial<IConfig> = {
  features: {
    betaFeaturesEnabled: false, // Force off in production
  },
};
```

### Can't Disable Feature

**Cause**: Feature flag logic inverted.

**Solution**: Check logic:

```typescript
// ✅ Good
if (config.features.enabled) {
  /* feature */
}

// ❌ Bad
if (!config.features.disabled) {
  /* feature */
}
```

---

## Related Configuration

- [Environment Configuration](./environment-configuration.md) - Environment-specific feature flags
- [API Configuration](./api-configuration.md) - OAuth configuration

---

## Related Guides

- [Configuration Management README](./README.md)
- [Adding Endpoints](../adding-endpoints-part-1-lambda-handlers.md) - Using feature flags in handlers
