# Contract Testing Guide: Payload Schema (Zod)

This guide explains how we test request/response payload contracts using Zod. Contract tests ensure that payloads are validated consistently and coercions behave as expected.

## Scope

- Zod schemas under `lib/api/endpoints/**/payload.schema.ts`.
- For `deals-ms` POST /deals, see `lib/api/endpoints/deals/post/payload.schema.ts`.

## Where tests live

- Mirror structure under `test/`.
- Example: `test/lib/api/endpoints/deals/post/payload.schema.test.ts`

## What to cover

- **Happy path**
  - Valid payload passes `.safeParse()`.
  - Numeric coercions are applied (e.g., `originalPrice: "100"` → number).
- **Invalid ISO date-time**
  - Non-ISO strings are rejected with the custom message set in `refine()`.
- **Missing required fields**
  - Verify `success=false` when required fields (e.g., `userId`) are absent.
- **Enum checks**
  - Category not in `categoryEnum` should fail.

## Example in this repo

- Test: `test/lib/api/endpoints/deals/post/payload.schema.test.ts`
- Schema: `lib/api/endpoints/deals/post/payload.schema.ts`

## Running tests

- `npm test`

## Tips

- Prefer `.safeParse()` in tests and assert on `success` to avoid exceptions.
- Use `flatten()` to assert specific validation messages when necessary.

## CI (Quick Note)

- Run on every PR together with unit helpers and handler tests.
- No external dependencies; fast and reliable.
- See `guides/development/cicd-guide-v2.md` for the canonical CI flow.
