# API Configuration Guide

Guide for configuring API Gateway settings (REST API, CORS, stages, authorization).

**File**: `config/api.ts`

**Related**: [Adding Endpoints - Part 2: API Gateway Integration](../adding-endpoints-part-2-api-gateway.md)

---

## Overview

API configuration defines all API Gateway settings:

- **REST API**: Endpoint type, CloudWatch role, deployment settings
- **CORS**: Cross-origin resource sharing for web clients
- **Stages**: Deployment stages with throttling, logging, caching
- **Authorization**: Cognito user pools, OAuth scopes

---

## Configuration Structure

```typescript
export interface IApiConfig {
  restApi: {
    name?: string;
    description?: string;
    endpointType: "REGIONAL" | "EDGE" | "PRIVATE";
    deploy: boolean;
    cloudWatchRole: boolean;
  };
  cors: {
    allowOrigins: string[] | "*";
    allowMethods: string[];
    allowHeaders: string[];
    allowCredentials: boolean;
    maxAge?: number;
  };
  stages: IApiStageConfig[];
  authorization: {
    cognito: {
      enabled: boolean;
      identitySource?: string;
    };
  };
}
```

---

## REST API Configuration

### Settings

- **name**: API Gateway name (defaults to service name)
- **description**: API description
- **endpointType**: `"REGIONAL"` (recommended), `"EDGE"`, or `"PRIVATE"`
- **deploy**: Auto-deploy on changes (default: `false`)
- **cloudWatchRole**: Enable CloudWatch logging (default: `true`)

### Example

```typescript
restApi: {
  name: process.env.API_NAME || undefined,
  description: "Merchants Microservice API",
  endpointType: "REGIONAL",
  deploy: false,
  cloudWatchRole: true,
}
```

---

## CORS Configuration

### Environment-Specific Origins

```typescript
cors: {
  allowOrigins:
    envName === "local"
      ? ["http://localhost:5173", "http://localhost:3000"]
      : envName === "staging"
      ? ["https://staging.example.com"]
      : ["https://example.com"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  allowCredentials: true,
  maxAge: 86400, // 24 hours
}
```

### Best Practices

- ✅ Use specific origins in production (not `"*"`)
- ✅ Only allow needed methods
- ✅ Set `maxAge` to cache preflight requests
- ✅ Use `allowCredentials: true` for cookies/auth

---

## Stage Configuration

### Settings

```typescript
stages: [{
  name: string;
  throttling?: {
    rateLimit: number;    // Requests per second
    burstLimit: number;   // Burst capacity
  };
  logging?: {
    loggingLevel: "OFF" | "ERROR" | "INFO";
    dataTrace: boolean;
  };
  caching?: {
    enabled: boolean;
    ttl: number;          // Seconds
  };
}]
```

### Example

```typescript
stages: [
  {
    name: envName,
    throttling: {
      rateLimit: 1000,
      burstLimit: 2000,
    },
    logging: {
      loggingLevel: envName === "production" ? "ERROR" : "INFO",
      dataTrace: envName !== "production",
    },
    caching: {
      enabled: envName === "production",
      ttl: 300, // 5 minutes
    },
  },
];
```

---

## Authorization Configuration

### Cognito Settings

```typescript
authorization: {
  cognito: {
    enabled: true,
    identitySource: "method.request.header.Authorization",
  },
}
```

### Usage in Endpoints

```typescript
// In endpoint construct
const method = resource.addMethod("GET", integration, {
  authorizer: authorization.authorizer,
  authorizationType: AuthorizationType.COGNITO,
});
```

---

## Environment Variables

### `API_NAME`

**Purpose**: Override API Gateway name

**Default**: Service name

**Example**: `API_NAME=merchants-api`

---

## Usage

### In CDK Constructs

```typescript
import config from "#config/default";

const restApi = new RestApi(this, "RestApi", {
  restApiName: config.api.restApi.name || config.service.name,
  description: config.api.restApi.description,
  endpointTypes: [EndpointType[config.api.restApi.endpointType]],
  defaultCorsPreflightOptions: {
    allowOrigins:
      config.api.cors.allowOrigins === "*"
        ? Cors.ALL_ORIGINS
        : config.api.cors.allowOrigins,
    allowMethods: config.api.cors.allowMethods,
  },
});
```

---

## Related Configuration

- [Service Configuration](./service-configuration.md) - Service name used for API name
- [Environment Configuration](./environment-configuration.md) - Environment-specific CORS origins

---

## Related Guides

- [Adding Endpoints - Part 2: API Gateway Integration](../adding-endpoints-part-2-api-gateway.md)
- [Configuration Management README](./README.md)
