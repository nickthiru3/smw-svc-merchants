# Guide Updates Tracker - Story 001

**Purpose**: Track guide updates needed after implementing each resource  
**Story**: Browse Providers by Waste Category  
**Project**: svc-merchants

---

## Overview

This document tracks the analysis of each implemented resource against existing guides, identifies gaps, and manages guide updates.

**Workflow**:

1. ✅ Implement resource
2. 🔄 Analyze vs guides
3. 💬 Discuss feedback
4. 📝 Update guides
5. ✅ Mark complete

---

## Resources Implementation Status

| Resource                      | Status     | Analysis | Updates | Complete |
| ----------------------------- | ---------- | -------- | ------- | -------- |
| DynamoDB Table & Access Layer | ✅ Done    | ✅ Done  | ✅ Done | ✅ Done  |
| Lambda Handler                | ⏳ Pending | -        | -       | -        |
| API Gateway                   | ⏳ Pending | -        | -       | -        |
| Monitoring & Alarms           | ⏳ Pending | -        | -       | -        |
| Testing                       | ⏳ Pending | -        | -       | -        |
| Deployment                    | ⏳ Pending | -        | -       | -        |

**Legend**: ⏳ Pending | 🔄 In Progress | ✅ Complete

---

## 1. DynamoDB Table & Access Layer

### Implementation Status

**Status**: ✅ Complete (2025-11-11)

### Implementation Analysis

**Date**: 2025-11-11

**Construct Patterns Used**:

- **Facade Pattern**: `lib/db/construct.ts` delegates to either Faux-SQL or Single-Table construct
- **Config-Driven Approach**: Table definitions in `config/database.ts`, not hardcoded
- **Multi-Table Support**: Faux-SQL construct creates multiple tables from config array
- **Descriptive Keys**: MerchantId, Category (vs generic PK, SK)
- **Simple GSIs**: One index per access pattern (CategoryIndex)

**Deviations from Guide**:

- **NEW**: Config-driven approach (not in original placeholder guides)
- **NEW**: Facade pattern for approach selection
- **NEW**: Removed deprecated `table` property (not needed for new app)
- **CHANGED**: Table config moved from construct to `config/database.ts`

**New Patterns Discovered**:

- **Config-Driven Database**: Centralized table definitions in config
- **Approach Selection**: Runtime selection between Faux-SQL and Single-Table
- **Type Safety**: Exported interfaces from `config/database.ts` for reuse
- **Environment Consistency**: Same config structure across all environments

**App-Specific vs Generic**:

- **Generic patterns** (template-ready):
  - Facade pattern in `lib/db/construct.ts`
  - Faux-SQL construct structure
  - Single-Table construct structure
  - Config interface definitions
- **SMW-specific** (in config):
  - Merchants table definition
  - CategoryIndex GSI
  - Faux-SQL approach selection

### Guide Updates Needed

**database-setup.md** (NEW GUIDE):

- [x] Created comprehensive database setup guide
- [x] Documented Faux-SQL approach
- [x] Documented Single-Table approach
- [x] Added configuration examples
- [x] Added access pattern examples
- [x] Added switching approaches guide
- [x] Added troubleshooting section
- [x] Added "When to Use Multiple Tables" section with decision framework
- [x] Added examples: single table vs multiple tables
- [x] Clarified `db.table` vs `db.tables.get()` usage

**configuration-management.md** (NEW GUIDE):

- [x] Created comprehensive configuration management guide
- [x] Documented IConfig interface and structure
- [x] Explained layered configuration approach (base + overrides + runtime)
- [x] Documented all environment files (default, localstack, staging, production)
- [x] Added environment variable reference table
- [x] Explained configuration usage in constructs vs handlers
- [x] Added Zod validation documentation
- [x] Added configuration workflow for local and deployed environments
- [x] Added best practices and troubleshooting
- [x] Linked to database-setup.md for database config details

**microservice-development-guide.md** (NEW GUIDE):

- [x] Created comprehensive microservice development guide (800+ lines)
- [x] Incorporated phase-4-implementation-strategy.md content
- [x] Added detailed 11-step workflow (Step 0-10)
- [x] Added Step 0: Bootstrap from Template (package.json, .env setup)
- [x] Integrated testing strategy throughout workflow
- [x] Added "Workflow Per Resource" section (5-step process)
- [x] Added "Artifacts Reference" section
- [x] Added "Time Estimates" section
- [x] Added "Success Criteria" section
- [x] Added "Best Practices" section
- [x] Added "Troubleshooting" section
- [x] Linked to all implementation guides
- [x] Made it the primary guide for Phase 4 implementation

**environment-variables.md**:

- [x] Moved from docs/guides/design-and-development/ to svc-merchants/docs/implementation/
- [x] Integrated into Step 2 of microservice development guide
- [x] Referenced in configuration-management.md
- [x] Now microservice-specific (not general design guide)

**README.md** (SIMPLIFIED):

- [x] Reduced from 400+ lines to ~150 lines
- [x] Made it a navigation hub, not detailed guide
- [x] Moved detailed workflow to microservice-development-guide.md
- [x] Added clear "Getting Started" section with 3 steps
- [x] Pointed to microservice-development-guide.md as primary guide
- [x] Simplified Implementation Guides to reference list
- [x] Kept quick reference commands and project structure
- [x] Simplified Key Concepts section
- [x] Removed all detailed workflow steps

**using-constructs.md**:

- [x] Updated to reference detailed database-setup.md guide
- [ ] Add overview section linking to all detailed guides

---

## November 2025 - Optional & Advanced Constructs Integration

**microservice-development-guide.md** (MAJOR UPDATE):

- [x] Added comprehensive "Optional & Advanced Constructs" section (300+ lines)
- [x] Documented Authentication & Authorization constructs
- [x] Documented Cross-Service Communication (SSM) constructs
- [x] Documented Event-Driven Architecture (future)
- [x] Added implementation order for each construct type
- [x] Added architecture diagrams
- [x] Added feature flags documentation
- [x] Added summary table of when to use each construct
- [x] Linked to all new implementation guides

**iam-roles.md** (NEW GUIDE):

- [x] Created comprehensive IAM Roles implementation guide
- [x] Documented role types (authenticated, unauthenticated, user-specific)
- [x] Documented role mapping via Identity Pool
- [x] Added implementation steps with code examples
- [x] Documented permission attachment patterns
- [x] Added path-based S3 restrictions
- [x] Added testing section (unit and integration tests)
- [x] Added best practices and troubleshooting
- [x] Linked to auth and permissions guides

**permissions-oauth-scopes.md** (NEW GUIDE):

- [x] Created comprehensive OAuth Scopes implementation guide
- [x] Documented Resource Server concept
- [x] Documented OAuth scopes (read, write, delete)
- [x] Documented scope assignment flow
- [x] Added implementation steps for Resource Server and OAuth constructs
- [x] Documented API Gateway integration
- [x] Added scope format (slash-form vs colon-form)
- [x] Added testing section (CDK template and integration tests)
- [x] Added feature flag usage
- [x] Added best practices and troubleshooting

**ssm-publications.md** (NEW GUIDE):

- [x] Created comprehensive SSM Publications implementation guide
- [x] Documented parameter naming convention
- [x] Documented infra-contracts package usage
- [x] Documented producer-consumer pattern
- [x] Added implementation steps for publishing auth and IAM parameters
- [x] Documented parameter types (String vs SecureString)
- [x] Added examples for adding new publications (API URL)
- [x] Added testing section (CDK template and integration tests)
- [x] Added best practices for contract management
- [x] Added troubleshooting section

**authentication.md** (UPDATED):

- [x] Completely rewrote from placeholder to comprehensive guide
- [x] Added references to all comprehensive auth guides
- [x] Documented microservice-specific Auth construct implementation
- [x] Added architecture diagram and construct hierarchy
- [x] Documented key components (User Pool, Identity Pool, User Groups)
- [x] Added dependencies documentation
- [x] Added Quick Start section with 4 scenarios
- [x] Linked to IAM Roles and OAuth Scopes guides
- [x] Linked to SSM Bindings and Publications guides

**README.md** (UPDATED):

- [x] Reorganized Implementation Guides section
- [x] Separated Core Guides from Optional Guides
- [x] Added all new guides to reference list
- [x] Added IAM Roles guide
- [x] Added OAuth Scopes guide
- [x] Added SSM Bindings guide
- [x] Added SSM Publications guide
- [x] Improved organization and clarity

**data-access.md**:

- [ ] Update to use `db.tables.get("Merchants")` pattern
- [ ] Add Faux-SQL query examples
- [ ] Update entity interface pattern for descriptive keys

**testing.md**:

- [ ] Add DynamoDB Local setup for Faux-SQL
- [ ] Update test patterns for config-driven approach

### Feedback & Improvements

**What Worked Well**:

- ✅ **Config-driven approach**: Centralized, easy to maintain
- ✅ **Facade pattern**: Clean separation, easy to switch approaches
- ✅ **Type safety**: Exported interfaces prevent errors
- ✅ **Descriptive keys**: Self-documenting, SQL-like
- ✅ **Comprehensive guide**: Detailed examples and troubleshooting

**Suggested Improvements**:

- ✅ **Removed backward compatibility**: No deprecated `table` property
- ✅ **Centralized config**: All table definitions in one place
- ✅ **Clear documentation**: Separate guide for database setup
- 💡 **Future**: Consider environment-specific table configs

**Questions/Concerns**:

- ✅ **Resolved**: Clarified `tables` prop is for multiple entity types, not multiple tables per entity
- ✅ **Resolved**: Removed unnecessary backward compatibility
- ✅ **Resolved**: Config-driven approach agreed upon

### Update Status

- [x] Analysis complete
- [x] Feedback discussed
- [x] Guides updated
- [x] Changes reviewed

---

## 2. Lambda Handler

### Implementation Status

**Status**: ⏳ Not Started

### Implementation Analysis

**Date**: [To be filled]

**Construct Patterns Used**:

- _To be documented after implementation_

**Deviations from Guide**:

- _To be documented_

**New Patterns Discovered**:

- _To be documented_

### Guide Updates Needed

**adding-endpoints.md**:

- [ ] Update Lambda handler structure
- [ ] Add validation patterns
- [ ] Update response utilities
- [ ] Add error handling examples

**using-constructs.md**:

- [ ] Add Lambda construct usage
- [ ] Document function configuration
- [ ] Add environment variable patterns

**testing.md**:

- [ ] Add handler unit test patterns
- [ ] Update integration test examples

### Feedback & Improvements

**What Worked Well**:

- _To be documented_

**Suggested Improvements**:

- _To be documented_

### Update Status

- [ ] Analysis complete
- [ ] Feedback discussed
- [ ] Guides updated
- [ ] Changes reviewed

---

## 3. API Gateway

### Implementation Status

**Status**: ⏳ Not Started

### Implementation Analysis

**Date**: [To be filled]

**Construct Patterns Used**:

- _To be documented after implementation_

**Deviations from Guide**:

- _To be documented_

**New Patterns Discovered**:

- _To be documented_

### Guide Updates Needed

**adding-endpoints.md**:

- [ ] Update API Gateway wiring
- [ ] Add method configuration
- [ ] Update CORS patterns
- [ ] Add request/response mapping

**using-constructs.md**:

- [ ] Add API Gateway construct usage
- [ ] Document REST API configuration
- [ ] Add authorizer patterns

### Feedback & Improvements

**What Worked Well**:

- _To be documented_

**Suggested Improvements**:

- _To be documented_

### Update Status

- [ ] Analysis complete
- [ ] Feedback discussed
- [ ] Guides updated
- [ ] Changes reviewed

---

## 4. Monitoring & Alarms

### Implementation Status

**Status**: ⏳ Not Started

### Implementation Analysis

**Date**: [To be filled]

**Construct Patterns Used**:

- _To be documented after implementation_

**Deviations from Guide**:

- _To be documented_

**New Patterns Discovered**:

- _To be documented_

### Guide Updates Needed

**monitoring.md**:

- [ ] Update CloudWatch Logs patterns
- [ ] Add structured logging examples
- [ ] Update metrics patterns
- [ ] Add alarm configuration
- [ ] Update SNS notification setup

**using-constructs.md**:

- [ ] Add monitoring construct usage
- [ ] Document alarm configuration

### Feedback & Improvements

**What Worked Well**:

- _To be documented_

**Suggested Improvements**:

- _To be documented_

### Update Status

- [ ] Analysis complete
- [ ] Feedback discussed
- [ ] Guides updated
- [ ] Changes reviewed

---

## 5. Testing

### Implementation Status

**Status**: ⏳ Not Started

### Implementation Analysis

**Date**: [To be filled]

**Test Coverage**:

- Unit tests: _To be documented_
- Integration tests: _To be documented_
- E2E tests: _To be documented_

**Testing Patterns Used**:

- _To be documented_

### Guide Updates Needed

**testing.md**:

- [ ] Update unit test patterns
- [ ] Add integration test examples
- [ ] Update E2E test patterns
- [ ] Add mocking strategies
- [ ] Update test utilities

### Feedback & Improvements

**What Worked Well**:

- _To be documented_

**Suggested Improvements**:

- _To be documented_

### Update Status

- [ ] Analysis complete
- [ ] Feedback discussed
- [ ] Guides updated
- [ ] Changes reviewed

---

## 6. Deployment

### Implementation Status

**Status**: ⏳ Not Started

### Implementation Analysis

**Date**: [To be filled]

**Deployment Patterns Used**:

- _To be documented_

**Configuration Management**:

- _To be documented_

### Guide Updates Needed

**deployment.md**:

- [ ] Update CDK deployment commands
- [ ] Add environment configuration
- [ ] Update verification steps
- [ ] Add troubleshooting tips

### Feedback & Improvements

**What Worked Well**:

- _To be documented_

**Suggested Improvements**:

- _To be documented_

### Update Status

- [ ] Analysis complete
- [ ] Feedback discussed
- [ ] Guides updated
- [ ] Changes reviewed

---

## Summary

### Overall Progress

- **Resources Implemented**: 0/6
- **Guides Analyzed**: 0/6
- **Guides Updated**: 0/6

### Key Learnings

- _To be documented as we progress_

### Patterns for Template

- _Patterns to copy to microservice template_

---

## Next Steps

1. ✅ Start with DynamoDB implementation
2. ⏳ Analyze and update data-access.md
3. ⏳ Move to Lambda handler
4. ⏳ Continue through remaining resources
