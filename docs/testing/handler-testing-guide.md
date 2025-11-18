# Handler Testing Guide: Lambda Behavior Tests

This guide explains how we test Lambda handlers’ behavior (validation, branching, AWS I/O) while keeping tests fast and deterministic by mocking AWS SDK v3 and other side effects.

## Scope

- Handlers under `lib/api/endpoints/**/handler.ts`
- For `deals-ms`, see `lib/api/endpoints/deals/post/handler.ts`

## Where tests live

- Mirror the code structure under `test/`.
- Example: `test/lib/api/endpoints/deals/post/handler.test.ts`

## What to cover

- **Happy path**
  - Valid body → normalized → validated → item saved to DynamoDB → returns 200 with `dealId`.
- **Validation errors**
  - Invalid/missing JSON body → 400
  - Schema invalid (e.g., empty title) → 400
- **Env errors**
  - Missing required `TABLE_NAME` → 500
- **DynamoDB errors**
  - Conditional check failed (exists) → 409
  - Generic error → 502 with minimal serialized details

## Mocking strategy (AWS SDK v3 + KSUID)

- Mock modules before importing the handler so module-level clients are intercepted.
- Example snippet (see full test):

```ts
// In handler.test.ts
const sendMock = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  __esModule: true,
  DynamoDBClient: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutItemCommand: class PutItemCommand { constructor(public readonly _input: any) {} },
}));

jest.mock("ksuid", () => ({
  __esModule: true,
  default: { randomSync: () => ({ string: "TEST_DEAL_ID_123" }) },
}));

import { handler } from "#lib/api/endpoints/deals/post/handler";
```

## Test references in this repo

- `test/lib/api/endpoints/deals/post/handler.test.ts`
- Implementation under test:
  - `lib/api/endpoints/deals/post/handler.ts`
  - `lib/api/endpoints/deals/post/helpers.ts`

## Running tests

- `npm test`

## Tips

- Keep AWS SDK mocks hoisted above the handler import.
- Make IDs deterministic by mocking `KSUID.randomSync()`.
- Prefer asserting on response shape (`statusCode`, `body.message`) over internal implementation details.

## CI (Quick Note)

- Run on every PR together with unit helpers and CDK template tests.
- Tests are fast and do not require external AWS resources (SDK is mocked).
- See `guides/development/cicd-guide-v2.md` for the canonical CI pipeline setup.
