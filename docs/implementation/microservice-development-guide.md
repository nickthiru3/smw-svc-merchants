# Microservice Development Guide

**Purpose**: Comprehensive guide for implementing backend features in a microservice  
**Audience**: Backend developers implementing stories (Phase 4)  
**Prerequisites**: Story completed through Phase 3 (API Design & Contracts)

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1. [Purpose](#11-purpose)
   - 1.2. [When to Use This Guide](#12-when-to-use-this-guide)
   - 1.3. [How This Guide Relates to Other Docs](#13-how-this-guide-relates-to-other-docs)
2. [Core Principles](#2-core-principles)
   - 2.1. [Treat All Guides as Placeholders](#21-treat-all-guides-as-placeholders)
   - 2.2. [Generic vs App-Specific Documentation](#22-generic-vs-app-specific-documentation)
   - 2.3. [Bottom-Up Implementation Approach](#23-bottom-up-implementation-approach)
   - 2.4. [Test-Driven Development](#24-test-driven-development)
3. [Development Workflow](#3-development-workflow)
   - 3.1. [Step 0: Bootstrap from Template](#31-step-0-bootstrap-from-template)
   - 3.2. [Step 1: Review Story Artifacts](#32-step-1-review-story-artifacts)
   - 3.3. [Step 2: Configure Service](#33-step-2-configure-service)
   - 3.4. [Step 3: Configure Database Tables](#34-step-3-configure-database-tables)
   - 3.5. [Step 4: Implement Lambda Handlers & Data Access](#35-step-4-implement-lambda-handlers--data-access)
   - 3.6. [Step 5: Wire to API Gateway](#36-step-5-wire-to-api-gateway)
   - 3.7. [Step 6: Run All Tests Locally](#37-step-6-run-all-tests-locally)
   - 3.8. [Step 7: Deploy to Dev Environment](#38-step-7-deploy-to-dev-environment)
   - 3.9. [Step 8: E2E Testing (Optional)](#39-step-8-e2e-testing-optional)
   - 3.10. [Step 9: Add Monitoring](#310-step-9-add-monitoring)
   - 3.11. [Step 10: Document & Track](#311-step-10-document--track)
4. [Optional & Advanced Constructs](#4-optional--advanced-constructs)
   - 4.1. [Overview](#41-overview)
   - 4.2. [Authentication & Authorization](#42-authentication--authorization)
   - 4.3. [Cross-Service Communication (SSM)](#43-cross-service-communication-ssm)
   - 4.4. [Event-Driven Architecture (Future)](#44-event-driven-architecture-future)
   - 4.5. [Feature Flags](#45-feature-flags)
   - 4.6. [Summary: When to Use Each Construct](#46-summary-when-to-use-each-construct)
5. [Workflow Per Resource](#5-workflow-per-resource)
6. [Testing Strategy](#6-testing-strategy)
7. [Artifacts Reference](#7-artifacts-reference)
8. [Time Estimates](#8-time-estimates)
9. [Success Criteria](#9-success-criteria)
10. [Best Practices](#10-best-practices)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Overview

### 1.1. Purpose {#11-purpose}

This guide provides a **comprehensive, step-by-step workflow** for implementing backend features in a microservice after completing Phase 1-3 of the Design & Development Methodology.

### 1.2. When to Use This Guide {#12-when-to-use-this-guide}

**You should be here if**:

- ✅ You've completed Phase 1 (Requirements & Product Discovery)
- ✅ You've completed Phase 2 (Conceptual Design)
- ✅ You've completed Phase 3 (API Design & Contracts)
- ✅ You have story artifacts ready (story card, data model, sequence diagram, OpenAPI spec)
- ✅ You're ready to implement the backend

**If you haven't completed Phase 1-3**, see:

- [Design & Development Methodology](../../../../docs/guides/design-and-development/design-and-development-methodology-v3.md)

### 1.3. How This Guide Relates to Other Docs {#13-how-this-guide-relates-to-other-docs}

```
Design & Development Methodology (Phase 1-3)
    ↓
Microservice Development Guide (Phase 4) ← YOU ARE HERE
    ↓
Implementation Guides (detailed topics)
    ├── Configuration Management
    ├── Environment Variables
    ├── Database Setup
    ├── Data Access Layer
    ├── Adding Endpoints
    ├── Testing
    ├── Deployment
    └── Monitoring
```

**This guide**: High-level workflow and when to reference detailed guides  
**Implementation guides**: Deep dives into specific topics

---

## 2. Core Principles

### 2.1. Treat All Guides as Placeholders {#21-treat-all-guides-as-placeholders}

**Rationale**: Even detailed guides should be validated against actual implementation.

**Approach**:

- Implement following the opinionated microservice template patterns
- Let implementation inform documentation, not the other way around
- Validate guide content against working code
- Update guides to reflect actual patterns used

### 2.2. Generic vs App-Specific Documentation {#22-generic-vs-app-specific-documentation}

**Generic Documentation** (Implementation Guides):

- ✅ CDK construct usage patterns
- ✅ Resource provisioning approaches
- ✅ Testing strategies and best practices
- ✅ Common patterns (e.g., "how to add a GSI")

**Location**: `docs/implementation/*.md`  
**Purpose**: Reusable for microservice template

**App-Specific Documentation** (Code Comments):

- ✅ Business logic details
- ✅ Specific entity schemas for your app
- ✅ Actual access patterns for your use cases
- ✅ App-specific configuration

**Location**: Inline code comments, JSDoc  
**Purpose**: Preserve context without cluttering guides

### 2.3. Bottom-Up Implementation Approach {#23-bottom-up-implementation-approach}

**Order**: Data Layer → Business Logic → API → Monitoring → Testing → Deployment

**Rationale**:

- ✅ **Data layer first** - Defines entity structure, can be unit tested independently
- ✅ **Lambda depends on data layer** - Business logic uses data access layer
- ✅ **API Gateway is thin** - Just proxies to Lambda
- ✅ **Testing throughout** - Unit tests alongside code, E2E after full stack

### 2.4. Test-Driven Development {#24-test-driven-development}

**Write tests after each step**, not at the end:

- CDK template tests after infrastructure changes
- Unit tests for data access helpers
- Handler tests with mocked AWS SDK
- E2E tests against deployed API

---

## 3. Development Workflow

### 3.1. Step 0: Bootstrap from Template

**When**: Starting a new microservice from the template project

**Tasks**:

1. **Clone microservice template**
2. **Update `package.json` metadata**:
   ```json
   {
     "name": "your-service-name",
     "version": "0.1.0"
   }
   ```
3. **Copy `.env.example` to `.env`**: `cp .env.example .env`
4. **Update `.env` with your values**
5. **Install dependencies**: `npm install`
6. **Verify setup**: `npm run build && npm test`

**See**:

- [Configuration Management Guide](./configuration-management.md) - Detailed `.env` setup and config files
- [Environment Variables Guide](./environment-variables.md) - Understanding CDK vs Lambda contexts

---

### 3.2. Step 1: Review Story Artifacts

**Purpose**: Understand what to build before writing code

**Artifacts**:

- **Story Card**: Acceptance criteria, scope
- **UI Mockups**: Frontend context
- **Data Model**: Entities, access patterns
- **Sequence Diagram**: Flow, interactions
- **Actions & Queries**: CQS separation
- **OpenAPI Spec**: API contract

**Location**: `docs/project/specs/stories/[actor]/[story]/`

---

### 3.3. Step 2: Configure Service

**Purpose**: Set up environment-specific configuration

**Tasks**:

- Verify `.env` has correct values
- Update environment-specific overrides (if needed)
- Understand how config flows through the system

**See**:

- [Configuration Management Guide](./configuration-management.md) - Config files and environment overrides
- [Environment Variables Guide](./environment-variables.md) - "Two Worlds" concept (already covered in Step 0)

---

### 3.4. Step 3: Configure Database Tables

**Purpose**: Define DynamoDB tables based on Phase 2 data model

**Guide**: [Database Setup](./database-setup.md)

**Implementation**:

1. Open `config/database.ts`
2. Choose Faux-SQL or Single-Table approach
3. Define table(s) with generic GSI names (`GSI1`, `GSI1PK`)

**Testing**: Write CDK template tests

- Test table creation, keys, GSIs, PITR

**Verify**: `npm run synth && npm test`

---

### 3.5. Step 4: Implement Lambda Handlers & Data Access

**Purpose**: Implement business logic and data access layer

**Guides**: [Adding Endpoints](./adding-endpoints.md) | [Data Access Layer](./data-access.md)

**Implementation**:

1. **Create entity interfaces** in `src/types/entities/`
2. **Implement data access layer** in `src/lib/data-access/`
3. **Create Lambda handlers** in `src/handlers/[endpoint]/`

**Testing**: Write unit, handler, and schema tests

**Verify**: `npm test`

---

### 3.6. Step 5: Wire to API Gateway

**Purpose**: Connect Lambda handlers to API Gateway

**Guide**: [Adding Endpoints](./adding-endpoints.md)

**Implementation**:

1. Create endpoint construct
2. Configure Lambda function
3. Grant IAM permissions
4. Wire to API Gateway

**Testing**: Update CDK template tests

**Verify**: `npm run synth && npm test`

---

### 3.7. Step 6: Run All Tests Locally

**Purpose**: Verify everything works before deploying

**Command**: `npm test`

**All tests must pass before proceeding.**

---

### 3.8. Step 7: Deploy to Dev Environment

**Purpose**: Deploy to AWS for integration testing

**Command**: `npm run deploy:dev`

**Verify**:

- CloudFormation stack status
- Test deployed API endpoint
- Check CloudWatch logs
- Verify DynamoDB table created

---

### 3.9. Step 8: E2E Testing (Optional)

**Purpose**: Test against deployed API

**Command**: `npm run test:e2e`

**See**: [E2E Testing Guide](../../../../docs/guides/testing/e2e-testing-guide.md)

---

### 3.10. Step 9: Add Monitoring

**Purpose**: Set up observability

**Tasks**:

- Configure CloudWatch alarms
- Set up SNS notifications
- Add structured logging

**See**: [Monitoring Guide](./monitoring.md)

---

### 3.11. Step 10: Document & Track

**Purpose**: Keep documentation up to date

**Tasks**:

- Update [Guide Updates Tracker](./guide-updates-tracker.md)
- Document patterns discovered
- Update relevant guides

---

## 4. Optional & Advanced Constructs

The microservice template includes additional AWS service constructs that may not be needed for every story. This section covers when to use them and how to implement them.

### 4.1. Overview

**Core constructs** (covered in main workflow):

- ✅ **Database** (DynamoDB) - Step 3
- ✅ **Lambda Handlers** - Step 4
- ✅ **API Gateway** - Step 5
- ✅ **Monitoring** (CloudWatch) - Step 9

**Optional constructs** (use when needed):

- 🔐 **Authentication & Authorization** - User authentication, role-based access
- 🔗 **Cross-Service Communication** (SSM) - Read/publish configs from/to other services
- 📡 **Event-Driven Architecture** (Future) - Async communication via SNS/EventBridge

---

### 4.2. Authentication & Authorization

**When needed**: Your API requires user authentication and authorization

**Constructs in `service-stack.ts`**:

- `AuthConstruct` - Cognito User Pool, Identity Pool, User Groups
- `IamConstruct` - IAM roles for different user types
- `PermissionsConstruct` - OAuth scopes for fine-grained API authorization (optional, feature-flagged)

**Implementation Guides**:

- **[Authentication & Authorization](./authentication.md)** - Microservice implementation
- **[IAM Roles](./iam-roles.md)** - Role-based access control
- **[OAuth Scopes](./permissions-oauth-scopes.md)** - Fine-grained authorization
- **[Auth Overview](../../../docs/guides/auth/overview.md)** - Comprehensive concepts
- **[End-to-End Auth](../../../docs/guides/auth/end-to-end-auth.md)** - Cross-service patterns

#### Key Concepts

**Cognito User Pool**:

- User directory for registration and sign-in
- Email verification, password policies, MFA
- User groups for segmentation (e.g., merchants, customers)

**Cognito Identity Pool**:

- Issues temporary AWS credentials for authenticated users
- Maps users to IAM roles based on group membership
- Enables direct access to AWS services (e.g., S3 uploads)

**IAM Roles**:

- Different roles for different user types
- Fine-grained permissions for AWS resources
- Attached to users via Identity Pool role mapping

**OAuth Scopes** (Optional):

- Fine-grained API permissions (read, write, delete)
- Enforced at API Gateway method level
- Requires Resource Server definition in Cognito

#### When to Implement

**Implement Auth when**:

- Story requires user authentication
- Different permission levels needed (merchant vs customer)
- Users need direct AWS service access (e.g., S3 uploads)

**Implement OAuth Scopes when**:

- Fine-grained API authorization required
- Different operations need different permissions
- OpenAPI spec defines scope-based access

#### Implementation Order

If your story requires authentication:

1. ✅ **Complete core workflow** (Steps 0-10) - Get API working without auth
2. ➕ **Add AuthConstruct** - User Pool, Identity Pool, Groups
   - Study `lib/auth/construct.ts`
   - Configure in `service-stack.ts`
   - See: [Authentication Guide](./authentication.md)
3. ➕ **Add IamConstruct** - Roles for user types
   - Study `lib/iam/construct.ts`
   - Define roles in `lib/iam/roles/construct.ts`
   - See: [IAM Roles Guide](./iam-roles.md)
4. ➕ **Add PermissionsConstruct** (Optional) - OAuth scopes
   - Enable via `config.features.permissionsEnabled = true`
   - Study `lib/permissions/construct.ts`
   - See: [OAuth Scopes Guide](./permissions-oauth-scopes.md)
5. ➕ **Update API Gateway** - Add Cognito authorizer
   - Study `lib/api/authorization/construct.ts`
   - Add authorizer to endpoints
6. ✅ **Test with authentication** - Verify auth flow works
7. ✅ **Deploy and verify** - Test in dev environment

#### Architecture

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

IamConstruct
└── RolesConstruct
    ├── Merchant Role (with S3 upload permissions)
    └── Customer Role (read-only permissions)

PermissionsConstruct (Optional)
├── ResourceServerConstruct (OAuth resource server)
└── OAuthConstruct (scope-based auth options)
```

---

### 4.3. Cross-Service Communication (SSM)

**When needed**: Your service needs to read configs from other services OR publish configs for others to consume

**Constructs in `service-stack.ts`**:

- `SsmBindingsConstruct` - Read external service configs (consumer)
- `SsmPublicationsConstruct` - Publish configs for other services (producer)

**Implementation Guides**:

- **[SSM Bindings](./ssm-bindings.md)** - Read from other services (consumer)
- **[SSM Publications](./ssm-publications.md)** - Publish for others (producer)

#### Key Concepts

**SSM Parameter Store**:

- Centralized configuration storage
- Hierarchical parameter naming
- Cross-service config sharing

**infra-contracts Package**:

- Shared TypeScript interfaces
- Type-safe config consumption
- Versioned contracts

**Parameter Naming Convention**:

```
/app-name/<env>/<service-name>/<visibility>/<key>

Examples:
/smw/dev/users-ms/public/auth/userPoolId
/smw/dev/website-ms/public/website/url
/smw/prod/merchants-ms/public/api/url
```

#### Use Cases

**Bindings (Consumer)**:

- ✅ Import User Pool ID from `users-ms` for authentication
- ✅ Import website URL from `website-ms` for email links
- ✅ Import IAM role ARNs from `users-ms` for cross-service permissions
- ✅ Import monitoring webhook URL for alerts

**Publications (Producer)**:

- ✅ Publish API URL for frontend consumption
- ✅ Publish User Pool ID for other services
- ✅ Publish IAM role ARNs for cross-service access
- ✅ Publish DynamoDB table names for admin tools

#### When to Implement

**Implement Bindings when**:

- Your service depends on resources from another service
- You need to reference external User Pools, IAM roles, or URLs
- Cross-service integration required

**Implement Publications when**:

- Other services need to consume your resources
- Frontend needs your API URL or config values
- Admin tools need access to your infrastructure

#### Implementation Order

**Consumer (Bindings)**:

1. ➕ **Add early** (Step 0-2) - Before using external resources
2. ➕ **Define contracts** - Add interfaces to `infra-contracts` package
3. ➕ **Add SsmBindingsConstruct** - Read parameters
   - Study `lib/ssm-bindings/construct.ts`
   - Configure in `service-stack.ts` (already first construct)
   - See: [SSM Bindings Guide](./ssm-bindings.md)
4. ➕ **Use bindings** - Reference in other constructs
   - Example: `auth.userPool = UserPool.fromUserPoolId(..., bindings.userPoolId)`

**Producer (Publications)**:

1. ➕ **Add late** (After Step 10) - After all resources created
2. ➕ **Define contracts** - Add interfaces to `infra-contracts` package
3. ➕ **Add SsmPublicationsConstruct** - Publish parameters
   - Study `lib/ssm-publications/construct.ts`
   - Configure in `service-stack.ts` (already last construct)
   - See: [SSM Publications Guide](./ssm-publications.md)
4. ➕ **Verify** - Check parameters in AWS Console

#### Architecture

```
SsmBindingsConstruct (Consumer)
└── Reads from SSM Parameter Store
    ├── /smw/dev/users-ms/public/auth/userPoolId
    ├── /smw/dev/website-ms/public/website/url
    └── /smw/dev/users-ms/public/iam/roles/merchant/arn

SsmPublicationsConstruct (Producer)
└── Writes to SSM Parameter Store
    ├── /smw/dev/merchants-ms/public/auth/userPoolId
    ├── /smw/dev/merchants-ms/public/iam/roles/merchant/arn
    └── /smw/dev/merchants-ms/public/api/url
```

---

### 4.4. Event-Driven Architecture (Future)

**When needed**: Asynchronous communication between services

**Construct**: `EventsConstruct` (currently commented out in `service-stack.ts`)

**Use Cases**:

- Publish events when data changes (e.g., merchant created, deal updated)
- Subscribe to events from other services
- Decouple services via event bus
- Trigger workflows based on events

**Status**: Not yet implemented - coming in future stories

**Technologies**:

- Amazon SNS (Simple Notification Service)
- Amazon EventBridge (Event Bus)
- Lambda event handlers

---

### 4.5. Feature Flags

Some constructs are feature-flagged for optional enablement:

**PermissionsConstruct** (OAuth Scopes):

```typescript
// config/default.ts
features: {
  permissionsEnabled: false, // Set to true to enable OAuth scopes
}
```

**When to enable**:

- Production deployments requiring fine-grained authorization
- OAuth scopes defined in OpenAPI spec
- After basic authentication is working

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

---

### 4.6. Summary: When to Use Each Construct

| Construct            | When Needed                  | Implementation Guide                          |
| -------------------- | ---------------------------- | --------------------------------------------- |
| **Database**         | Always (data storage)        | [Database Setup](./database-setup.md)         |
| **Lambda**           | Always (business logic)      | [Adding Endpoints](./adding-endpoints.md)     |
| **API Gateway**      | Always (REST API)            | [Adding Endpoints](./adding-endpoints.md)     |
| **Monitoring**       | Always (observability)       | [Monitoring](./monitoring.md)                 |
| **Auth**             | User authentication required | [Authentication](./authentication.md)         |
| **IAM**              | Role-based access control    | [IAM Roles](./iam-roles.md)                   |
| **Permissions**      | Fine-grained OAuth scopes    | [OAuth Scopes](./permissions-oauth-scopes.md) |
| **SSM Bindings**     | Consume from other services  | [SSM Bindings](./ssm-bindings.md)             |
| **SSM Publications** | Publish for other services   | [SSM Publications](./ssm-publications.md)     |
| **Events**           | Async service communication  | Future                                        |

---

## 5. Workflow Per Resource

For each resource, follow this 5-step process:

1. **Implement** - Follow template patterns, write tests
2. **Document** - Record decisions and challenges
3. **Analyze** - Compare with guides, note deviations
4. **Discuss** - Provide feedback and suggestions
5. **Update** - Make generic updates to guides

---

## 6. Testing Strategy

### Test Layers

| Test Type        | When                 | Guide                                                                                 |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------- |
| **CDK Template** | After infrastructure | [CDK Template Testing](../../../../docs/guides/testing/cdk-template-testing-guide.md) |
| **Unit**         | After helpers        | [Unit Testing](../../../../docs/guides/testing/unit-helpers-testing-guide.md)         |
| **Handler**      | After Lambda         | [Handler Testing](../../../../docs/guides/testing/handler-testing-guide.md)           |
| **Schema**       | After validation     | [Schema Testing](../../../../docs/guides/testing/schema-testing-guide.md)             |
| **E2E**          | After deployment     | [E2E Testing](../../../../docs/guides/testing/e2e-testing-guide.md)                   |

**See**: [Testing Strategy](../../../../docs/guides/testing/testing-strategy.md)

---

## 7. Artifacts Reference

| Artifact          | Purpose                   | Location                                                            |
| ----------------- | ------------------------- | ------------------------------------------------------------------- |
| Story Card        | Acceptance criteria       | `docs/project/specs/stories/[actor]/[story]/story-card.md`          |
| Sequence Diagram  | Flow, interactions        | `docs/project/specs/stories/[actor]/[story]/sequence-diagram.puml`  |
| Actions & Queries | Operations                | `docs/project/specs/stories/[actor]/[story]/actions-and-queries.md` |
| Data Model        | Entities, access patterns | `docs/project/specs/stories/[actor]/[story]/data-model.md`          |
| OpenAPI Spec      | API contract              | `docs/project/specs/api/openapi.yaml`                               |

---

## 8. Time Estimates

| Resource                | Estimated Sessions | Notes                                      |
| ----------------------- | ------------------ | ------------------------------------------ |
| DynamoDB + Access Layer | 2-3 sessions       | Entity, access patterns, transforms, tests |
| Lambda Handler          | 1-2 sessions       | Handler, validation, business logic, tests |
| API Gateway             | 1 session          | REST API, integration, CORS                |
| Monitoring              | 1 session          | Logs, metrics, alarms, SNS                 |
| E2E Testing             | 1 session          | Deploy, test full flow                     |
| Guide Updates           | 1 session          | Review and finalize                        |
| **Total**               | **7-10 sessions**  | Includes implementation + documentation    |

---

## 9. Success Criteria

### Implementation Complete When:

- ✅ All resources implemented and tested
- ✅ Story acceptance criteria met
- ✅ E2E tests passing
- ✅ Deployed to dev environment
- ✅ Monitoring and alarms working

### Documentation Complete When:

- ✅ Guide updates tracker filled out
- ✅ Generic patterns extracted
- ✅ Guides updated with real examples
- ✅ Code comments added for app-specific details
- ✅ Patterns ready for template

---

## 10. Best Practices

### Configuration

- Use `.env` for local development
- Never commit `.env` to git
- Use AWS profiles/SSO for credentials
- CDK constructs use `config` object
- Lambda handlers read `process.env`

### Testing

- Write tests after each step
- Mock AWS SDK in handler tests
- Use `outputs.json` for E2E tests
- Target 80%+ test coverage

### Documentation

- Keep guides generic (reusable)
- Put app-specific details in code comments
- Update guides as you discover patterns
- Track all updates in guide-updates-tracker.md

---

## 11. Troubleshooting

### Config value is undefined

- Check `.env` file exists and has value
- Verify `dotenv.config()` called in `bin/app.ts`
- Check config validation in `config/default.ts`

### Lambda can't find environment variable

- Check construct sets env var in `environment` property
- Verify in AWS Console: Lambda → Configuration → Environment variables

### Tests fail with missing env var

- Set env vars in test `beforeEach` block
- Save and restore original `process.env`

### E2E tests can't find API URL

- Deploy with `--outputs-file outputs.json`
- Verify `outputs.json` exists
- Check test support file reads outputs correctly

---

## Related Guides

- [Configuration Management](./configuration-management.md)
- [Environment Variables](./environment-variables.md)
- [Database Setup](./database-setup.md)
- [Data Access Layer](./data-access.md)
- [Adding Endpoints](./adding-endpoints.md)
- [Testing](./testing.md)
- [Deployment](./deployment.md)
- [Monitoring & Observability](./monitoring.md)
- [Using Constructs](./using-constructs.md)

---

**Last Updated**: November 2025  
**Related**: [Design & Development Methodology](../../../../docs/guides/design-and-development/design-and-development-methodology-v3.md)
