# Backend Implementation Guide

**Service**: Merchants Microservice  
**Stack**: AWS CDK + TypeScript + DynamoDB + Lambda

---

## Overview

This guide covers how to implement backend features for the Merchants microservice using the CDK constructs and patterns established in this template.

**Prerequisites:**

- Story card completed through Phase 3 (API Design & Contracts)
- API specification available at `docs/project/specs/stories/[story]/api.yml`
- Data model designed with access patterns documented

---

## Quick Start

### 1. Review the Story Artifacts

Before implementing, ensure you have:

- ✅ Story card with acceptance criteria
- ✅ Sequence diagrams showing service interactions
- ✅ Actions & Queries document (CQS separation)
- ✅ OpenAPI specification for endpoints
- ✅ DynamoDB data model with entity files

**Location**: `docs/project/specs/stories/[actor]/[story-name]/`

### 2. Understand the Stack Architecture

See [Architecture Overview](../architecture/overview.md) for:

- Stack structure and construct dependencies
- How constructs wire together
- Configuration management via SSM

### 3. Implementation Workflow

Follow these guides in order:

1. **[Data Access Layer](./data-access.md)** - Implement DynamoDB operations
2. **[Adding Endpoints](./adding-endpoints.md)** - Create Lambda handlers and wire to API Gateway
3. **[Using Constructs](./using-constructs.md)** - Leverage existing CDK constructs
4. **[Testing](./testing.md)** - Unit and integration tests
5. **[Deployment](./deployment.md)** - Deploy to AWS environments

---

## Implementation Guides

### Core Implementation

- **[Data Access Layer](./data-access.md)** - DynamoDB operations, entity modeling, access patterns
- **[Adding Endpoints](./adding-endpoints.md)** - Lambda handlers, API Gateway integration, request/response handling
- **[Using Constructs](./using-constructs.md)** - How to use Auth, Database, API, Monitor constructs

### Supporting Topics

- **[Authentication & Authorization](./authentication.md)** - Using the Auth construct, Cognito integration
- **[Monitoring & Observability](./monitoring.md)** - CloudWatch alarms, SNS notifications, logging
- **[Testing](./testing.md)** - Unit tests, integration tests, DynamoDB Local
- **[Deployment](./deployment.md)** - CDK deployment, environment configuration

---

## Project Structure

```
svc-merchants/
├── lib/                          # CDK constructs
│   ├── api/                      # API Gateway + Lambda constructs
│   ├── auth/                     # Cognito constructs
│   ├── db/                       # DynamoDB constructs
│   ├── monitor/                  # CloudWatch + SNS constructs
│   ├── permissions/              # OAuth scopes constructs
│   ├── ssm-bindings/             # Read external service configs
│   ├── ssm-publications/         # Publish service configs
│   └── service-stack.ts          # Main stack orchestration
├── src/                          # Application code
│   ├── handlers/                 # Lambda function handlers
│   ├── lib/                      # Shared utilities
│   └── types/                    # TypeScript types
├── test/                         # Tests
│   ├── handlers/                 # Handler tests
│   ├── lib/                      # Library tests
│   └── integration/              # Integration tests
├── config/                       # Environment configuration
├── docs/                         # Documentation
│   ├── implementation/           # This guide
│   └── architecture/             # Architecture docs
└── scripts/                      # Utility scripts
```

---

## Key Concepts

### 1. Construct-Based Architecture

This service uses CDK constructs to encapsulate infrastructure:

- **Reusable** - Constructs can be used across services
- **Composable** - Constructs wire together in the stack
- **Testable** - Each construct can be tested independently

### 2. Configuration Management

Configuration is managed via:

- **Environment files** - `config/{env}.ts` for environment-specific settings
- **SSM Parameters** - Service discovery and secrets management
- **CDK Context** - Build-time configuration

### 3. Service Discovery

Services communicate via SSM Parameter Store:

- **Bindings** - Read external service configs (e.g., Cognito User Pool ID)
- **Publications** - Publish this service's configs for others to consume

See [SSM Bindings Pattern](../../../../docs/guides/patterns/ssm-bindings.md) for details.

---

## Development Workflow

### Typical Story Implementation

1. **Set up local environment**

   ```bash
   npm install
   npm run build
   ```

2. **Implement data access layer**
   - Create entity interfaces in `src/types/`
   - Implement CRUD operations in `src/lib/data-access/`
   - Write unit tests in `test/lib/data-access/`

3. **Implement Lambda handlers**
   - Create handler in `src/handlers/`
   - Implement business logic
   - Add validation and error handling
   - Write handler tests in `test/handlers/`

4. **Wire to API Gateway**
   - Update `lib/api/construct.ts` to add endpoint
   - Configure method, path, authorization
   - Deploy and test

5. **Add monitoring**
   - Configure CloudWatch alarms in `lib/monitor/construct.ts`
   - Set up SNS notifications for critical errors

6. **Integration testing**
   - Test with DynamoDB Local
   - Test API Gateway integration
   - Verify end-to-end flows

7. **Deploy to dev environment**
   ```bash
   npm run deploy:dev
   ```

---

## Best Practices

### Code Organization

- ✅ **Separate concerns** - Keep handlers thin, business logic in `src/lib/`
- ✅ **Type everything** - Use TypeScript interfaces for all data structures
- ✅ **Error handling** - Use custom error types, handle all error cases
- ✅ **Logging** - Use structured logging with context

### Testing

- ✅ **Test pyramid** - Many unit tests, fewer integration tests
- ✅ **Mock external dependencies** - Use mocks for AWS SDK calls in unit tests
- ✅ **Integration tests** - Use DynamoDB Local for realistic testing
- ✅ **Test error paths** - Don't just test happy paths

### Performance

- ✅ **Optimize DynamoDB queries** - Design for access patterns, avoid scans
- ✅ **Batch operations** - Use batch writes/reads when possible
- ✅ **Lambda cold starts** - Keep dependencies minimal, use layers for large deps
- ✅ **Caching** - Cache frequently accessed data (DynamoDB DAX, Lambda env vars)

### Security

- ✅ **Least privilege IAM** - Grant only necessary permissions
- ✅ **Input validation** - Validate all inputs at handler entry
- ✅ **Secrets management** - Use SSM Parameter Store for secrets
- ✅ **Audit logging** - Log all data mutations with user context

---

## Troubleshooting

### Common Issues

**Issue**: CDK deploy fails with "Resource already exists"

- **Solution**: Check if resource was manually created, or if stack name conflicts

**Issue**: Lambda can't access DynamoDB

- **Solution**: Verify IAM role has correct permissions, check table name environment variable

**Issue**: API Gateway returns 403 Forbidden

- **Solution**: Check Cognito authorizer configuration, verify JWT token is valid

**Issue**: Tests fail with "Cannot find module"

- **Solution**: Run `npm run build` to compile TypeScript, check import paths

---

## Getting Help

- **Central Guides**: See `docs/guides/` for cross-cutting concerns
- **Architecture**: See `docs/architecture/overview.md` for stack structure
- **Testing**: See `docs/guides/testing/` for testing strategies
- **Data Modeling**: See `docs/guides/data-modeling/` for DynamoDB patterns

---

## Story 001 Implementation Log

As we implement Story 001 (Browse Providers by Waste Category), we'll document:

- Decisions made
- Patterns established
- Challenges encountered
- Solutions implemented

**See**: [Story 001 Implementation Log](./story-001-implementation-log.md)
