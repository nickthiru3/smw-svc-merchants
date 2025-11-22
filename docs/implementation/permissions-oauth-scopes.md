# OAuth Scopes Implementation Guide

**Purpose**: Implement fine-grained API authorization using OAuth 2.0 scopes  
**When needed**: API requires scope-based access control (read, write, delete permissions)  
**Prerequisites**: AuthConstruct and IamConstruct already configured  
**Feature Flag**: `config.features.permissionsEnabled`

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1. [Purpose](#11-purpose)
   - 1.2. [When to Use](#12-when-to-use)
2. [Key Concepts](#2-key-concepts)
   - 2.1. [Resource Server](#21-resource-server)
   - 2.2. [OAuth Scopes](#22-oauth-scopes)
   - 2.3. [Scope Assignment](#23-scope-assignment)
   - 2.4. [Authorization Flow](#24-authorization-flow)
3. [Architecture](#3-architecture)
   - 3.1. [Construct Hierarchy](#31-construct-hierarchy)
   - 3.2. [Integration with Service Stack](#32-integration-with-service-stack)
4. [Implementation](#4-implementation)
   - 4.1. [Step 1: Enable Feature Flag](#41-step-1-enable-feature-flag)
   - 4.2. [Step 2: Define Resource Server](#42-step-2-define-resource-server)
   - 4.3. [Step 3: Add Custom Scopes (Optional)](#43-step-3-add-custom-scopes-optional)
   - 4.4. [Step 4: Configure OAuth Auth Options](#44-step-4-configure-oauth-auth-options)
   - 4.5. [Step 5: Update Type Definitions](#45-step-5-update-type-definitions)
5. [API Gateway Integration](#5-api-gateway-integration)
   - 5.1. [Step 1: Create Cognito Authorizer](#51-step-1-create-cognito-authorizer)
   - 5.2. [Step 2: Apply Scopes to API Methods](#52-step-2-apply-scopes-to-api-methods)
   - 5.3. [Step 3: Verify CloudFormation Output](#53-step-3-verify-cloudformation-output)
6. [Testing](#6-testing)
   - 6.1. [Unit Tests (CDK Template)](#61-unit-tests-cdk-template)
   - 6.2. [Integration Testing](#62-integration-testing)
7. [Best Practices](#7-best-practices)
   - 7.1. [Scope Design](#71-scope-design)
   - 7.2. [Security](#72-security)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Overview

The Permissions construct implements OAuth 2.0 scopes for fine-grained API authorization. It defines a Resource Server in Cognito with scopes (read, write, delete) and provides auth options for API Gateway methods.

### 1.1. Purpose

- **Fine-Grained Authorization**: Different permissions for different API operations
- **OAuth 2.0 Compliance**: Industry-standard authorization framework
- **Scope-Based Access**: Users receive only the scopes they need
- **API Gateway Integration**: Automatic scope enforcement at method level

### 1.2. When to Use

✅ **Use OAuth Scopes when**:

- Different API operations require different permissions
- OpenAPI spec defines scope-based access
- Production deployments requiring fine-grained authorization
- Multiple client applications with varying permission levels

❌ **Don't use OAuth Scopes when**:

- Simple authentication is sufficient (all users have same permissions)
- API is internal-only with trusted clients
- Complexity outweighs benefits for your use case

---

## 2. Key Concepts

### 2.1. Resource Server

**What**: Represents your protected API in Cognito

**Purpose**: Groups related scopes under a single identifier

**Identifier**: Service name (e.g., `svc-merchants`)

**Example**:

```typescript
const resourceServer = new UserPoolResourceServer(this, "ResourceServer", {
  userPool: auth.userPool.pool,
  identifier: "svc-merchants", // Resource server identifier
  scopes: [readScope, writeScope, deleteScope],
});
```

### 2.2. OAuth Scopes

**What**: Fine-grained permissions for API operations

**Format**: `{resourceServerIdentifier}/{scopeName}`

**Examples**:

- `svc-merchants/read` - Read access to merchants API
- `svc-merchants/write` - Write access (create, update)
- `svc-merchants/delete` - Delete access

### 2.3. Scope Assignment

**How users get scopes**:

1. User authenticates with Cognito User Pool
2. User Pool Client is configured with allowed scopes
3. Access token includes scopes based on user's groups/permissions
4. API Gateway validates token and checks required scopes

### 2.4. Authorization Flow

```
User authenticates
    ↓
Cognito issues access token with scopes
    ↓
Client sends request with access token
    ↓
API Gateway validates token
    ↓
API Gateway checks required scopes
    ↓
Request authorized or denied
```

---

## 3. Architecture

### 3.1. Construct Hierarchy

```
PermissionsConstruct
├── ResourceServerConstruct
│   ├── Resource Server (Cognito)
│   └── Scopes (read, write, delete)
└── OAuthConstruct
    └── Auth Options (per-scope method configs)
```

### 3.2. Integration with Service Stack

```
service-stack.ts
├── AuthConstruct (User Pool, Identity Pool)
├── IamConstruct (Roles)
├── PermissionsConstruct (OAuth Scopes) ← Feature-flagged
│   ├── ResourceServerConstruct
│   └── OAuthConstruct
└── ApiConstruct (uses auth options from PermissionsConstruct)
```

---

## 4. Implementation

### 4.1. Step 1: Enable Feature Flag

**Location**: `config/default.ts`

```typescript
export const defaultConfig: IConfig = {
  // ... other config
  features: {
    permissionsEnabled: true, // Enable OAuth scopes
  },
};
```

**How it works**:

```typescript
// service-stack.ts
const permissions: IPermissionsProvider = config.features?.permissionsEnabled
  ? new PermissionsConstruct(this, "PermissionsConstruct", {
      config,
      iam,
      auth,
    })
  : new NoopPermissionsConstruct(); // No-op when disabled
```

### 4.2. Step 2: Define Resource Server

**Location**: `lib/permissions/resource-server/construct.ts`

**Current implementation**:

```typescript
class ResourceServerConstruct extends Construct {
  scopes: ResourceServerScope[];
  resourceServer: UserPoolResourceServer;
  identifier: string;

  constructor(
    scope: Construct,
    id: string,
    props: IResourceServerConstructProps
  ) {
    super(scope, id);

    const { auth, config } = props;
    const serviceName = config.service.name; // e.g., "svc-merchants"

    // Define scopes
    this.scopes = [
      new ResourceServerScope({
        scopeName: "read",
        scopeDescription: `${serviceName}: read access`,
      }),
      new ResourceServerScope({
        scopeName: "write",
        scopeDescription: `${serviceName}: write access`,
      }),
      new ResourceServerScope({
        scopeName: "delete",
        scopeDescription: `${serviceName}: delete access`,
      }),
    ];

    // Create resource server
    this.resourceServer = new UserPoolResourceServer(
      this,
      "UserPoolResourceServer",
      {
        userPool: auth.userPool.pool,
        identifier: serviceName, // e.g., "svc-merchants"
        scopes: this.scopes,
      }
    );

    this.identifier = this.resourceServer.userPoolResourceServerId;
  }

  // Get slash-form scopes for API Gateway
  getOAuthScopes(): string[] {
    return this.scopes.map(
      (scope: ResourceServerScope) => `${this.identifier}/${scope.scopeName}`
    );
    // Returns: ["svc-merchants/read", "svc-merchants/write", "svc-merchants/delete"]
  }
}
```

### 4.3. Step 3: Add Custom Scopes (Optional)

**Example**: Add an "admin" scope

```typescript
this.scopes = [
  new ResourceServerScope({
    scopeName: "read",
    scopeDescription: `${serviceName}: read access`,
  }),
  new ResourceServerScope({
    scopeName: "write",
    scopeDescription: `${serviceName}: write access`,
  }),
  new ResourceServerScope({
    scopeName: "delete",
    scopeDescription: `${serviceName}: delete access`,
  }),
  new ResourceServerScope({
    scopeName: "admin",
    scopeDescription: `${serviceName}: admin access`,
  }),
];
```

**Update OAuth construct** to include admin scope (see next step)

### 4.4. Step 4: Configure OAuth Auth Options

**Location**: `lib/permissions/oauth/construct.ts`

**Current implementation**:

```typescript
class OAuthConstruct extends Construct {
  public readonly resourceServer: ResourceServerConstruct;

  constructor(scope: Construct, id: string, props: IOAuthConstructProps) {
    super(scope, id);
    const { resourceServer } = props;
    this.resourceServer = resourceServer;
  }

  // Returns auth options for API Gateway methods
  getAuthOptions(authorizerId: string) {
    const slashScopes = this.resourceServer.getOAuthScopes();
    // e.g., ["svc-merchants/read", "svc-merchants/write", "svc-merchants/delete"]

    const baseAuth = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: { authorizerId },
    };

    return {
      readUsersAuth: {
        ...baseAuth,
        authorizationScopes: slashScopes.filter((s) => s.endsWith("/read")),
      },
      writeUsersAuth: {
        ...baseAuth,
        authorizationScopes: slashScopes.filter((s) => s.endsWith("/write")),
      },
      deleteUsersAuth: {
        ...baseAuth,
        authorizationScopes: slashScopes.filter((s) => s.endsWith("/delete")),
      },
    };
  }
}
```

**Add admin auth option**:

```typescript
return {
  readUsersAuth: {
    ...baseAuth,
    authorizationScopes: slashScopes.filter((s) => s.endsWith("/read")),
  },
  writeUsersAuth: {
    ...baseAuth,
    authorizationScopes: slashScopes.filter((s) => s.endsWith("/write")),
  },
  deleteUsersAuth: {
    ...baseAuth,
    authorizationScopes: slashScopes.filter((s) => s.endsWith("/delete")),
  },
  adminUsersAuth: {
    ...baseAuth,
    authorizationScopes: slashScopes.filter((s) => s.endsWith("/admin")),
  },
};
```

### 4.5. Step 5: Update Type Definitions

**Location**: `lib/permissions/construct.ts`

**Update interface**:

```typescript
export interface IUsersAuthOptions {
  readonly readUsersAuth: IAuthOptions;
  readonly writeUsersAuth: IAuthOptions;
  readonly deleteUsersAuth: IAuthOptions;
  readonly adminUsersAuth: IAuthOptions; // Add this
}
```

---

## 5. API Gateway Integration

### 5.1. Step 1: Create Cognito Authorizer

**Location**: `lib/api/authorization/construct.ts`

```typescript
import { CognitoUserPoolsAuthorizer } from "aws-cdk-lib/aws-apigateway";

class AuthorizationConstruct extends Construct {
  authorizer: CognitoUserPoolsAuthorizer;
  authOptions: { users: IUsersAuthOptions };

  constructor(
    scope: Construct,
    id: string,
    props: IAuthorizationConstructProps
  ) {
    super(scope, id);

    const { auth, permissions } = props;

    // Create Cognito authorizer
    this.authorizer = new CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [auth.userPool.pool],
      }
    );

    // Get auth options from permissions construct
    this.authOptions = {
      users: permissions.oauth.getAuthOptions(this.authorizer.authorizerId),
    };
  }
}
```

### 5.2. Step 2: Apply Scopes to API Methods

**Location**: `lib/api/endpoints/merchants/get/construct.ts`

**Example**: GET /merchants (read scope)

```typescript
const resource = api.root.resourceForPath("/merchants");

resource.addMethod("GET", integration, {
  ...http.optionsWithAuth.readUsersAuth, // Requires "svc-merchants/read" scope
});
```

**Example**: POST /merchants (write scope)

```typescript
resource.addMethod("POST", integration, {
  ...http.optionsWithAuth.writeUsersAuth, // Requires "svc-merchants/write" scope
});
```

**Example**: DELETE /merchants/{id} (delete scope)

```typescript
const merchantResource = resource.addResource("{id}");

merchantResource.addMethod("DELETE", integration, {
  ...http.optionsWithAuth.deleteUsersAuth, // Requires "svc-merchants/delete" scope
});
```

### 5.3. Step 3: Verify CloudFormation Output

**Check method configuration**:

```typescript
// CDK template test
template.hasResourceProperties("AWS::ApiGateway::Method", {
  AuthorizationType: "COGNITO_USER_POOLS",
  AuthorizationScopes: ["svc-merchants/read"],
});
```

---

## 6. Testing

### 6.1. Unit Tests (CDK Template)

**Location**: `test/lib/permissions/construct.test.ts`

**Test resource server creation**:

```typescript
import { Template } from "aws-cdk-lib/assertions";

test("creates resource server with correct scopes", () => {
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::Cognito::UserPoolResourceServer", {
    Identifier: "svc-merchants",
    Scopes: [
      { ScopeName: "read", ScopeDescription: "svc-merchants: read access" },
      { ScopeName: "write", ScopeDescription: "svc-merchants: write access" },
      { ScopeName: "delete", ScopeDescription: "svc-merchants: delete access" },
    ],
  });
});
```

**Test API Gateway method scopes**:

```typescript
test("GET method requires read scope", () => {
  template.hasResourceProperties("AWS::ApiGateway::Method", {
    HttpMethod: "GET",
    AuthorizationType: "COGNITO_USER_POOLS",
    AuthorizationScopes: ["svc-merchants/read"],
  });
});
```

### 6.2. Integration Testing

**Test with real tokens**:

1. **Authenticate user**:

   ```typescript
   const { accessToken } = await signIn(username, password);
   ```

2. **Decode token to verify scopes**:

   ```typescript
   const decoded = jwt.decode(accessToken);
   expect(decoded.scope).toContain("svc-merchants/read");
   ```

3. **Test API request with token**:

   ```typescript
   const response = await fetch(`${apiUrl}/merchants`, {
     headers: {
       Authorization: `Bearer ${accessToken}`,
     },
   });
   expect(response.status).toBe(200);
   ```

4. **Test insufficient scopes**:
   ```typescript
   // User has only "read" scope, tries to POST
   const response = await fetch(`${apiUrl}/merchants`, {
     method: "POST",
     headers: {
       Authorization: `Bearer ${accessToken}`,
     },
     body: JSON.stringify({ name: "Test" }),
   });
   expect(response.status).toBe(403); // Forbidden
   ```

---

## 7. Best Practices

### 7.1. Scope Design

✅ **DO**:

- Use standard CRUD scopes (read, write, delete)
- Keep scope names simple and descriptive
- Document scope purposes in code comments
- Align scopes with OpenAPI spec

❌ **DON'T**:

- Create too many granular scopes (increases complexity)
- Use ambiguous scope names
- Mix resource-level and operation-level scopes
- Change scope names after deployment (breaks clients)

### 7.2. Security

✅ **DO**:

- Require scopes for all protected endpoints
- Use least-privilege principle (minimum scopes needed)
- Test scope enforcement thoroughly
- Monitor scope usage in CloudWatch

❌ **DON'T**:

- Allow access without scopes
- Grant all scopes to all users
- Skip scope validation in tests
- Expose admin scopes to regular users

### 7.3. Feature Flag Usage

✅ **DO**:

- Start with feature disabled during development
- Enable after basic auth is working
- Test both enabled and disabled states
- Document feature flag in README

❌ **DON'T**:

- Enable in production without testing
- Change flag value without redeployment
- Forget to update NoopPermissionsConstruct

---

## 8. Troubleshooting

### 8.1. Scopes Not in Access Token

**Symptom**: Access token doesn't contain expected scopes

**Causes**:

1. User Pool Client not configured with scopes
2. User not granted scopes via groups/policies
3. Resource server not linked to client

**Solution**:

```typescript
// Update User Pool Client to include resource server scopes
poolClient.addResourceServerScope(resourceServer, OAuthScope.custom("read"));
```

### 8.2. API Gateway Returns 403 Forbidden

**Symptom**: Request fails with 403 even with valid token

**Causes**:

1. Token missing required scope
2. Scope name mismatch (colon vs slash)
3. Authorizer not configured correctly

**Solution**:

- Verify token contains scope: `jwt.decode(accessToken).scope`
- Check API Gateway method uses slash-form: `svc-merchants/read`
- Verify authorizer ID matches in auth options

### 8.3. NoopPermissionsConstruct Used Instead

**Symptom**: No scope enforcement, all requests succeed

**Cause**: Feature flag disabled

**Solution**:

```typescript
// config/default.ts
features: {
  permissionsEnabled: true, // Enable OAuth scopes
}
```

### 8.4. Scope Format Error

**Symptom**: API Gateway rejects scope format

**Cause**: Using colon-form instead of slash-form

**Solution**:

```typescript
// ❌ Wrong (colon-form)
authorizationScopes: ["svc-merchants:read"];

// ✅ Correct (slash-form)
authorizationScopes: ["svc-merchants/read"];
```

---

## Related Guides

- [Authentication & Authorization](./authentication.md) - Cognito setup
- [IAM Roles](./iam-roles.md) - Role-based access control
- [Auth Overview](../../../docs/guides/auth/overview.md) - Comprehensive concepts
- [Adding Endpoints - Part 1](./adding-endpoints-part-1-lambda-handlers.md) - Lambda handlers
- [Adding Endpoints - Part 2](./adding-endpoints-part-2-api-gateway.md) - API Gateway configuration

---

**Last Updated**: November 2025  
**Related Constructs**: `AuthConstruct`, `IamConstruct`, `ApiConstruct`
