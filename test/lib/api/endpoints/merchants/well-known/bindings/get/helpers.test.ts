// Mock AWS SDK - must be before imports
const mockSend = jest.fn();

jest.mock("@aws-sdk/client-ssm", () => {
  return {
    SSMClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    GetParametersByPathCommand: jest.fn((params) => params),
  };
});

import {
  env,
  readPublicBindingsFromSSM,
  createFallbackBindings,
} from "#lib/api/endpoints/merchants/well-known/bindings/get/helpers";

describe("helpers.env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns environment variable value when set", () => {
    process.env.TEST_VAR = "test-value";
    expect(env("TEST_VAR")).toBe("test-value");
  });

  test("returns fallback when env var not set", () => {
    delete process.env.TEST_VAR;
    expect(env("TEST_VAR", "fallback-value")).toBe("fallback-value");
  });

  test("returns empty string when env var not set and no fallback", () => {
    delete process.env.TEST_VAR;
    expect(env("TEST_VAR")).toBe("");
  });

  test("prefers env var over fallback", () => {
    process.env.TEST_VAR = "env-value";
    expect(env("TEST_VAR", "fallback-value")).toBe("env-value");
  });
});

describe("helpers.readPublicBindingsFromSSM", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockSend.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns null when SSM_PUBLIC_PATH not set", async () => {
    delete process.env.SSM_PUBLIC_PATH;
    const result = await readPublicBindingsFromSSM();
    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns transformed parameters from SSM", async () => {
    process.env.SSM_PUBLIC_PATH = "/super-deals/dev/users/public";

    mockSend.mockResolvedValue({
      Parameters: [
        {
          Name: "/super-deals/dev/users/public/auth/userPoolId",
          Value: "us-east-1_ABC123",
        },
        {
          Name: "/super-deals/dev/users/public/api/baseUrl",
          Value: "https://api.example.com",
        },
      ],
    });

    const result = await readPublicBindingsFromSSM();

    expect(result).toEqual({
      "auth/userPoolId": "us-east-1_ABC123",
      "api/baseUrl": "https://api.example.com",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test("strips base path from parameter names", async () => {
    process.env.SSM_PUBLIC_PATH = "/app/prod/service/public";

    mockSend.mockResolvedValue({
      Parameters: [
        {
          Name: "/app/prod/service/public/config/key",
          Value: "value1",
        },
      ],
    });

    const result = await readPublicBindingsFromSSM();

    expect(result).toEqual({
      "config/key": "value1",
    });
  });

  test("skips parameters without Name", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    mockSend.mockResolvedValue({
      Parameters: [
        {
          Name: "/test/path/valid",
          Value: "value1",
        },
        {
          Value: "value2", // Missing Name
        },
      ],
    });

    const result = await readPublicBindingsFromSSM();

    expect(result).toEqual({
      valid: "value1",
    });
  });

  test("skips parameters without Value", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    mockSend.mockResolvedValue({
      Parameters: [
        {
          Name: "/test/path/valid",
          Value: "value1",
        },
        {
          Name: "/test/path/invalid",
          // Missing Value
        },
      ],
    });

    const result = await readPublicBindingsFromSSM();

    expect(result).toEqual({
      valid: "value1",
    });
  });

  test("returns null on SSM error", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    mockSend.mockRejectedValue(new Error("SSM error"));

    const result = await readPublicBindingsFromSSM();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error reading SSM bindings:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  test("handles empty Parameters array", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    mockSend.mockResolvedValue({
      Parameters: [],
    });

    const result = await readPublicBindingsFromSSM();

    expect(result).toEqual({});
  });

  test("handles undefined Parameters", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    mockSend.mockResolvedValue({});

    const result = await readPublicBindingsFromSSM();

    expect(result).toEqual({});
  });
});

describe("helpers.createFallbackBindings", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("creates bindings from environment variables", () => {
    process.env.SERVICE_NAME = "test-service";
    process.env.ENV_NAME = "dev";
    process.env.AWS_REGION = "us-west-2";
    process.env.API_BASE_URL = "https://api.test.com";
    process.env.S3_BUCKET_NAME = "test-bucket";

    const result = createFallbackBindings();

    expect(result).toEqual({
      service: "test-service",
      env: "dev",
      region: "us-west-2",
      api: {
        baseUrl: "https://api.test.com",
      },
      storage: {
        bucket: "test-bucket",
        region: "us-west-2",
      },
    });
  });

  test("uses default service name when SERVICE_NAME not set", () => {
    delete process.env.SERVICE_NAME;
    process.env.ENV_NAME = "dev";
    process.env.AWS_REGION = "us-east-1";

    const result = createFallbackBindings();

    expect(result.service).toBe("users-ms");
  });

  test("prefers AWS_REGION over REGION", () => {
    process.env.AWS_REGION = "us-west-2";
    process.env.REGION = "us-east-1";

    const result = createFallbackBindings();

    expect(result.region).toBe("us-west-2");
    expect(result.storage.region).toBe("us-west-2");
  });

  test("falls back to REGION when AWS_REGION not set", () => {
    delete process.env.AWS_REGION;
    process.env.REGION = "eu-west-1";

    const result = createFallbackBindings();

    expect(result.region).toBe("eu-west-1");
    expect(result.storage.region).toBe("eu-west-1");
  });

  test("handles missing environment variables gracefully", () => {
    delete process.env.SERVICE_NAME;
    delete process.env.ENV_NAME;
    delete process.env.AWS_REGION;
    delete process.env.REGION;
    delete process.env.API_BASE_URL;
    delete process.env.S3_BUCKET_NAME;

    const result = createFallbackBindings();

    expect(result).toEqual({
      service: "users-ms",
      env: "",
      region: "",
      api: {
        baseUrl: "",
      },
      storage: {
        bucket: "",
        region: "",
      },
    });
  });
});
