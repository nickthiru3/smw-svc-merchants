import { ResourceServerScope } from "aws-cdk-lib/aws-cognito";
import ResourceServerConstruct from "#lib/permissions/resource-server/construct";
import {
  createMockUserPoolIds,
  createTestStack,
} from "#test/support/lib/permissions-test-helpers";

const config = {
  service: {
    name: "users",
    displayName: "Users",
  },
} as any;

describe("lib/permissions/resource-server/construct", () => {
  let stack: ReturnType<typeof createTestStack>;
  let auth: { userPool: { pool: ReturnType<typeof createMockUserPoolIds> } };

  beforeEach(() => {
    stack = createTestStack();
    auth = {
      userPool: {
        pool: createMockUserPoolIds(),
      },
    };
  });

  test("creates scopes for CRUD operations", () => {
    const construct = new ResourceServerConstruct(stack, "ResourceServer", {
      auth: auth as any,
      config,
    });

    const scopeNames = construct.scopes.map(
      (scope: ResourceServerScope) => scope.scopeName
    );

    expect(scopeNames).toEqual(["read", "write", "delete"]);
  });

  test("builds slash-separated scopes using identifier", () => {
    const construct = new ResourceServerConstruct(
      stack,
      "ResourceServerScopes",
      {
        auth: auth as any,
        config,
      }
    );

    construct.identifier = "users";

    expect(construct.getOAuthScopes()).toEqual([
      "users/read",
      "users/write",
      "users/delete",
    ]);
  });
});
