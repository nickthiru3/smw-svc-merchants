# IAM Roles Implementation Guide

**Purpose**: Configure IAM roles for different user types with appropriate AWS resource permissions  
**When needed**: Multi-tenant applications requiring role-based access control  
**Prerequisites**: AuthConstruct (Cognito User Pool and Identity Pool) already configured

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1. [Purpose](#11-purpose)
   - 1.2. [When to Use](#12-when-to-use)
2. [Key Concepts](#2-key-concepts)
   - 2.1. [Cognito Identity Pool](#21-cognito-identity-pool)
   - 2.2. [IAM Roles](#22-iam-roles)
   - 2.3. [Role Mapping](#23-role-mapping)
3. [Architecture](#3-architecture)
   - 3.1. [Construct Hierarchy](#31-construct-hierarchy)
   - 3.2. [Role Assumption Flow](#32-role-assumption-flow)
4. [Implementation](#4-implementation)
   - 4.1. [Step 1: Understand Existing Structure](#41-step-1-understand-existing-structure)
   - 4.2. [Step 2: Review Role Definitions](#42-step-2-review-role-definitions)
   - 4.3. [Step 3: Add New User-Type Role (Optional)](#43-step-3-add-new-user-type-role-optional)
5. [Role Mapping](#5-role-mapping)
   - 5.1. [Identity Pool Role Attachment](#51-identity-pool-role-attachment)
   - 5.2. [Adding Customer Role Mapping](#52-adding-customer-role-mapping)
   - 5.3. [Rule Evaluation Order](#53-rule-evaluation-order)
6. [Adding Permissions](#6-adding-permissions)
   - 6.1. [Attach Policies to Roles](#61-attach-policies-to-roles)
   - 6.2. [Path-Based Restrictions](#62-path-based-restrictions)
7. [Testing](#7-testing)
   - 7.1. [Unit Tests](#71-unit-tests)
   - 7.2. [Integration Testing](#72-integration-testing)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The IAM Roles construct creates AWS IAM roles that are assumed by authenticated users via Cognito Identity Pool. Different user types (merchants, customers) receive different roles with appropriate permissions.

### 1.1. Purpose

- **Role-Based Access Control**: Different permissions for different user types
- **Temporary Credentials**: Short-lived AWS credentials for client applications
- **Direct AWS Access**: Enable clients to access AWS services (S3, DynamoDB) directly
- **Principle of Least Privilege**: Users receive only the permissions they need

### 1.2. When to Use

✅ **Use IAM Roles when**:

- Users need direct access to AWS services (e.g., S3 uploads)
- Different user types require different permissions
- Multi-tenant application with role-based access
- Client applications need temporary AWS credentials

❌ **Don't use IAM Roles when**:

- All API access goes through Lambda (no direct AWS access)
- All users have identical permissions
- Simple authentication without authorization

---

## 2. Key Concepts

### 2.1. Cognito Identity Pool

**Purpose**: Issues temporary AWS credentials based on user identity

**How it works**:

1. User authenticates with Cognito User Pool → receives tokens
2. Client exchanges tokens with Identity Pool → receives AWS credentials
3. Client uses credentials to access AWS services directly

### 2.2. IAM Roles

**Types of roles**:

1. **Authenticated Role** (Default):
   - Assigned to all authenticated users by default
   - Basic permissions for authenticated access
   - Fallback role when no specific role matches

2. **Unauthenticated Role** (Optional):
   - Assigned to unauthenticated users
   - Very limited permissions (e.g., read public data)
   - Rarely used in production

3. **User-Type Roles** (Specific):
   - Merchant Role: Permissions for merchant users
   - Customer Role: Permissions for customer users
   - Admin Role: Elevated permissions for admins

### 2.3. Role Mapping

**How users get roles**:

- **Rule-Based Mapping**: Map users to roles based on Cognito group membership
- **Claim-Based**: Check `cognito:groups` claim in ID token
- **Match Type**: "Contains" - user in "merchants" group → merchant role

---

## 3. Architecture

### 3.1. Construct Hierarchy

```
IamConstruct
└── RolesConstruct
    ├── authenticated (Role) - Default for all authenticated users
    ├── unauthenticated (Role) - Default for unauthenticated users
    ├── merchant (Role) - Specific role for merchant users
    └── IdentityPoolRoleAttachment - Maps groups to roles
```

### 3.2. Role Assumption Flow

```
User authenticates
    ↓
Cognito User Pool issues tokens
    ↓
Client exchanges tokens with Identity Pool
    ↓
Identity Pool checks user's groups
    ↓
Rule-based mapping determines role
    ↓
Identity Pool issues temporary AWS credentials
    ↓
Client uses credentials to access AWS services
```

---

## 4. Implementation

### 4.1. Step 1: Understand Existing Structure

The `IamConstruct` is already wired in `service-stack.ts`:

```typescript
// lib/service-stack.ts
// 5. IAM - Roles for authenticated users (merchant, customer)
const iam = new IamConstruct(this, "IamConstruct", {
  auth, // Depends on AuthConstruct
});
```

### 4.2. Step 2: Review Role Definitions

**Location**: `lib/iam/roles/construct.ts`

**Roles created**:

```typescript
// 1. Authenticated Role (default for all authenticated users)
this.authenticated = new Role(this, "CognitoDefaultAuthenticatedRole", {
  assumedBy: new FederatedPrincipal(
    "cognito-identity.amazonaws.com",
    {
      StringEquals: {
        "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
      },
      "ForAnyValue:StringLike": {
        "cognito-identity.amazonaws.com:amr": "authenticated",
      },
    },
    "sts:AssumeRoleWithWebIdentity"
  ),
});

// 2. Unauthenticated Role (default for unauthenticated users)
this.unAuthenticated = new Role(this, "CognitoDefaultUnauthenticatedRole", {
  assumedBy: new FederatedPrincipal(
    "cognito-identity.amazonaws.com",
    {
      StringEquals: {
        "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
      },
      "ForAnyValue:StringLike": {
        "cognito-identity.amazonaws.com:amr": "unauthenticated",
      },
    },
    "sts:AssumeRoleWithWebIdentity"
  ),
});

// 3. Merchant Role (specific role for merchant users)
this.merchant = new Role(this, "CognitoMerchantRole", {
  assumedBy: new FederatedPrincipal(
    "cognito-identity.amazonaws.com",
    {
      StringEquals: {
        "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
      },
      "ForAnyValue:StringLike": {
        "cognito-identity.amazonaws.com:amr": "authenticated",
      },
    },
    "sts:AssumeRoleWithWebIdentity"
  ),
});
```

### 4.3. Step 3: Add New User-Type Role (Optional)

**Example**: Add a Customer role

```typescript
// lib/iam/roles/construct.ts
this.customer = new Role(this, "CognitoCustomerRole", {
  assumedBy: new FederatedPrincipal(
    "cognito-identity.amazonaws.com",
    {
      StringEquals: {
        "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
      },
      "ForAnyValue:StringLike": {
        "cognito-identity.amazonaws.com:amr": "authenticated",
      },
    },
    "sts:AssumeRoleWithWebIdentity"
  ),
});
```

**Update role mapping** (see next section)

---

## Role Mapping

### 5.1. Identity Pool Role Attachment

**Purpose**: Maps Cognito groups to IAM roles

**Location**: `lib/iam/roles/construct.ts`

```typescript
new CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
  identityPoolId: auth.identityPool.pool.ref,

  // Default roles
  roles: {
    authenticated: this.authenticated.roleArn,
    unauthenticated: this.unAuthenticated.roleArn,
  },

  // Rule-based mapping
  roleMappings: {
    roleMappingsKey: {
      type: "Rules",
      ambiguousRoleResolution: "Deny", // Deny if multiple rules match
      identityProvider: `${auth.userPool.pool.userPoolProviderName}:${auth.userPool.poolClient.userPoolClientId}`,
      rulesConfiguration: {
        rules: [
          {
            claim: "cognito:groups", // Check user's groups
            matchType: "Contains", // User must be in group
            value: "merchants", // Group name
            roleArn: this.merchant.roleArn, // Assigned role
          },
          // Add more rules for other groups
        ],
      },
    },
  },
});
```

### 5.2. Adding Customer Role Mapping

```typescript
rules: [
  {
    claim: "cognito:groups",
    matchType: "Contains",
    value: "merchants",
    roleArn: this.merchant.roleArn,
  },
  {
    claim: "cognito:groups",
    matchType: "Contains",
    value: "customers",
    roleArn: this.customer.roleArn,
  },
];
```

### 5.3. Rule Evaluation Order

**Important**: Rules are evaluated in order. First matching rule wins.

**Best practice**: Order rules from most specific to least specific.

---

## 6. Adding Permissions

### 6.1. Attach Policies to Roles

**Location**: `lib/permissions/policies/construct.ts` (or inline in role definition)

#### 1.7.1.1. Example: S3 Upload Permission for Merchants

```typescript
// lib/permissions/policies/construct.ts (or lib/iam/roles/construct.ts)
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

// Grant merchant role S3 PutObject permission
iam.roles.merchant.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:PutObject"],
    resources: [
      `${storage.s3Bucket.bucketArn}/merchants/*`, // Path-based restriction
    ],
  })
);
```

#### 1.7.1.2. Example: DynamoDB Read Permission

```typescript
// Grant authenticated role DynamoDB read permission
iam.roles.authenticated.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["dynamodb:GetItem", "dynamodb:Query"],
    resources: [
      db.tables.get("Merchants").tableArn,
      `${db.tables.get("Merchants").tableArn}/index/*`, // Include GSIs
    ],
  })
);
```

#### 1.7.1.3. Example: Cognito User Attributes

```typescript
// Grant users permission to read their own Cognito attributes
iam.roles.authenticated.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "cognito-identity:GetCredentialsForIdentity",
      "cognito-identity:GetId",
    ],
    resources: ["*"],
  })
);
```

### 6.2. Path-Based Restrictions

**Best practice**: Restrict S3 access to user-specific paths

```typescript
// Merchant can only upload to their own folder
resources: [
  `${bucket.bucketArn}/merchants/\${cognito-identity.amazonaws.com:sub}/*`,
];
```

**How it works**:

- `${cognito-identity.amazonaws.com:sub}` is replaced with user's Identity Pool ID
- Each user can only access their own folder

---

## 7. Testing

### 7.1. Unit Tests

**Location**: `test/lib/iam/roles/construct.test.ts`

**Test role creation**:

```typescript
import { Template } from "aws-cdk-lib/assertions";

test("creates merchant role with correct trust policy", () => {
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::IAM::Role", {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Action: "sts:AssumeRoleWithWebIdentity",
          Principal: {
            Federated: "cognito-identity.amazonaws.com",
          },
          Condition: {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": { Ref: Match.anyValue() },
            },
          },
        },
      ],
    },
  });
});
```

**Test role mapping**:

```typescript
test("maps merchants group to merchant role", () => {
  template.hasResourceProperties("AWS::Cognito::IdentityPoolRoleAttachment", {
    RoleMappings: {
      roleMappingsKey: {
        Type: "Rules",
        RulesConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Claim: "cognito:groups",
              MatchType: "Contains",
              Value: "merchants",
            }),
          ]),
        },
      },
    },
  });
});
```

### 7.2. Integration Testing

**Test with real credentials**:

1. **Authenticate user**:

   ```typescript
   const { tokens } = await signIn(username, password);
   ```

2. **Exchange for AWS credentials**:

   ```typescript
   const credentials = await fetchAuthSession();
   ```

3. **Test AWS service access**:

   ```typescript
   const s3Client = new S3Client({ credentials });
   await s3Client.send(
     new PutObjectCommand({
       Bucket: bucketName,
       Key: "merchants/test.txt",
       Body: "test content",
     })
   );
   ```

4. **Verify role ARN**:
   ```typescript
   const sts = new STSClient({ credentials });
   const identity = await sts.send(new GetCallerIdentityCommand({}));
   expect(identity.Arn).toContain("CognitoMerchantRole");
   ```

---

## 8. Best Practices

### 8.1. Security

✅ **DO**:

- Use path-based restrictions for S3 access
- Grant minimum permissions required
- Use separate roles for different user types
- Set `ambiguousRoleResolution: "Deny"` to prevent role confusion
- Regularly audit role permissions

❌ **DON'T**:

- Grant `*` permissions to user roles
- Allow cross-user data access
- Use the same role for all users
- Hardcode resource ARNs (use CDK references)

### 8.2. Role Design

✅ **DO**:

- Create specific roles for each user type
- Use descriptive role names
- Document role purposes in code comments
- Keep role mappings simple and clear

❌ **DON'T**:

- Create too many roles (increases complexity)
- Use complex rule logic
- Mix authenticated and unauthenticated permissions

### 8.3. Permission Management

✅ **DO**:

- Attach policies in a dedicated construct (`lib/permissions/policies/construct.ts`)
- Group related permissions together
- Use policy statements with clear actions and resources
- Test permissions thoroughly

❌ **DON'T**:

- Scatter permission logic across multiple files
- Use overly broad permissions
- Forget to test permission boundaries

---

## 9. Troubleshooting

### 9.1. User Not Receiving Expected Role

**Symptom**: User gets default authenticated role instead of merchant role

**Causes**:

1. User not in correct Cognito group
2. Role mapping rule not matching
3. Group name mismatch (case-sensitive)

**Solution**:

```bash
# Check user's groups
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <pool-id> \
  --username <username>

# Verify role mapping in CloudFormation
aws cloudformation describe-stack-resources \
  --stack-name <stack-name> \
  --logical-resource-id IdentityPoolRoleAttachment
```

### 9.2. Access Denied Errors

**Symptom**: `AccessDenied` when accessing AWS service

**Causes**:

1. Missing permission in role policy
2. Resource ARN mismatch
3. Path-based restriction blocking access

**Solution**:

```typescript
// Add missing permission
iam.roles.merchant.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:PutObject"],
    resources: [`${bucket.bucketArn}/*`],
  })
);
```

### 9.3. Role Not Assumed

**Symptom**: Identity Pool returns error when exchanging tokens

**Causes**:

1. Trust policy incorrect
2. Identity Pool ID mismatch
3. User Pool provider name wrong

**Solution**:

- Verify trust policy references correct Identity Pool
- Check `identityProvider` in role mapping matches User Pool provider

---

## Related Guides

- [Authentication & Authorization](./authentication.md) - Cognito setup
- [OAuth Scopes](./permissions-oauth-scopes.md) - API-level authorization
- [Auth Overview](../../../docs/guides/auth/overview.md) - Comprehensive concepts
- [SSM Publications](./ssm-publications.md) - Publishing role ARNs

---

**Last Updated**: November 2025  
**Related Constructs**: `AuthConstruct`, `PermissionsConstruct`
