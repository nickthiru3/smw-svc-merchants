import {
  buildSsmPublicPath,
  buildSsmPrivatePath,
  readParam,
  publishStringParameters,
  publishSecureStringParameters,
  readBindings,
  readSecureParam,
  readSecureBindings,
} from "#src/helpers/ssm";

// Mock aws-cdk-lib SecretValue and aws-ssm helpers so we don't require real CDK constructs
jest.mock("aws-cdk-lib", () => ({
  SecretValue: {
    ssmSecure: jest.fn((name: string) => ({
      unsafeUnwrap: () => `SECURE_VALUE_FOR:${name}`,
    })),
  },
}));

jest.mock("aws-cdk-lib/aws-ssm", () => {
  const instances: any[] = [];

  const StringParameter = jest.fn().mockImplementation(
    (_scope: unknown, _id: string, props: Record<string, unknown>) => {
      const cfnParameter = {
        keyId: undefined as string | undefined,
        addPropertyOverride: jest.fn((prop: string, value: any) => {
          if (prop === "KeyId") {
            cfnParameter.keyId = value;
          }
        }),
      };
      const instance = {
        scope: _scope,
        id: _id,
        props,
        node: { defaultChild: cfnParameter },
      };
      instances.push(instance);
      return instance;
    }
  );

  Object.assign(StringParameter, {
    instances,
    fromStringParameterName: jest.fn(
      (_scope: unknown, _id: string, name: string) => ({
        stringValue: `VALUE_FOR:${name}`,
      })
    ),
  });

  return {
    __esModule: true,
    ParameterTier: { STANDARD: "STANDARD" },
    ParameterType: { SECURE_STRING: "SECURE_STRING" },
    StringParameter,
  };
});

describe("src/helpers/ssm", () => {
  // Minimal fake scope; not used thanks to the mock
  const scope: any = {};
  const { StringParameter } = jest.requireMock("aws-cdk-lib/aws-ssm") as {
    StringParameter: jest.Mock & {
      instances: Array<{
        scope: unknown;
        id: string;
        props: Record<string, unknown>;
        node: { defaultChild: { keyId?: string } };
      }>;
    };
  };

  beforeEach(() => {
    StringParameter.mockClear();
    StringParameter.instances.length = 0;
  });

  test("buildSsm*Path constructs normalized paths", () => {
    // Default app base path comes from config, but the function adds service/env and visibility
    const pub = buildSsmPublicPath("dev", "users-ms");
    const priv = buildSsmPrivatePath("dev", "users-ms");

    expect(pub).toContain("/dev/users-ms/public");
    expect(priv).toContain("/dev/users-ms/private");
  });

  test("readParam returns mocked stringValue for given name", () => {
    const val = readParam(scope, "/super-deals/dev/users-ms/public/ApiUrl");
    expect(val).toBe("VALUE_FOR:/super-deals/dev/users-ms/public/ApiUrl");
  });

  test("readBindings maps params to hierarchical suffixes under base path", () => {
    const base = "/super-deals/dev/users-ms/private";
    const out = readBindings(scope, base, {
      usersTableName: "Db/TableName",
      auditLogEventBusArn: "Events/Buses/AuditLog/Arn",
    });
    expect(out).toEqual({
      usersTableName: "VALUE_FOR:/super-deals/dev/users-ms/private/Db/TableName",
      auditLogEventBusArn:
        "VALUE_FOR:/super-deals/dev/users-ms/private/Events/Buses/AuditLog/Arn",
    });
  });

  test("publishStringParameters creates parameters for each k/v (smoke)", () => {
    // We don't assert CDK constructs; just ensure no throw
    expect(() =>
      publishStringParameters(scope, "/base", { A: "1", B: "2" })
    ).not.toThrow();
    expect(StringParameter).toHaveBeenCalledTimes(2);
  });

  test("publishSecureStringParameters writes secure strings and applies encryption key", () => {
    publishSecureStringParameters(
      scope,
      "/secure",
      { secretToken: "xyz" },
      { encryptionKeyArn: "arn:aws:kms:region:acct:key/id" }
    );

    expect(StringParameter).toHaveBeenCalledWith(
      scope,
      "SecureParam_secretToken",
      expect.objectContaining({
        parameterName: "/secure/secretToken",
        stringValue: "xyz",
        tier: "STANDARD",
      })
    );

    // Verify addPropertyOverride was called to set SecureString type
    const cfnParameter = StringParameter.instances[0].node.defaultChild;
    expect(cfnParameter.addPropertyOverride).toHaveBeenCalledWith("Type", "SecureString");
    expect(cfnParameter.addPropertyOverride).toHaveBeenCalledWith("KeyId", "arn:aws:kms:region:acct:key/id");
    
    // Verify the keyId was set
    expect(cfnParameter.keyId).toBe("arn:aws:kms:region:acct:key/id");
  });

  test("readSecureParam returns mocked secure value", () => {
    const val = readSecureParam(scope, "/super-deals/dev/platform/private/monitor/slack/webhookUrl");
    expect(val).toBe("SECURE_VALUE_FOR:/super-deals/dev/platform/private/monitor/slack/webhookUrl");
  });

  test("readSecureBindings maps params to secure reads under base path", () => {
    const base = "/super-deals/dev/platform/private";
    const out = readSecureBindings(scope, base, {
      slackWebhookUrl: "monitor/slack/webhookUrl",
      incidentWebhookUrl: "monitor/slack/incidentWebhookUrl",
    });
    expect(out).toEqual({
      slackWebhookUrl: "SECURE_VALUE_FOR:/super-deals/dev/platform/private/monitor/slack/webhookUrl",
      incidentWebhookUrl:
        "SECURE_VALUE_FOR:/super-deals/dev/platform/private/monitor/slack/incidentWebhookUrl",
    });
  });
});
