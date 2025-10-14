import type { APIGatewayProxyEvent } from "aws-lambda";
import type { SignUpCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import {
  isValidUrl,
  validateData,
  parseAndValidateBody,
  getRequiredEnv,
  normalizeData,
  prepareUserAttributesForCognito,
  extractUserIdFromSignUpResponse,
  prepareUserProfileForDynamoDB,
  prepareSuccessResponse,
  prepareErrorResponse,
  logEventReceived,
  logError,
} from "#lib/api/endpoints/users/post/helpers";
import type {
  TMerchantPayloadSchema,
  TNormalizedUserData,
} from "#lib/api/endpoints/users/post/types";

// Mock AWS SDK clients
jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn(),
  SignUpCommand: jest.fn(),
  AdminAddUserToGroupCommand: jest.fn(),
}));

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(),
  PutItemCommand: jest.fn(),
}));

jest.mock("@aws-sdk/util-dynamodb", () => ({
  marshall: jest.fn((obj) => obj),
}));

const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

// Helper to create mock API Gateway events
function makeEventBody(body: any): APIGatewayProxyEvent {
  return {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: "POST",
    isBase64Encoded: false,
    path: "/users",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "/users",
    requestContext: {} as any,
  };
}

// Helper to create valid merchant payload
function makeValidMerchantPayload(): TMerchantPayloadSchema {
  return {
    userType: "merchant",
    email: "test@example.com",
    password: "Test123!@#",
    businessName: "Test Business",
    registrationNumber: "REG123456",
    yearOfRegistration: 2020,
    website: "https://example.com",
    address: {
      buildingNumber: "123",
      street: "Main St",
      city: "TestCity",
      state: "TS",
      zip: "12345",
      country: "TestCountry",
    },
    phone: "+1234567890",
    primaryContact: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
    },
    productCategories: ["Electronics"],
  } as TMerchantPayloadSchema;
}

// ============================================================================
// VALIDATION HELPERS TESTS
// ============================================================================

describe("helpers.isValidUrl", () => {
  test("returns true for valid HTTP URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  test("returns true for valid HTTPS URL", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  test("returns true for URL with path", () => {
    expect(isValidUrl("https://example.com/path/to/page")).toBe(true);
  });

  test("returns false for invalid URL", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });
});

describe("helpers.validateData", () => {
  function makeBaseData(): TNormalizedUserData {
    return {
      userType: "merchant",
      email: "test@example.com",
      password: "Test123!@#",
      businessName: "Test Business",
      registrationNumber: "REG123456",
      yearOfRegistration: 2020,
      website: "https://example.com",
      address: {
        buildingNumber: "123",
        street: "Main St",
        city: "TestCity",
        state: "TS",
        zip: "12345",
        country: "TestCountry",
      },
      phone: "+1234567890",
      primaryContact: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
      },
      productCategories: ["Electronics"],
    };
  }

  test("does not throw for valid data", () => {
    const data = makeBaseData();
    expect(() => validateData(data)).not.toThrow();
  });

  test("throws when year of registration is in the future", () => {
    const data = makeBaseData();
    data.yearOfRegistration = new Date().getFullYear() + 1;
    expect(() => validateData(data)).toThrow(
      "Year of registration cannot be in the future"
    );
  });

  test("throws when year of registration is before 1900", () => {
    const data = makeBaseData();
    data.yearOfRegistration = 1899;
    expect(() => validateData(data)).toThrow("Year of registration is invalid");
  });

  test("throws when website URL is invalid", () => {
    const data = makeBaseData();
    data.website = "not-a-valid-url";
    expect(() => validateData(data)).toThrow("Website URL is invalid");
  });

  test("does not throw when website is undefined", () => {
    const data = makeBaseData();
    data.website = undefined;
    expect(() => validateData(data)).not.toThrow();
  });
});

describe("helpers.parseAndValidateBody", () => {
  const validPayload = makeValidMerchantPayload();

  test("returns ok=true for valid payload", () => {
    const res = parseAndValidateBody(makeEventBody(validPayload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.email).toBe("test@example.com");
      expect(res.data.businessName).toBe("Test Business");
    }
  });

  test("returns 400 when body is missing", () => {
    const event = makeEventBody(validPayload);
    (event as any).body = undefined;
    const res = parseAndValidateBody(event);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(400);
      expect(JSON.parse(res.response.body).error).toMatch(/body is required/);
    }
  });

  test("returns 400 when JSON is invalid", () => {
    const res = parseAndValidateBody(makeEventBody("{invalid-json"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(400);
      expect(JSON.parse(res.response.body).error).toMatch(/Invalid JSON/);
    }
  });

  test("returns 400 when schema validation fails", () => {
    const invalidPayload = { ...validPayload, email: "not-an-email" };
    const res = parseAndValidateBody(makeEventBody(invalidPayload));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(400);
      const body = JSON.parse(res.response.body);
      expect(body.error).toMatch(/Invalid request body/);
      expect(body.details).toBeDefined();
    }
  });

  test("returns 400 when required fields are missing", () => {
    const incompletePayload = { email: "test@example.com" };
    const res = parseAndValidateBody(makeEventBody(incompletePayload));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(400);
    }
  });
});

describe("helpers.getRequiredEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns ok=true when all env vars are set", () => {
    process.env.USER_POOL_ID = "test-pool-id";
    process.env.USER_POOL_CLIENT_ID = "test-client-id";
    process.env.TABLE_NAME = "test-table";

    const res = getRequiredEnv();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.userPoolId).toBe("test-pool-id");
      expect(res.data.userPoolClientId).toBe("test-client-id");
      expect(res.data.tableName).toBe("test-table");
    }
  });

  test("returns 500 when USER_POOL_ID is missing", () => {
    process.env.USER_POOL_CLIENT_ID = "test-client-id";
    process.env.TABLE_NAME = "test-table";
    delete process.env.USER_POOL_ID;

    const res = getRequiredEnv();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(500);
      const body = JSON.parse(res.response.body);
      expect(body.error).toMatch(/Server configuration error/);
      expect(body.details.missing.USER_POOL_ID).toBe(true);
    }
  });

  test("returns 500 when USER_POOL_CLIENT_ID is missing", () => {
    process.env.USER_POOL_ID = "test-pool-id";
    process.env.TABLE_NAME = "test-table";
    delete process.env.USER_POOL_CLIENT_ID;

    const res = getRequiredEnv();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(500);
      const body = JSON.parse(res.response.body);
      expect(body.details.missing.USER_POOL_CLIENT_ID).toBe(true);
    }
  });

  test("returns 500 when TABLE_NAME is missing", () => {
    process.env.USER_POOL_ID = "test-pool-id";
    process.env.USER_POOL_CLIENT_ID = "test-client-id";
    delete process.env.TABLE_NAME;

    const res = getRequiredEnv();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.statusCode).toBe(500);
      const body = JSON.parse(res.response.body);
      expect(body.details.missing.TABLE_NAME).toBe(true);
    }
  });
});

// ============================================================================
// DATA TRANSFORMATION HELPERS TESTS
// ============================================================================

describe("helpers.normalizeData", () => {
  test("trims and lowercases email", () => {
    const payload = makeValidMerchantPayload();
    payload.email = "  TEST@EXAMPLE.COM  ";
    const result = normalizeData(payload);
    expect(result.email).toBe("test@example.com");
  });

  test("lowercases userType", () => {
    const payload = makeValidMerchantPayload();
    payload.userType = "MERCHANT" as any;
    const result = normalizeData(payload);
    expect(result.userType).toBe("merchant");
  });

  test("trims businessName", () => {
    const payload = makeValidMerchantPayload();
    payload.businessName = "  Test Business  ";
    const result = normalizeData(payload);
    expect(result.businessName).toBe("Test Business");
  });

  test("trims registrationNumber", () => {
    const payload = makeValidMerchantPayload();
    payload.registrationNumber = "  REG123  ";
    const result = normalizeData(payload);
    expect(result.registrationNumber).toBe("REG123");
  });

  test("trims website if provided", () => {
    const payload = makeValidMerchantPayload();
    payload.website = "  https://example.com  ";
    const result = normalizeData(payload);
    expect(result.website).toBe("https://example.com");
  });

  test("handles undefined website", () => {
    const payload = makeValidMerchantPayload();
    payload.website = undefined;
    const result = normalizeData(payload);
    expect(result.website).toBeUndefined();
  });

  test("trims phone", () => {
    const payload = makeValidMerchantPayload();
    payload.phone = "  +1234567890  ";
    const result = normalizeData(payload);
    expect(result.phone).toBe("+1234567890");
  });

  test("normalizes primaryContact fields", () => {
    const payload = makeValidMerchantPayload();
    payload.primaryContact = {
      name: "  John Doe  ",
      email: "  JOHN@EXAMPLE.COM  ",
      phone: "  +1234567890  ",
    };
    const result = normalizeData(payload);
    expect(result.primaryContact.name).toBe("John Doe");
    expect(result.primaryContact.email).toBe("john@example.com");
    expect(result.primaryContact.phone).toBe("+1234567890");
  });
});

describe("helpers.prepareUserAttributesForCognito", () => {
  test("returns email and userType attributes", () => {
    const data: TNormalizedUserData = {
      ...makeValidMerchantPayload(),
      email: "test@example.com",
      userType: "merchant",
    };
    const attributes = prepareUserAttributesForCognito(data);
    expect(attributes).toHaveLength(2);
    expect(attributes).toContainEqual({ Name: "email", Value: "test@example.com" });
    expect(attributes).toContainEqual({ Name: "custom:userType", Value: "merchant" });
  });
});

describe("helpers.extractUserIdFromSignUpResponse", () => {
  test("extracts UserSub from response", () => {
    const response: SignUpCommandOutput = {
      UserSub: "test-user-id-123",
      UserConfirmed: undefined,
      $metadata: {},
    };
    const userId = extractUserIdFromSignUpResponse(response);
    expect(userId).toBe("test-user-id-123");
  });
});

describe("helpers.prepareUserProfileForDynamoDB", () => {
  test("creates profile with correct PK/SK structure", () => {
    const data: TNormalizedUserData = makeValidMerchantPayload();
    const userId = "test-user-123";
    const profile = prepareUserProfileForDynamoDB(data, userId);

    expect(profile.PK).toBe("USER#test-user-123");
    expect(profile.SK).toBe("USER#test-user-123");
    expect(profile.userId).toBe("test-user-123");
  });

  test("creates profile with GSI keys", () => {
    const data: TNormalizedUserData = makeValidMerchantPayload();
    const userId = "test-user-123";
    const profile = prepareUserProfileForDynamoDB(data, userId);

    expect(profile.GSI1PK).toBe("USERTYPE#merchant");
    expect(profile.GSI1SK).toBe("USER#test-user-123");
  });

  test("includes merchant-specific fields for merchant user", () => {
    const data: TNormalizedUserData = makeValidMerchantPayload();
    const userId = "test-user-123";
    const profile = prepareUserProfileForDynamoDB(data, userId);

    expect(profile.businessName).toBe("Test Business");
    expect(profile.registrationNumber).toBe("REG123456");
    expect(profile.yearOfRegistration).toBe(2020);
    expect(profile.website).toBe("https://example.com");
    expect(profile.phone).toBe("+1234567890");
    expect(profile.address).toEqual(data.address);
    expect(profile.primaryContact).toEqual(data.primaryContact);
    expect(profile.productCategories).toEqual(data.productCategories);
  });

  test("includes timestamps", () => {
    const data: TNormalizedUserData = makeValidMerchantPayload();
    const userId = "test-user-123";
    const profile = prepareUserProfileForDynamoDB(data, userId);

    expect(profile.createdAt).toBeDefined();
    expect(profile.updatedAt).toBeDefined();
    expect(typeof profile.createdAt).toBe("string");
    expect(typeof profile.updatedAt).toBe("string");
  });
});

// ============================================================================
// RESPONSE HELPERS TESTS
// ============================================================================

describe("helpers.prepareSuccessResponse", () => {
  test("creates 201 response with user data", () => {
    const signUpResponse: SignUpCommandOutput = {
      UserSub: "test-user-123",
      UserConfirmed: false,
      $metadata: {},
    };
    const response = prepareSuccessResponse(signUpResponse, "merchant");

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.userId).toBe("test-user-123");
    expect(body.userType).toBe("merchant");
    expect(body.userConfirmed).toBe(false);
    expect(body.message).toContain("Merchant registered");
  });

  test("includes merchantId for backward compatibility", () => {
    const signUpResponse: SignUpCommandOutput = {
      UserSub: "test-user-123",
      UserConfirmed: undefined,
      $metadata: {},
    };
    const response = prepareSuccessResponse(signUpResponse, "merchant");

    const body = JSON.parse(response.body);
    expect(body.merchantId).toBe("test-user-123");
  });

  test("includes CodeDeliveryDetails when present", () => {
    const signUpResponse: SignUpCommandOutput = {
      UserSub: "test-user-123",
      UserConfirmed: false,
      CodeDeliveryDetails: {
        Destination: "t***@example.com",
        DeliveryMedium: "EMAIL",
        AttributeName: "email",
      },
      $metadata: {},
    };
    const response = prepareSuccessResponse(signUpResponse, "merchant");

    const body = JSON.parse(response.body);
    expect(body.codeDeliveryDetails).toBeDefined();
    expect(body.codeDeliveryDetails.Destination).toBe("t***@example.com");
  });
});

describe("helpers.prepareErrorResponse", () => {
  test("creates 400 response for generic error", () => {
    const error = new Error("Test error");
    const response = prepareErrorResponse(error);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Test error");
  });

  test("uses custom statusCode from error object", () => {
    const error = Object.assign(new Error("Conflict"), { statusCode: 409 });
    const response = prepareErrorResponse(error);

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Conflict");
  });

  test("includes details from error object", () => {
    const error = Object.assign(new Error("Test error"), {
      statusCode: 502,
      details: { field: "email", reason: "invalid" },
    });
    const response = prepareErrorResponse(error);

    const body = JSON.parse(response.body);
    expect(body.details).toEqual({ field: "email", reason: "invalid" });
  });

  test("uses default message when error has no message", () => {
    const error = {};
    const response = prepareErrorResponse(error);

    const body = JSON.parse(response.body);
    expect(body.error).toBe("Failed to register user account");
  });
});

// ============================================================================
// LOGGING HELPERS TESTS
// ============================================================================

describe("helpers.logEventReceived", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("logs the event", () => {
    const event = makeEventBody({ test: "data" });
    logEventReceived(event);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Received event:",
      expect.any(String)
    );
  });
});

describe("helpers.logError", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("logs the error", () => {
    const error = new Error("Test error");
    logError(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error in sign-up handler:",
      error
    );
  });
});
