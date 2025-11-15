# Authentication & Authorization Implementation Guide

**Purpose**: Implement user authentication and authorization using AWS Cognito  
**When needed**: API requires user authentication and role-based access control  
**Prerequisites**: Understanding of OAuth 2.0, JWT tokens, and AWS Cognito

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1. [What This Guide Covers](#11-what-this-guide-covers)
   - 1.2. [What This Guide Doesn't Cover](#12-what-this-guide-doesnt-cover)
2. [Comprehensive Auth Guides](#2-comprehensive-auth-guides)
   - 2.1. [Auth Overview](#21-auth-overview)
   - 2.2. [End-to-End Auth](#22-end-to-end-auth)
   - 2.3. [Implementation Patterns](#23-implementation-patterns)
   - 2.4. [Merchant Authorization](#24-merchant-authorization)
   - 2.5. [Permissions Governance](#25-permissions-governance)
3. [Microservice Implementation](#3-microservice-implementation)
   - 3.1. [Architecture](#31-architecture)
   - 3.2. [Key Components](#32-key-components)
   - 3.3. [Dependencies](#33-dependencies)
4. [Quick Start](#4-quick-start)
   - 4.1. [Scenario 1: Public API (No Auth)](#41-scenario-1-public-api-no-auth)
   - 4.2. [Scenario 2: Authenticated API (Basic)](#42-scenario-2-authenticated-api-basic)
   - 4.3. [Scenario 3: Role-Based Access (IAM Roles)](#43-scenario-3-role-based-access-iam-roles)
   - 4.4. [Scenario 4: Scope-Based Access (OAuth)](#44-scenario-4-scope-based-access-oauth)
5. [Related Guides](#5-related-guides)

---

## 1. Overview

This guide provides microservice-specific implementation details for authentication and authorization. For comprehensive concepts, patterns, and cross-service integration, see the [Comprehensive Auth Guides](#comprehensive-auth-guides) section.

### 1.1. What This Guide Covers

- ✅ Microservice-specific Auth construct implementation
- ✅ How to wire Auth into your service stack
- ✅ Quick start for common scenarios
- ✅ References to detailed implementation guides

### 1.2. What This Guide Doesn't Cover

- ❌ Comprehensive auth concepts (see [Auth Overview](../../../docs/guides/auth/overview.md))
- ❌ Cross-service auth patterns (see [End-to-End Auth](../../../docs/guides/auth/end-to-end-auth.md))
- ❌ IAM roles details (see [IAM Roles Guide](./iam-roles.md))
- ❌ OAuth scopes details (see [OAuth Scopes Guide](./permissions-oauth-scopes.md))

---

## 2. Comprehensive Auth Guides

**For deep understanding of authentication and authorization**, refer to these comprehensive guides:

### 2.1. Auth Overview

**[docs/guides/auth/overview.md](../../../docs/guides/auth/overview.md)**

**Covers**:

- Core concepts (AuthN vs AuthZ)
- AWS services (Cognito User Pools, Identity Pools, IAM, API Gateway, S3)
- Token types (ID, Access, Refresh, AWS Credentials)
- OAuth 2.0 implementation (Resource Servers, Scopes)
- Authorization flow (Registration → Auth → Federation → API → AWS Services)
- Direct S3 upload pattern
- Security considerations

**Read this first** to understand the overall authentication and authorization architecture.

### 2.2. End-to-End Auth

**[docs/guides/auth/end-to-end-auth.md](../../../docs/guides/auth/end-to-end-auth.md)**

**Covers**:

- Producer service (users-ms) provisions auth/IAM
- Consumer service (deals-ms) imports via SSM bindings
- Resource server and OAuth scopes definition
- API Gateway authorizer configuration
- IAM policy attachment
- Token and access flow

**Read this** to understand how authentication works across multiple microservices.

### 2.3. Implementation Patterns

**[docs/guides/auth/implementation-patterns.md](../../../docs/guides/auth/implementation-patterns.md)**

**Covers**: Detailed implementation patterns for various auth scenarios.

### 2.4. Merchant Authorization

**[docs/guides/auth/merchant-authorization.md](../../../docs/guides/auth/merchant-authorization.md)**

**Covers**: Merchant-specific authorization patterns.

### 2.5. Permissions Governance

**[docs/guides/auth/permissions-governance.md](../../../docs/guides/auth/permissions-governance.md)**

**Covers**: Governance, versioning, and ownership of IAM policies and contracts.

---

## 3. Microservice Implementation

### 3.1. Architecture

The Auth construct is already wired in `service-stack.ts`:

```typescript
// lib/service-stack.ts
// 4. Auth - Cognito User Pool, Identity Pool, User Groups, Lambda triggers
const auth = new AuthConstruct(this, "AuthConstruct", {
  config,
  ssmBindings,
  monitor,
});
```

**Construct hierarchy**:

```
AuthConstruct
├── UserPoolConstruct
│   ├── User Pool (authentication)
│   ├── User Pool Client (app integration)
│   ├── Custom Message Lambda (verification emails)
│   └── Welcome Email Lambda (post-confirmation)
├── IdentityPoolConstruct
│   └── Identity Pool (AWS credentials)
└── UserGroupsConstruct
    ├── Merchant Group
    └── Customer Group
```

### 3.2. Key Components

#### 1.4.2.1. User Pool (Authentication)

**Purpose**: User directory for registration and sign-in

**Location**: `lib/auth/user-pool/construct.ts`

**Features**:

- User registration and sign-in
- Email verification
- Password policies
- Custom attributes
- Lambda triggers (custom messages, post-confirmation)

#### 1.4.2.2. Identity Pool (AWS Credentials)

**Purpose**: Issues temporary AWS credentials for authenticated users

**Location**: `lib/auth/identity-pool/construct.ts`

**Features**:

- Maps authenticated users to IAM roles
- Provides temporary, limited-privilege AWS credentials
- Enables direct access to AWS services (e.g., S3 uploads)

#### 1.4.2.3. User Groups (Role Assignment)

**Purpose**: Organizes users into groups with specific IAM roles

**Location**: `lib/auth/user-groups/construct.ts`

**Groups**:

- **Merchant Group**: For merchant users
- **Customer Group**: For customer users

**How it works**: Identity Pool maps group membership to IAM roles (see [IAM Roles Guide](./iam-roles.md))

### 3.3. Dependencies

**AuthConstruct depends on**:

- `SsmBindingsConstruct` - For external configs (website URL for emails)
- `MonitorConstruct` - For SES event tracking

**Other constructs depend on AuthConstruct**:

- `IamConstruct` - Creates roles for auth users
- `PermissionsConstruct` - Defines OAuth scopes on User Pool
- `ApiConstruct` - Creates Cognito authorizer
- `SsmPublicationsConstruct` - Publishes User Pool ID for other services

---

## 4. Quick Start

### 4.1. Scenario 1: Public API (No Auth)

**When**: API endpoints don't require authentication

**Implementation**: API endpoints don't specify authorizer

```typescript
// lib/api/endpoints/merchants/get/construct.ts
resource.addMethod("GET", integration);
// No authorizer specified
```

**Note**: Auth construct is still created (for future use), but not enforced on endpoints.

### 4.2. Scenario 2: Authenticated API (Basic)

**When**: All authenticated users can access API

**Implementation**:

1. **Create Cognito authorizer** in `lib/api/authorization/construct.ts`:

   ```typescript
   this.authorizer = new CognitoUserPoolsAuthorizer(this, "Authorizer", {
     cognitoUserPools: [auth.userPool.pool],
   });
   ```

2. **Apply to endpoints**:
   ```typescript
   resource.addMethod("GET", integration, {
     authorizationType: AuthorizationType.COGNITO,
     authorizer: { authorizerId: authorizer.authorizerId },
   });
   ```

**Result**: Users must provide valid JWT token in `Authorization` header.

### 4.3. Scenario 3: Role-Based Access (IAM Roles)

**When**: Different user types need different AWS permissions

**Implementation**: See [IAM Roles Guide](./iam-roles.md)

**Example**: Merchants can upload to S3, customers cannot.

### 4.4. Scenario 4: Scope-Based Access (OAuth)

**When**: Different API operations require different permissions

**Implementation**: See [OAuth Scopes Guide](./permissions-oauth-scopes.md)

**Example**: Users with `read` scope can GET, users with `write` scope can POST.

---

## 5. Related Guides

### Microservice-Specific Guides

- **[IAM Roles](./iam-roles.md)** - Role-based access control implementation
- **[OAuth Scopes](./permissions-oauth-scopes.md)** - Fine-grained API authorization
- **[SSM Bindings](./ssm-bindings.md)** - Consuming auth from other services
- **[SSM Publications](./ssm-publications.md)** - Publishing auth for other services

### Comprehensive Auth Guides

- **[Auth Overview](../../../docs/guides/auth/overview.md)** - Core concepts and architecture
- **[End-to-End Auth](../../../docs/guides/auth/end-to-end-auth.md)** - Cross-service patterns
- **[Implementation Patterns](../../../docs/guides/auth/implementation-patterns.md)** - Detailed patterns
- **[Merchant Authorization](../../../docs/guides/auth/merchant-authorization.md)** - Merchant-specific patterns
- **[Permissions Governance](../../../docs/guides/auth/permissions-governance.md)** - Governance and versioning

### Development Workflow

- **[Microservice Development Guide](./microservice-development-guide.md)** - See "Optional & Advanced Constructs" section

---

**Last Updated**: November 2025  
**Related Constructs**: `AuthConstruct`, `IamConstruct`, `PermissionsConstruct`
