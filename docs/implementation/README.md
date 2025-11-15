# Backend Implementation Guide

**Service**: Merchants Microservice  
**Stack**: AWS CDK + TypeScript + DynamoDB + Lambda

---

## Overview

This directory contains implementation guides for building backend features in the Merchants microservice.

**Prerequisites:**

- ✅ Story card completed through Phase 3 (API Design & Contracts)
- ✅ API specification available
- ✅ Data model designed with access patterns documented

---

## Getting Started

**Just finished Phase 3 (API Design & Contracts)?** Start here:

### 1. Read the Microservice Development Guide

**[→ Microservice Development Guide](./microservice-development-guide.md)**

This is your **primary guide** for implementing backend features. It provides:

- ✅ Comprehensive 11-step workflow (from bootstrap to deployment)
- ✅ Step-by-step instructions with examples
- ✅ Testing strategy integrated throughout
- ✅ When to reference detailed implementation guides
- ✅ Best practices and troubleshooting

### 2. Reference Implementation Guides

Use these detailed guides as needed (referenced in the Microservice Development Guide):

**Core Guides** (used in main workflow):

- **[Configuration Management](./configuration-management.md)** - Environment config, `.env` setup, validation
- **[Environment Variables](./environment-variables.md)** - CDK vs Lambda contexts, best practices
- **[Database Setup](./database-setup.md)** - DynamoDB tables (Faux-SQL vs Single-Table)
- **[Data Access Layer](./data-access.md)** - DynamoDB operations, transforms
- **[Adding Endpoints](./adding-endpoints.md)** - Lambda handlers, API Gateway
- **[Testing](./testing.md)** - Unit, handler, CDK template, E2E tests
- **[Deployment](./deployment.md)** - CDK deployment, environments
- **[Monitoring & Observability](./monitoring.md)** - CloudWatch, alarms, SNS

**Optional Guides** (use when needed):

- **[Authentication & Authorization](./authentication.md)** - Cognito User Pool, Identity Pool
- **[IAM Roles](./iam-roles.md)** - Role-based access control
- **[OAuth Scopes](./permissions-oauth-scopes.md)** - Fine-grained API authorization
- **[SSM Bindings](./ssm-bindings.md)** - Consuming configs from other services
- **[SSM Publications](./ssm-publications.md)** - Publishing configs for other services

**Reference**:

- **[Using Constructs](./using-constructs.md)** - CDK construct patterns overview

### 3. Track Your Progress

- **[Guide Updates Tracker](./guide-updates-tracker.md)** - Track guide updates per resource

---

## Key Concepts

### Construct-Based Architecture

- **Reusable** - Constructs can be used across services
- **Composable** - Constructs wire together in the stack
- **Testable** - Each construct can be tested independently

### Configuration Management

- **Layered approach** - Base defaults + environment overrides + runtime variables
- **Type-safe** - TypeScript interfaces + Zod validation
- **Environment-specific** - `.env` for local, config files for staging/production

### Testing Strategy

- **CDK Template Tests** - Validate infrastructure resources
- **Unit Tests** - Test helpers and data access functions
- **Handler Tests** - Test Lambda behavior with mocked AWS SDK
- **Schema Tests** - Validate Zod schemas
- **E2E Tests** - Test deployed API (optional, in CI/CD)

See [Testing Strategy](../../../../docs/guides/testing/testing-strategy.md) for details.

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

## Quick Reference Commands

```bash
# Development
npm run build          # Compile TypeScript
npm run watch          # Watch mode for development
npm run test           # Run all tests
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests only

# CDK
npm run synth          # Synthesize CloudFormation
npm run diff           # Show changes to be deployed
npm run deploy:dev     # Deploy to dev environment
npm run deploy:staging # Deploy to staging
npm run deploy:prod    # Deploy to production

# DynamoDB Local
npm run dynamodb:start # Start DynamoDB Local
npm run dynamodb:stop  # Stop DynamoDB Local

# Linting
npm run lint           # Run ESLint
npm run lint:fix       # Fix linting issues
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
