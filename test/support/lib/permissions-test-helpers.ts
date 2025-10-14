import * as cdk from "aws-cdk-lib";

export function createTestStack(id = "TestStack"): cdk.Stack {
  const app = new cdk.App();
  return new cdk.Stack(app, id);
}

export function createMockResourceServer(scopes: string[]) {
  return {
    getOAuthScopes: jest.fn(() => scopes),
  };
}

export function createMockUserPoolIds(overrides?: Partial<{ userPoolArn: string; userPoolId: string }>) {
  return {
    userPoolArn: "arn:aws:cognito-idp:us-east-1:123456789012:userpool/test",
    userPoolId: "us-east-1_testPool",
    ...overrides,
  };
}
