# Test Coverage Guide

A comprehensive guide to understanding, measuring, and improving test coverage in the microservices architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [What is Test Coverage?](#what-is-test-coverage)
3. [Coverage Metrics Explained](#coverage-metrics-explained)
4. [Coverage Configuration](#coverage-configuration)
5. [Generating Coverage Reports](#generating-coverage-reports)
6. [Reading Coverage Reports](#reading-coverage-reports)
7. [Coverage Thresholds](#coverage-thresholds)
8. [Best Practices](#best-practices)
9. [Common Pitfalls](#common-pitfalls)
10. [CI/CD Integration](#cicd-integration)
11. [Improving Coverage](#improving-coverage)

---

## Overview

Test coverage measures how much of your code is executed when tests run. It's a useful metric for identifying untested code, but **high coverage doesn't guarantee quality tests** - it only shows that code was executed during testing.

### Key Principle

> **Coverage is necessary but not sufficient for quality.**
>
> - ✅ 80% coverage with good tests > 100% coverage with weak tests
> - ✅ Focus on testing behavior, not just achieving coverage numbers
> - ✅ Use coverage to find gaps, not as the only quality metric

---

## What is Test Coverage?

Test coverage answers the question: **"What percentage of my code is executed when tests run?"**

### What Coverage Measures

| ✅ Measures | ❌ Doesn't Measure |
|-------------|-------------------|
| Lines executed | Test quality |
| Branches taken | Edge cases tested |
| Functions called | Assertions made |
| Statements run | Business logic correctness |

### Example

```typescript
// Function with 4 lines, 2 branches
function divide(a: number, b: number): number {
  if (b === 0) {                    // Line 1, Branch 1
    throw new Error("Division by zero"); // Line 2
  }
  return a / b;                     // Line 3, Branch 2
}

// Test 1: Only covers happy path
test("divides numbers", () => {
  expect(divide(10, 2)).toBe(5);
  // Coverage: 75% lines (3/4), 50% branches (1/2)
});

// Test 2: Covers error path
test("throws on division by zero", () => {
  expect(() => divide(10, 0)).toThrow("Division by zero");
  // Coverage: 100% lines (4/4), 100% branches (2/2)
});
```

---

## Coverage Metrics Explained

### 1. **Statement Coverage**

**Definition:** Percentage of statements executed

**Example:**
```typescript
function example(x: number) {
  const a = x + 1;        // Statement 1
  const b = a * 2;        // Statement 2
  return b;               // Statement 3
}

test("example", () => {
  example(5);
  // Statement coverage: 100% (3/3 statements executed)
});
```

### 2. **Branch Coverage**

**Definition:** Percentage of decision branches taken

**Example:**
```typescript
function isEligible(age: number, hasLicense: boolean): boolean {
  if (age >= 18) {              // Branch 1: true/false
    if (hasLicense) {           // Branch 2: true/false
      return true;
    }
    return false;
  }
  return false;
}

// Test 1: Only one path
test("eligible adult with license", () => {
  expect(isEligible(20, true)).toBe(true);
  // Branch coverage: 50% (2/4 branches: age>=18 true, hasLicense true)
});

// Complete coverage requires 4 tests:
// 1. age >= 18, hasLicense = true
// 2. age >= 18, hasLicense = false
// 3. age < 18, hasLicense = true
// 4. age < 18, hasLicense = false
```

**Why Branch Coverage Matters:**
- Most important metric for quality
- Ensures all code paths are tested
- Catches edge cases and error handling

### Coverage Follow-Up

- **users-ms:** Latest suite run (Oct 4 2025) passes with global coverage of **statements 95.1% / branches 84.8% / functions 84.7% / lines 95.1%** and clean console output captured via `npm test -- --testPathIgnorePatterns=test/e2e 2>&1 | tee test/logs/test-run.log`.
- **deals-ms:** Latest suite run (Oct 4 2025) passes with global coverage of **statements 96.2% / branches 79.2% / functions 89.7% / lines 96.3%**.

### Direct CDK Unit Tests

- **Why:** Coverage tables highlighted low percentages for `lib/permissions/oauth/construct.ts` and `lib/permissions/resource-server/construct.ts`. Stack snapshot tests instantiate these constructs but never call helper methods, leaving branch/function coverage at 0%.
- **What we added:** Focused unit suites under `test/lib/permissions/` for both `users-ms` and `deals-ms` that:
  - Create minimal CDK stacks via `createTestStack()`.
  - Mock dependent constructs (`createMockResourceServer`, `createMockUserPoolIds`) to avoid real AWS objects.
  - Assert scope arrays and authorization options returned by helper methods.@[/home/nickt/projects/super-deals/users-ms/test/lib/permissions/oauth/construct.test.ts:L1-L58]@[/home/nickt/projects/super-deals/users-ms/test/lib/permissions/resource-server/construct.test.ts:L1-L51]@[/home/nickt/projects/super-deals/deals-ms/test/lib/permissions/oauth/construct.test.ts:L1-L45]@[/home/nickt/projects/super-deals/deals-ms/test/lib/permissions/resource-server/construct.test.ts:L1-L49]
- **Shared helpers:** Reusable utilities live in `test/support/cdk/permissions-test-helpers.ts` in each repo to standardize stack creation and Cognito mocks, keeping the tests concise.@[/home/nickt/projects/super-deals/users-ms/test/support/cdk/permissions-test-helpers.ts:L1-L17]@[/home/nickt/projects/super-deals/deals-ms/test/support/cdk/permissions-test-helpers.ts:L1-L17]

### 3. **Function Coverage**

**Definition:** Percentage of functions called

**Example:**
```typescript
function add(a: number, b: number) { return a + b; }
function subtract(a: number, b: number) { return a - b; }
function multiply(a: number, b: number) { return a * b; }

test("math operations", () => {
  add(1, 2);
  subtract(5, 3);
  // Function coverage: 66% (2/3 functions called)
  // multiply() never called
});
```

### 4. **Line Coverage**

**Definition:** Percentage of executable lines run

**Example:**
```typescript
function process(data: string) {
  const trimmed = data.trim();     // Line 1
  const upper = trimmed.toUpperCase(); // Line 2
  const result = upper.split('');  // Line 3
  return result;                   // Line 4
}

test("process", () => {
  process("hello");
  // Line coverage: 100% (4/4 lines executed)
});
```

---

## Coverage Configuration

### Jest Configuration

Both `users-ms` and `deals-ms` use Jest for testing with coverage enabled.

#### `jest.config.ts`

```typescript
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  
  // Coverage configuration
  collectCoverage: true,                    // Enable coverage collection
  coverageDirectory: "<rootDir>/test/coverage", // Output directory
  
  // Coverage thresholds (fail if not met)
  coverageThreshold: {
    global: {
      branches: 70,      // 70% of branches must be covered
      functions: 75,     // 75% of functions must be covered
      lines: 75,         // 75% of lines must be covered
      statements: 75,    // 75% of statements must be covered
    },
  },
  
  // What to include/exclude
  collectCoverageFrom: [
    "lib/**/*.ts",       // Include all lib files
    "src/**/*.ts",       // Include all src files
    "!**/*.d.ts",        // Exclude type definitions
    "!**/node_modules/**", // Exclude dependencies
    "!**/test/**",       // Exclude test files
  ],
};
```

### Coverage Output Location

**Configured location:** `<rootDir>/test/coverage`

**Why in `test/` directory?**
- Keeps all test-related artifacts together
- Mirrors test structure
- Easy to find and clean up

**Directory structure:**
```
test/
├── coverage/              # Coverage reports (gitignored)
│   ├── lcov-report/      # HTML report
│   │   └── index.html    # Open this in browser
│   ├── lcov.info         # LCOV format
│   ├── clover.xml        # Clover XML format
│   └── coverage-final.json # Raw JSON data
├── lib/                  # Infrastructure tests
├── src/                  # Helper tests
└── e2e/                  # E2E tests
```

---

## Generating Coverage Reports

### Command Line

```bash
# Generate coverage (already enabled in jest.config.ts)
npm test

# Generate coverage with specific test file
npm test -- path/to/test.test.ts

# Generate coverage without running tests (dry run)
npm test -- --collectCoverageFrom="lib/**/*.ts" --coverage --testPathPattern="nonexistent"
```

### What Gets Generated

1. **HTML Report** (`test/coverage/lcov-report/index.html`)
   - Interactive, browsable report
   - Shows covered/uncovered lines
   - Drill down into files

2. **LCOV Format** (`test/coverage/lcov.info`)
   - Used by CI/CD tools
   - IDE integration (VS Code, IntelliJ)
   - Coverage badges

3. **Clover XML** (`test/coverage/clover.xml`)
   - Used by some CI/CD tools
   - Jenkins, Bamboo integration

4. **JSON Format** (`test/coverage/coverage-final.json`)
   - Raw coverage data
   - Programmatic analysis
   - Custom reporting

---

## Reading Coverage Reports

### HTML Report (Recommended)

**Open in browser:**
```bash
# macOS
open test/coverage/lcov-report/index.html

# Linux
xdg-open test/coverage/lcov-report/index.html

# Windows
start test/coverage/lcov-report/index.html
```

**Report Structure:**

1. **Summary Page**
   - Overall coverage percentages
   - List of all files
   - Color-coded indicators:
     - 🟢 Green: Good coverage (>80%)
     - 🟡 Yellow: Medium coverage (50-80%)
     - 🔴 Red: Low coverage (<50%)

2. **File View**
   - Click any file to see line-by-line coverage
   - Green highlight: Line covered
   - Red highlight: Line not covered
   - Yellow highlight: Branch partially covered

3. **Branch Indicators**
   - `E` (Else): Else branch
   - `I` (If): If branch
   - Numbers show how many times executed

### Terminal Output

When you run `npm test`, you'll see:

```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------|---------|----------|---------|---------|-------------------
All files             |   79.29 |    58.95 |   82.35 |   79.29 |                   
 lib/api/endpoints    |   85.71 |       75 |     100 |   85.71 |                   
  handler.ts          |   85.71 |       75 |     100 |   85.71 | 45-47             
 src/helpers          |   76.47 |    54.54 |      80 |   76.47 |                   
  api.ts              |     100 |      100 |     100 |     100 |                   
  config.ts           |     100 |      100 |     100 |     100 |                   
  email.ts            |   66.66 |       50 |      75 |   66.66 | 23,45-52          
  ssm.ts              |   71.42 |    44.44 |   77.77 |   71.42 | 67-89,102-115     
----------------------|---------|----------|---------|---------|-------------------
```

**Reading the table:**
- **% Stmts**: Statement coverage
- **% Branch**: Branch coverage (most important!)
- **% Funcs**: Function coverage
- **% Lines**: Line coverage
- **Uncovered Line #s**: Which lines aren't covered

---

## Coverage Thresholds

### Current Thresholds

Both services use these thresholds:

```typescript
coverageThreshold: {
  global: {
    branches: 70,      // Minimum 70% branch coverage
    functions: 75,     // Minimum 75% function coverage
    lines: 75,         // Minimum 75% line coverage
    statements: 75,    // Minimum 75% statement coverage
  },
}
```

### What Happens When Thresholds Aren't Met?

**Tests fail with error:**
```
Jest: "global" coverage threshold for branches (70%) not met: 58.95%
Jest: "global" coverage threshold for lines (75%) not met: 71.42%
```

**In CI/CD:**
- Build fails
- PR cannot be merged
- Forces developers to add tests

### Why These Numbers?

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| **Branches** | 70% | Most important - ensures error paths tested |
| **Functions** | 75% | Most functions should be tested |
| **Lines** | 75% | Good balance of coverage vs effort |
| **Statements** | 75% | Matches line coverage |

### Per-File Thresholds (Optional)

You can set thresholds for specific files:

```typescript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 75,
    lines: 75,
    statements: 75,
  },
  // Stricter thresholds for critical code
  "./lib/api/endpoints/**/handler.ts": {
    branches: 90,
    functions: 100,
    lines: 90,
    statements: 90,
  },
  // More lenient for infrastructure code
  "./lib/**/construct.ts": {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
}
```

---

## Best Practices

### 1. **Focus on Branch Coverage**

Branch coverage is the most important metric - it ensures all code paths are tested.

```typescript
// ❌ Bad: Only tests happy path
test("processes data", () => {
  const result = processData({ valid: true });
  expect(result).toBeDefined();
  // Branch coverage: 50% (only valid=true path)
});

// ✅ Good: Tests both paths
test("processes valid data", () => {
  const result = processData({ valid: true });
  expect(result).toBeDefined();
});

test("handles invalid data", () => {
  expect(() => processData({ valid: false })).toThrow();
  // Branch coverage: 100% (both paths tested)
});
```

### 2. **Test Error Paths**

Don't just test the happy path - test error handling too.

```typescript
// ✅ Good: Tests error handling
describe("getUserById", () => {
  test("returns user when found", async () => {
    const user = await getUserById("123");
    expect(user).toEqual({ id: "123", name: "John" });
  });
  
  test("throws when user not found", async () => {
    await expect(getUserById("999")).rejects.toThrow("User not found");
  });
  
  test("handles database errors", async () => {
    mockDb.get.mockRejectedValue(new Error("DB error"));
    await expect(getUserById("123")).rejects.toThrow("DB error");
  });
});
```

### 3. **Don't Chase 100% Coverage**

**Diminishing returns:**
- 70-80% coverage: Good balance
- 80-90% coverage: Very good
- 90-100% coverage: Often not worth the effort

**Some code doesn't need tests:**
- Type definitions
- Simple getters/setters
- Configuration files
- Generated code

### 4. **Use Coverage to Find Gaps**

Coverage reports show what's NOT tested:

```typescript
// Coverage report shows line 45 not covered
function processOrder(order: Order) {
  if (order.status === "pending") {
    return processPending(order);
  }
  if (order.status === "completed") {
    return processCompleted(order);
  }
  throw new Error("Invalid status"); // Line 45 - not covered!
}

// Add test for uncovered line
test("throws on invalid status", () => {
  expect(() => processOrder({ status: "invalid" })).toThrow("Invalid status");
});
```

### 5. **Exclude Generated/Infrastructure Code**

```typescript
collectCoverageFrom: [
  "lib/**/*.ts",
  "src/**/*.ts",
  "!**/*.d.ts",              // Exclude type definitions
  "!**/node_modules/**",     // Exclude dependencies
  "!**/test/**",             // Exclude test files
  "!**/cdk.out/**",          // Exclude CDK output
  "!**/*.config.ts",         // Exclude config files
  "!**/bin/**",              // Exclude CDK app entry point
],
```

### 6. **Review Coverage in PRs**

Make coverage part of code review:

```markdown
## PR Checklist
- [ ] Tests added for new features
- [ ] Coverage thresholds met
- [ ] No decrease in overall coverage
- [ ] Critical paths have >90% branch coverage
```

---

## Common Pitfalls

### ❌ Pitfall 1: Chasing Coverage Numbers

**Problem:**
```typescript
// ❌ Bad: Test just for coverage, no assertions
test("calls function", () => {
  myFunction(); // No assertions!
  // Coverage: 100%, but test is useless
});
```

**Solution:**
```typescript
// ✅ Good: Test behavior with assertions
test("returns correct result", () => {
  const result = myFunction();
  expect(result).toBe(expectedValue);
  expect(result).toHaveProperty("id");
});
```

### ❌ Pitfall 2: Ignoring Branch Coverage

**Problem:**
```typescript
// Only tests one branch
test("processes data", () => {
  process({ valid: true });
  // Branch coverage: 50%
});
```

**Solution:**
```typescript
// Tests all branches
test("processes valid data", () => {
  process({ valid: true });
});

test("rejects invalid data", () => {
  expect(() => process({ valid: false })).toThrow();
  // Branch coverage: 100%
});
```

### ❌ Pitfall 3: Testing Implementation, Not Behavior

**Problem:**
```typescript
// ❌ Bad: Tests internal implementation
test("calls helper function", () => {
  const spy = jest.spyOn(helpers, "internalHelper");
  myFunction();
  expect(spy).toHaveBeenCalled();
  // Brittle - breaks if implementation changes
});
```

**Solution:**
```typescript
// ✅ Good: Tests behavior/output
test("returns correct result", () => {
  const result = myFunction();
  expect(result).toEqual(expectedOutput);
  // Resilient to implementation changes
});
```

### ❌ Pitfall 4: Not Testing Edge Cases

**Problem:**
```typescript
// Only tests typical cases
test("divides numbers", () => {
  expect(divide(10, 2)).toBe(5);
  // Misses: division by zero, negative numbers, decimals
});
```

**Solution:**
```typescript
// Tests edge cases
describe("divide", () => {
  test("divides positive numbers", () => {
    expect(divide(10, 2)).toBe(5);
  });
  
  test("handles division by zero", () => {
    expect(() => divide(10, 0)).toThrow();
  });
  
  test("handles negative numbers", () => {
    expect(divide(-10, 2)).toBe(-5);
  });
  
  test("handles decimals", () => {
    expect(divide(10, 3)).toBeCloseTo(3.33, 2);
  });
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test & Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm test
        # Fails if coverage thresholds not met
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./test/coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
      
      - name: Comment PR with coverage
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./test/coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Coverage Badges

Add to `README.md`:

```markdown
[![Coverage](https://codecov.io/gh/username/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/username/repo)
```

### Preventing Coverage Regression

```yaml
# Fail if coverage decreases
- name: Check coverage
  run: |
    CURRENT=$(cat test/coverage/coverage-summary.json | jq '.total.lines.pct')
    THRESHOLD=75
    if (( $(echo "$CURRENT < $THRESHOLD" | bc -l) )); then
      echo "Coverage $CURRENT% is below threshold $THRESHOLD%"
      exit 1
    fi
```

---

## Improving Coverage

### Step 1: Identify Gaps

```bash
# Generate coverage report
npm test

# Open HTML report
open test/coverage/lcov-report/index.html

# Look for red (uncovered) lines
```

### Step 2: Prioritize

**Focus on:**
1. ✅ Critical business logic
2. ✅ Error handling paths
3. ✅ Edge cases
4. ✅ Complex conditionals

**Don't worry about:**
1. ❌ Simple getters/setters
2. ❌ Type definitions
3. ❌ Configuration files
4. ❌ Trivial code

### Step 3: Add Tests

```typescript
// Coverage shows this line not covered:
if (user.role === "admin") {
  return adminDashboard();
}

// Add test:
test("shows admin dashboard for admin users", () => {
  const user = { role: "admin" };
  const result = getDashboard(user);
  expect(result).toBe(adminDashboard());
});
```

### Step 4: Verify

```bash
# Run tests again
npm test

# Check coverage improved
# Look for green lines in HTML report
```

---

## Coverage vs Quality

### Coverage is NOT Quality

**High coverage doesn't mean:**
- ✅ Tests are good
- ✅ Edge cases are tested
- ✅ Code is correct
- ✅ No bugs exist

**Example of bad test with 100% coverage:**
```typescript
function add(a: number, b: number) {
  return a + b;
}

// ❌ Bad: 100% coverage, but no assertions!
test("add", () => {
  add(1, 2); // No expect()!
});
```

### Quality Metrics Beyond Coverage

1. **Mutation Testing** - Do tests catch bugs? (See `mutation-testing.md`)
2. **Assertion Density** - How many assertions per test?
3. **Test Clarity** - Are tests easy to understand?
4. **Test Speed** - Do tests run fast?
5. **Test Isolation** - Are tests independent?

### The Right Balance

```
Quality Tests = Coverage + Assertions + Edge Cases + Mutation Testing
```

**Example of quality test:**
```typescript
describe("calculateDiscount", () => {
  // ✅ Tests behavior
  test("applies 10% discount for regular customers", () => {
    const result = calculateDiscount(100, "regular");
    expect(result).toBe(90);
  });
  
  // ✅ Tests edge case
  test("applies 20% discount for VIP customers", () => {
    const result = calculateDiscount(100, "vip");
    expect(result).toBe(80);
  });
  
  // ✅ Tests error handling
  test("throws on invalid customer type", () => {
    expect(() => calculateDiscount(100, "invalid")).toThrow();
  });
  
  // ✅ Tests boundary
  test("handles zero amount", () => {
    const result = calculateDiscount(0, "regular");
    expect(result).toBe(0);
  });
});
```

---

## Summary

### Key Takeaways

1. **Coverage shows what's executed, not what's tested well**
2. **Branch coverage is the most important metric**
3. **70-80% coverage is a good target**
4. **Use coverage to find gaps, not as the only quality measure**
5. **Combine coverage with mutation testing for true quality**

### Quick Reference

| Task | Command |
|------|---------|
| Run tests with coverage | `npm test` |
| View HTML report | `open test/coverage/lcov-report/index.html` |
| Check coverage thresholds | Automatic (fails if not met) |
| Exclude files from coverage | Update `collectCoverageFrom` in `jest.config.ts` |
| Change thresholds | Update `coverageThreshold` in `jest.config.ts` |

### Next Steps

1. ✅ Run `npm test` to generate coverage
2. ✅ Open HTML report to identify gaps
3. ✅ Add tests for uncovered critical paths
4. ✅ Set up coverage reporting in CI/CD
5. ✅ Review coverage in PRs
6. ✅ Combine with mutation testing for quality assurance

---

**Related Documentation:**
- [Mutation Testing Guide](./mutation-testing.md)
- [Testing Strategy](./testing-strategy.md)
- [Unit Testing Guide](./unit-helpers-testing-guide.md)
- [Handler Testing Guide](./handler-testing-guide.md)

**Last Updated:** October 2025  
**Maintainer:** Development Team
