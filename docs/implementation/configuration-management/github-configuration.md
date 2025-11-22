# GitHub Configuration Guide

Guide for configuring GitHub repository and CodeStar connection for CI/CD.

**File**: `config/github.ts`

---

## Overview

GitHub configuration defines CI/CD settings:

- **Repository**: GitHub repo (e.g., `org/repo`)
- **Branch**: Deployment branch (e.g., `release`)
- **CodeStar Connection**: AWS CodeStar connection ID

**Note**: Only required for non-local environments.

---

## Configuration

```typescript
export function createGitHubConfig(envName: string): IGitHubConfig | undefined {
  // Local environment doesn't need GitHub config
  if (envName === "local") {
    return undefined;
  }

  const repo = process.env.GITHUB_REPO;
  if (!repo) {
    throw new Error(
      "GitHub repository is required. Set GITHUB_REPO environment variable."
    );
  }

  return {
    repo,
    branch: process.env.GITHUB_BRANCH || "release",
    codestarConnectionId: getCodeStarConnectionId(envName),
  };
}
```

---

## Environment Variables

### `GITHUB_REPO`

**Purpose**: GitHub repository

**Required**: Yes (for non-local environments)

**Format**: `owner/repo`

**Example**: `GITHUB_REPO=my-org/svc-merchants`

### `GITHUB_BRANCH`

**Purpose**: Deployment branch

**Required**: No

**Default**: `"release"`

**Example**: `GITHUB_BRANCH=main`

### `CODESTAR_CONNECTION_ID`

**Purpose**: AWS CodeStar connection ID

**Required**: Yes (for non-local environments)

**Format**: UUID

**Example**: `CODESTAR_CONNECTION_ID=arn:aws:codestar-connections:us-east-1:123456789012:connection/abc123`

**Fallback**: SSM Parameter Store lookup at `/platform/{envName}/github/codestar-connection-id`

---

## Setup

### Step 1: Create CodeStar Connection

```bash
# In AWS Console
1. Go to CodePipeline > Settings > Connections
2. Create connection to GitHub
3. Authorize GitHub access
4. Copy connection ARN
```

### Step 2: Store in SSM Parameter Store

```bash
aws ssm put-parameter \
  --name "/platform/staging/github/codestar-connection-id" \
  --value "arn:aws:codestar-connections:us-east-1:123456789012:connection/abc123" \
  --type "String"
```

### Step 3: Set Environment Variables

```bash
# For local override (optional)
export CODESTAR_CONNECTION_ID="arn:aws:..."

# For CI/CD (required)
export GITHUB_REPO="my-org/svc-merchants"
export GITHUB_BRANCH="release"
```

---

## Usage

### In CDK Pipeline

```typescript
import config from "#config/default";

if (config.github) {
  const pipeline = new CodePipeline(this, "Pipeline", {
    source: CodePipelineSource.connection(
      config.github.repo,
      config.github.branch,
      {
        connectionArn: config.github.codestarConnectionId,
      }
    ),
  });
}
```

---

## Troubleshooting

### Error: "GitHub repository is required"

**Cause**: `GITHUB_REPO` not set for non-local environment.

**Solution**: Set `GITHUB_REPO` environment variable.

### Error: "CodeStar connection not found"

**Cause**: CodeStar connection ID not in SSM Parameter Store.

**Solution**: Store connection ID in SSM or set `CODESTAR_CONNECTION_ID` env var.

### Pipeline Fails to Connect

**Cause**: CodeStar connection not authorized.

**Solution**: Re-authorize connection in AWS Console.

---

## Related Guides

- [CI/CD Guide](../cicd-guide.md) - Setting up CI/CD pipeline
- [Configuration Management README](./README.md)
