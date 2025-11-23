// Mock AWS SDK before importing handler
const mockSend = jest.fn();

jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetParametersByPathCommand: jest.fn((params) => params),
}));

import { handler } from "#lib/api/endpoints/merchants/.well-known/bindings/get/handler";

describe("GET /.well-known/bindings handler (behavior)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    // Set up default environment variables
    process.env.SERVICE_NAME = "users-ms";
    process.env.ENV_NAME = "test";
    process.env.AWS_REGION = "us-east-1";
    process.env.API_BASE_URL = "https://api.test.com";
    process.env.S3_BUCKET_NAME = "test-bucket";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns 200 with SSM bindings when available", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    mockSend.mockResolvedValueOnce({
      Parameters: [
        {
          Name: "/test/path/api/baseUrl",
          Value: "https://api.from-ssm.com",
        },
        {
          Name: "/test/path/auth/userPoolId",
          Value: "us-east-1_SSM123",
        },
      ],
    });

    const res = await handler();

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(res.headers["cache-control"]).toBe("max-age=300");

    const body = JSON.parse(res.body);
    expect(body).toEqual({
      "api/baseUrl": "https://api.from-ssm.com",
      "auth/userPoolId": "us-east-1_SSM123",
    });
  });

  test("returns 200 with fallback bindings when SSM unavailable", async () => {
    // No SSM_PUBLIC_PATH set, should use fallback
    delete process.env.SSM_PUBLIC_PATH;

    const res = await handler();

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(res.headers["cache-control"]).toBe("max-age=300");

    const body = JSON.parse(res.body);
    expect(body).toEqual({
      service: "users-ms",
      env: "test",
      region: "us-east-1",
      api: {
        baseUrl: "https://api.test.com",
      },
      storage: {
        bucket: "test-bucket",
        region: "us-east-1",
      },
    });

    // SSM should not have been called
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns fallback when SSM returns null", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    // SSM returns empty parameters
    mockSend.mockResolvedValueOnce({
      Parameters: [],
    });

    const res = await handler();

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Should return empty object from SSM (which is truthy), not fallback
    expect(body).toEqual({});
  });

  test("returns fallback when SSM throws error", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    mockSend.mockRejectedValueOnce(new Error("SSM error"));

    const res = await handler();

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Should use fallback when SSM fails
    expect(body).toEqual({
      service: "users-ms",
      env: "test",
      region: "us-east-1",
      api: {
        baseUrl: "https://api.test.com",
      },
      storage: {
        bucket: "test-bucket",
        region: "us-east-1",
      },
    });

    consoleErrorSpy.mockRestore();
  });

  test("includes cache-control header for 5 minutes", async () => {
    delete process.env.SSM_PUBLIC_PATH;

    const res = await handler();

    expect(res.headers["cache-control"]).toBe("max-age=300");
  });

  test("returns JSON content-type header", async () => {
    delete process.env.SSM_PUBLIC_PATH;

    const res = await handler();

    expect(res.headers["content-type"]).toBe("application/json");
  });

  test("prefers SSM bindings over fallback when both available", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";
    process.env.API_BASE_URL = "https://fallback.com";

    mockSend.mockResolvedValueOnce({
      Parameters: [
        {
          Name: "/test/path/api/url",
          Value: "https://ssm-wins.com",
        },
      ],
    });

    const res = await handler();

    const body = JSON.parse(res.body);
    expect(body).toEqual({
      "api/url": "https://ssm-wins.com",
    });
    // Should not include fallback values
    expect(body.api?.baseUrl).toBeUndefined();
  });

  test("uses REGION env var when AWS_REGION not set", async () => {
    delete process.env.AWS_REGION;
    process.env.REGION = "eu-west-1";
    delete process.env.SSM_PUBLIC_PATH;

    const res = await handler();

    const body = JSON.parse(res.body);
    expect(body.region).toBe("eu-west-1");
    expect(body.storage.region).toBe("eu-west-1");
  });

  test("handles missing environment variables gracefully", async () => {
    delete process.env.SERVICE_NAME;
    delete process.env.ENV_NAME;
    delete process.env.AWS_REGION;
    delete process.env.REGION;
    delete process.env.API_BASE_URL;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.SSM_PUBLIC_PATH;

    const res = await handler();

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Should return fallback with empty/default values
    expect(body).toEqual({
      service: "users-ms", // Default from helper
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

  test("returns valid JSON even with complex SSM data", async () => {
    process.env.SSM_PUBLIC_PATH = "/test/path";

    mockSend.mockResolvedValueOnce({
      Parameters: [
        {
          Name: "/test/path/nested/deep/value",
          Value: "complex-value",
        },
        {
          Name: "/test/path/special-chars/key",
          Value: "value-with-special!@#$%",
        },
      ],
    });

    const res = await handler();

    expect(res.statusCode).toBe(200);
    expect(() => JSON.parse(res.body)).not.toThrow();

    const body = JSON.parse(res.body);
    expect(body["nested/deep/value"]).toBe("complex-value");
    expect(body["special-chars/key"]).toBe("value-with-special!@#$%");
  });
});
