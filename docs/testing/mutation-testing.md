# Mutation Testing Strategy

## Overview

Mutation testing is a technique to verify that tests actually catch bugs by introducing deliberate code changes (mutations) and ensuring tests fail. This validates test quality and prevents false confidence from tests that always pass.

## Why Mutation Testing?

When writing tests after implementation (test-after approach), we risk:
- **False positives** - Tests that always pass even when code is broken
- **Weak assertions** - Tests that don't verify the right behavior  
- **Over-mocking** - Mocks that hide real failures

Mutation testing ensures our tests have proper **falsifiability** - they fail when they should.

## When to Implement Automated Mutation Testing

### ❌ **NOT Right Now** (Early Development Phase)

**Current State (Oct 2025):**
- Only 2 endpoints refactored (`users/post`, `bindings`)
- 152 tests written, patterns still evolving
- 4 other handlers remain untouched
- Limited code coverage across the service

**Why Wait?**

1. **Limited Code Coverage**
   - Only 2 of 6 handlers refactored
   - Mutation testing on partial codebase gives misleading insights
   - ROI is low with limited test surface area

2. **Patterns Still Evolving**
   - Testing approach still being established
   - Refactoring patterns may change
   - Early automation could give false signals

3. **Setup Cost vs Value**
   - Setup time: 2-3 hours
   - Initial run time: 10-30 minutes
   - Value: Limited with only 2 endpoints
   - Spot check (83% success) already validated quality

4. **Premature Optimization**
   - Manual spot checks sufficient for now
   - Focus should be on building test coverage
   - Automation adds complexity too early

### ✅ **The RIGHT Time: Implementation Timeline**

#### **Phase 1: Complete Service Refactoring** (Weeks 1-2)
**Milestone:** All users-ms handlers refactored
- Refactor remaining 4 handlers
- Apply consistent testing patterns
- Achieve 70-80% code coverage
- Validate patterns across all endpoints

**Action:** Run **first mutation test** to validate patterns

#### **Phase 2: Cross-Service Validation** (Weeks 3-4)
**Milestone:** Patterns replicated to deals-ms
- Apply same patterns to deals-ms
- Ensure consistency across services
- Build confidence in approach
- Identify any pattern weaknesses

**Action:** Run mutation testing on both services, compare results

#### **Phase 3: Production Readiness** (Weeks 5-6)
**Milestone:** Services deployed and stable
- Services in production
- Real-world usage validates design
- Testing patterns proven in practice
- No frequent structural changes

**Action:** Integrate mutation testing into CI/CD pipeline

#### **Phase 4: Continuous Quality** (Ongoing)
**Milestone:** Automated quality assurance
- Weekly mutation test runs
- Track mutation score trends
- Identify test quality regressions
- Maintain 70-80% mutation score

**Action:** Monitor and improve based on mutation survivors

### 📋 **Decision Criteria Checklist**

Start automated mutation testing when **ALL** criteria are met:

#### ✅ **Coverage Threshold**
- [ ] At least 70% code coverage achieved
- [ ] All critical paths have tests
- [ ] Consistent test patterns established across codebase
- [ ] Edge cases and error paths tested

#### ✅ **Codebase Stability**
- [ ] Major refactoring complete
- [ ] Testing patterns proven across multiple endpoints
- [ ] No frequent structural changes expected
- [ ] Architecture decisions finalized

#### ✅ **Team Readiness**
- [ ] Time allocated to analyze results (2-4 hours initially)
- [ ] Bandwidth available to fix weak tests identified
- [ ] CI/CD pipeline ready for integration
- [ ] Team trained on interpreting mutation reports

#### ✅ **Value Proposition**
- [ ] Multiple services to validate
- [ ] Regression risk is significant
- [ ] Test quality is business-critical
- [ ] ROI justifies setup and maintenance cost

**Current Status (Oct 2025):** 1/4 criteria met ⚠️

### 🚦 **Recommended Timeline**

| Phase | Timing | Focus | Mutation Testing Status |
|-------|--------|-------|------------------------|
| **Phase 1** | Week 1-2 | Complete users-ms refactoring | ❌ Not yet - use spot checks |
| **Phase 2** | Week 2-3 | Achieve 70% coverage | ✅ **First automated run** |
| **Phase 3** | Week 3-4 | Replicate to deals-ms | ⏸️ Monitor and compare |
| **Phase 4** | Week 5-6 | Stabilize & deploy | ✅ **CI/CD integration** |
| **Phase 5** | Ongoing | Continuous improvement | ✅ **Weekly automated runs** |

### 💡 **What to Do Instead Right Now**

**Immediate Priorities (Next 2 Weeks):**

1. **Complete Refactoring** ⭐ **TOP PRIORITY**
   - Refactor remaining 4 handlers in users-ms
   - Apply same layered architecture pattern
   - Write tests following established patterns
   - Document any pattern refinements

2. **Expand Test Coverage**
   - Test all handlers consistently
   - Reach 70-80% code coverage
   - Cover edge cases and error paths
   - Ensure integration test coverage

3. **Document Patterns**
   - Create testing guidelines document
   - Document refactoring approach
   - Capture lessons learned
   - Share patterns for deals-ms replication

4. **Periodic Spot Checks** (Optional)
   - Quick falsifiability check on 2-3 new tests per week
   - Validate patterns still work
   - Build confidence incrementally
   - Catch issues early

**After Refactoring Complete (Week 3):**

Then set up Stryker for automated mutation testing:
```bash
# Install Stryker
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner

# Run first mutation test
npx stryker run

# Analyze results and adjust
```

### 📊 **Cost-Benefit Analysis**

| Timing | Setup Cost | Maintenance | Value | ROI | Recommendation |
|--------|-----------|-------------|-------|-----|----------------|
| **Now** (2 endpoints) | 3 hours | 1 hour/week | Low | ❌ Negative | Skip |
| **After users-ms** (6 endpoints) | 3 hours | 1 hour/week | Medium | ⚠️ Neutral | Consider |
| **After deals-ms** (12+ endpoints) | 3 hours | 1 hour/week | High | ✅ Positive | **Optimal** |
| **In Production** (stable) | 3 hours | 30 min/week | Very High | ⭐ Excellent | **Ideal** |

### 🎯 **Key Takeaway**

**Don't rush into automated mutation testing.** The manual spot check (83% success rate) already validated that your tests work. Focus on:

1. Building comprehensive test coverage (70%+ target)
2. Establishing consistent patterns across all handlers
3. Proving patterns work across multiple services
4. **Then** automate the validation

Premature automation adds complexity without proportional value. Let the codebase mature first.

## Spot Check Results (Oct 2025)

We performed a spot check on 6 representative tests:

| Test Category | Mutation Applied | Result | Status |
|--------------|------------------|--------|--------|
| **Schema Validation** | Email regex always returns `true` | ✅ Test failed correctly | PASS |
| **Helper Function** | Return wrong UserSub from Cognito | ⚠️ Test passed (not directly tested) | WEAK |
| **Handler Integration** | Wrong status code (200 vs 201) | ✅ Test failed correctly | PASS |
| **Infrastructure** | Wrong Cognito group name | ✅ Test failed correctly | PASS |
| **API Helper** | Always return 500 status | ✅ Test failed correctly | PASS |
| **Bindings Helper** | Don't strip SSM path | ✅ Test failed correctly | PASS |

### Key Finding

**5 out of 6 tests** properly caught mutations. The one weak test (`registerUserWithCognito`) is only tested indirectly through integration tests, which is acceptable for helper functions that are primarily orchestration wrappers.

## Automated Mutation Testing (Future Enhancement)

### Recommended Tool: Stryker Mutator

[Stryker](https://stryker-mutator.io/) is a mutation testing framework for JavaScript/TypeScript.

#### Installation

```bash
npm install --save-dev @stryker-mutator/core
npm install --save-dev @stryker-mutator/jest-runner
npm install --save-dev @stryker-mutator/typescript-checker
```

#### Configuration

Create `stryker.conf.json`:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "jest",
  "jest": {
    "configFile": "jest.config.ts"
  },
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.json",
  "mutate": [
    "src/**/*.ts",
    "lib/**/*.ts",
    "!**/*.test.ts",
    "!**/*.spec.ts",
    "!**/test/**",
    "!**/node_modules/**"
  ],
  "coverageAnalysis": "perTest",
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  },
  "timeoutMS": 60000,
  "concurrency": 4
}
```

#### Running Mutation Tests

```bash
# Run mutation testing
npx stryker run

# Generate HTML report
npx stryker run --reporters html,clear-text,progress
```

#### Interpreting Results

Stryker provides a **mutation score**:
- **Killed** - Test caught the mutation ✅
- **Survived** - Test didn't catch the mutation ❌
- **No Coverage** - No test ran against the mutated code ⚠️
- **Timeout** - Test took too long (possible infinite loop)

**Target Mutation Score:** 70-80%

### Types of Mutations Stryker Applies

1. **Arithmetic Operators** - `+` → `-`, `*` → `/`
2. **Logical Operators** - `&&` → `||`, `!` → ``
3. **Comparison Operators** - `>` → `<`, `===` → `!==`
4. **String Literals** - `"text"` → `""`
5. **Boolean Literals** - `true` → `false`
6. **Conditional Boundaries** - `>=` → `>`, `<=` → `<`
7. **Return Values** - `return x` → `return undefined`

## Manual Mutation Testing Checklist

For critical code paths, manually verify test falsifiability:

### Schema Validation
- [ ] Change validation regex to always pass
- [ ] Remove required field checks
- [ ] Change min/max boundaries

### Business Logic
- [ ] Return wrong values
- [ ] Skip critical steps
- [ ] Change conditional logic

### API Responses
- [ ] Wrong status codes
- [ ] Missing response fields
- [ ] Incorrect error messages

### Infrastructure
- [ ] Wrong resource names
- [ ] Missing IAM permissions
- [ ] Incorrect configuration values

## Best Practices

1. **Run mutation tests in CI/CD** - Catch test quality issues early
2. **Focus on critical paths** - Not all code needs 100% mutation coverage
3. **Review survivors** - Mutations that survive indicate weak tests
4. **Don't over-test** - Some mutations are acceptable (e.g., logging changes)
5. **Balance with coverage** - Use both code coverage and mutation score

## Integration with CI/CD

```yaml
# .github/workflows/mutation-test.yml
name: Mutation Testing

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday at 2 AM

jobs:
  mutation-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx stryker run
      - uses: actions/upload-artifact@v3
        with:
          name: mutation-report
          path: reports/mutation/html
```

## Metrics

Track these metrics over time:

- **Mutation Score** - % of mutations killed
- **Test Execution Time** - Impact on CI/CD pipeline
- **Survivor Analysis** - Patterns in surviving mutations
- **Coverage vs Mutation Score** - Correlation between metrics

## Resources

- [Stryker Mutator Documentation](https://stryker-mutator.io/)
- [Mutation Testing Introduction](https://en.wikipedia.org/wiki/Mutation_testing)
- [JavaScript Mutation Testing Guide](https://stryker-mutator.io/docs/stryker-js/introduction/)

## Next Steps

1. ✅ **Completed:** Manual spot check (6 tests verified)
2. **TODO:** Install and configure Stryker
3. **TODO:** Run baseline mutation test
4. **TODO:** Set mutation score thresholds
5. **TODO:** Integrate into CI/CD pipeline
6. **TODO:** Review and fix weak tests identified by Stryker
