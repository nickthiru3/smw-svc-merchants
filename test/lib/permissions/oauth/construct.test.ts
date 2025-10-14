import { AuthorizationType } from "aws-cdk-lib/aws-apigateway";
import OAuthConstruct from "#lib/permissions/oauth/construct";
import {
  createMockResourceServer,
  createTestStack,
} from "#test/support/lib/permissions-test-helpers";

describe("lib/permissions/oauth/construct", () => {
  let stack: ReturnType<typeof createTestStack>;
  let resourceServer: ReturnType<typeof createMockResourceServer>;

  beforeEach(() => {
    stack = createTestStack();
    resourceServer = createMockResourceServer([
      "users/read",
      "users/write",
      "users/delete",
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("stores provided resource server reference", () => {
    const construct = new OAuthConstruct(stack, "OAuth", {
      resourceServer: resourceServer as any,
    });

    expect(construct.resourceServer).toBe(resourceServer);
  });

  test("returns filtered auth options for provided authorizer", () => {
    const construct = new OAuthConstruct(stack, "OAuthAuthOptions", {
      resourceServer: resourceServer as any,
    });

    const options = construct.getAuthOptions("auth-id-123");

    expect(options).toEqual({
      readUsersAuth: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: { authorizerId: "auth-id-123" },
        authorizationScopes: ["users/read"],
      },
      writeUsersAuth: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: { authorizerId: "auth-id-123" },
        authorizationScopes: ["users/write"],
      },
      deleteUsersAuth: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: { authorizerId: "auth-id-123" },
        authorizationScopes: ["users/delete"],
      },
    });
  });
});
