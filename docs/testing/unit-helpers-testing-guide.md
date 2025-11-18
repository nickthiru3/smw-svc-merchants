# Unit Testing Guide: Lambda Helpers

This guide explains how we unit test pure helper functions used by Lambda handlers. These tests are fast, isolated, and avoid external I/O.

## Scope

- Functions under `lib/api/endpoints/**/helpers.ts` that are pure (no network or AWS calls), e.g.:
  - `parseAndValidateBody()`
  - `normalizeData()`
  - `validateData()`
  - `buildDealItem()`
  - `getRequiredEnv()`

## Where tests live

- Mirror structure under `test/`.
- Example (deals POST helpers): `test/lib/api/endpoints/deals/post/helpers.test.ts`

## What to assert

- **`parseAndValidateBody()`**
  - Valid payload returns `ok=true` and parsed data.
  - Missing body returns 400 with error response.
  - Invalid JSON returns 400.
  - Schema invalid (e.g. empty title) returns 400 with details.

- **`normalizeData()`**
  - Trims leading/trailing whitespace on `title` and `logoFileKey`.

- **`validateData()`**
  - Throws if `expiration` < 7 days from today.
  - Does not throw when valid.

- **`buildDealItem()`**
  - Correctly sets keys/attributes, coerces numbers, and sets `CreatedAt`.

- **`getRequiredEnv()`**
  - Returns `ok=true` with `tableName` when `TABLE_NAME` is set.
  - Returns 500 error response when missing.

## Examples in this repo

- Tests: `test/lib/api/endpoints/deals/post/helpers.test.ts`
- Code under test: `lib/api/endpoints/deals/post/helpers.ts`

## Running tests

- `npm test`

## Service-level helpers (src/helpers)

In addition to endpoint-local helpers, we also cover shared service helpers under `src/helpers/`.

- Code under test:
  - `src/helpers/api.ts` (API response helpers)
  - `src/helpers/config.ts` (CDK env/tags/description helpers)
  - `src/helpers/ssm.ts` (SSM path publishing/reading helpers)

- Tests (mirrored under `test/`):
  - `test/src/helpers/api.test.ts`
  - `test/src/helpers/config.test.ts`
  - `test/src/helpers/ssm.test.ts`

Notes:
- These tests are pure unit tests. For `ssm.ts`, CDK SSM is module-mocked so no AWS access is required.

## Tips

- Keep helpers pure where possible—makes tests trivial and reliable.
- If a helper needs AWS I/O, prefer pushing that logic behind a thin wrapper that you can mock in the handler behavior tests instead.

## CI (Quick Note)

- Run on every PR along with handler and CDK template tests.
- Keep fast and deterministic (no external services).
- See `guides/development/cicd-guide-v2.md` for the canonical CI workflow. LocalStack/E2E remain out of PR scope unless explicitly enabled.
