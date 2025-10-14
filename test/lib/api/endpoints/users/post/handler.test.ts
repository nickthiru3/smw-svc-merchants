import { APIGatewayProxyEvent } from "aws-lambda";

// Hoisted mocks BEFORE importing the handler
const cognitoSendMock = jest.fn();
const dynamoSendMock = jest.fn();

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  __esModule: true,
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: cognitoSendMock,
  })),
  SignUpCommand: class SignUpCommand {
    constructor(public readonly _input: any) {}
  },
  AdminAddUserToGroupCommand: class AdminAddUserToGroupCommand {
    constructor(public readonly _input: any) {}
  },
}));

jest.mock("@aws-sdk/client-dynamodb", () => ({
  __esModule: true,
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: dynamoSendMock,
  })),
  PutItemCommand: class PutItemCommand {
    constructor(public readonly _input: any) {}
  },
}));

jest.mock("@aws-sdk/util-dynamodb", () => ({
  marshall: jest.fn((obj) => obj),
}));

import { handler } from "#lib/api/endpoints/users/post/handler";

function makeEvent(body: any): APIGatewayProxyEvent {
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

const validMerchantBody = {
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

describe("POST /users handler (behavior)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.USER_POOL_ID = "test-pool-id";
    process.env.USER_POOL_CLIENT_ID = "test-client-id";
    process.env.TABLE_NAME = "UsersTable";
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
    delete process.env.USER_POOL_CLIENT_ID;
    delete process.env.TABLE_NAME;
  });

  test("returns 201 on successful merchant sign-up", async () => {
    // Mock Cognito SignUp response
    cognitoSendMock.mockResolvedValueOnce({
      UserSub: "test-user-123",
      UserConfirmed: false,
      CodeDeliveryDetails: {
        Destination: "t***@example.com",
        DeliveryMedium: "EMAIL",
        AttributeName: "email",
      },
    });

    // Mock Cognito AddUserToGroup response
    cognitoSendMock.mockResolvedValueOnce({});

    // Mock DynamoDB PutItem response
    dynamoSendMock.mockResolvedValueOnce({});

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      message: "Merchant registered. Needs to submit OTP to complete sign-up",
      userId: "test-user-123",
      userType: "merchant",
      merchantId: "test-user-123", // backward compatibility
      userConfirmed: false,
    });
    expect(body.codeDeliveryDetails).toBeDefined();
  });

  test("returns 409 when user already exists in Cognito", async () => {
    cognitoSendMock.mockRejectedValueOnce({
      name: "UsernameExistsException",
      message: "User already exists",
    });

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toBe("User already exists");
  });

  test("returns 409 when profile already exists in DynamoDB", async () => {
    // Mock successful Cognito sign-up
    cognitoSendMock.mockResolvedValueOnce({
      UserSub: "test-user-123",
      UserConfirmed: false,
    });

    // Mock successful add to group
    cognitoSendMock.mockResolvedValueOnce({});

    // Mock DynamoDB conditional check failure
    dynamoSendMock.mockRejectedValueOnce({
      name: "ConditionalCheckFailedException",
      message: "Item already exists",
    });

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toBe("Profile already exists");
  });

  test("returns 502 on Cognito error", async () => {
    cognitoSendMock.mockRejectedValueOnce({
      name: "InternalErrorException",
      message: "Cognito internal error",
    });

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toBe("Error during sign-up");
  });

  test("returns 502 on DynamoDB error", async () => {
    // Mock successful Cognito operations
    cognitoSendMock.mockResolvedValueOnce({
      UserSub: "test-user-123",
      UserConfirmed: false,
    });
    cognitoSendMock.mockResolvedValueOnce({});

    // Mock DynamoDB error
    dynamoSendMock.mockRejectedValueOnce({
      name: "ServiceUnavailable",
      message: "DynamoDB unavailable",
    });

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toBe("Error saving profile");
  });

  test("returns 500 when USER_POOL_ID is missing", async () => {
    delete process.env.USER_POOL_ID;

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Server configuration error");
    expect(body.details.missing.USER_POOL_ID).toBe(true);
  });

  test("returns 500 when USER_POOL_CLIENT_ID is missing", async () => {
    delete process.env.USER_POOL_CLIENT_ID;

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Server configuration error");
    expect(body.details.missing.USER_POOL_CLIENT_ID).toBe(true);
  });

  test("returns 500 when TABLE_NAME is missing", async () => {
    delete process.env.TABLE_NAME;

    const res = await handler(makeEvent(validMerchantBody), {} as any);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Server configuration error");
    expect(body.details.missing.TABLE_NAME).toBe(true);
  });

  test("returns 400 on invalid JSON", async () => {
    const res = await handler(makeEvent("{not-json"), {} as any);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid JSON in request body");
  });

  test("returns 400 when body is missing", async () => {
    const event = makeEvent(validMerchantBody);
    event.body = undefined as any;

    const res = await handler(event, {} as any);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe(
      "Invalid request body: body is required"
    );
  });

  test("returns 400 on schema validation error", async () => {
    const bad = { ...validMerchantBody, email: "not-an-email" };

    const res = await handler(makeEvent(bad), {} as any);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid request body");
  });

  test("returns 400 when year of registration is in the future", async () => {
    const futureYear = new Date().getFullYear() + 1;
    const bad = { ...validMerchantBody, yearOfRegistration: futureYear };

    const res = await handler(makeEvent(bad), {} as any);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    // Schema validation catches this first
    expect(body.error).toBe("Invalid request body");
    expect(body.details.fieldErrors.yearOfRegistration).toBeDefined();
  });

  test("returns 400 when website URL is invalid", async () => {
    const bad = { ...validMerchantBody, website: "not-a-url" };

    const res = await handler(makeEvent(bad), {} as any);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    // Schema validation catches this first
    expect(body.error).toBe("Invalid request body");
    expect(body.details.fieldErrors.website).toBeDefined();
  });

  test("returns 400 for customer sign-up (schema rejects non-merchant)", async () => {
    const customerBody = {
      ...validMerchantBody,
      userType: "customer",
    };

    const res = await handler(makeEvent(customerBody), {} as any);

    // Schema validation rejects non-merchant userType
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Invalid request body");
    expect(body.details.fieldErrors.userType).toBeDefined();
  });

  test("returns 400 for admin sign-up (schema rejects non-merchant)", async () => {
    const adminBody = {
      ...validMerchantBody,
      userType: "admin",
    };

    const res = await handler(makeEvent(adminBody), {} as any);

    // Schema validation rejects non-merchant userType
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Invalid request body");
    expect(body.details.fieldErrors.userType).toBeDefined();
  });

  test("normalizes email and businessName (trimming whitespace)", async () => {
    const bodyWithSpaces = {
      ...validMerchantBody,
      email: "  TEST@EXAMPLE.COM  ",
      businessName: "  Test Business  ",
    };

    cognitoSendMock.mockResolvedValueOnce({
      UserSub: "test-user-123",
      UserConfirmed: false,
    });
    cognitoSendMock.mockResolvedValueOnce({});
    dynamoSendMock.mockResolvedValueOnce({});

    const res = await handler(makeEvent(bodyWithSpaces), {} as any);

    expect(res.statusCode).toBe(201);

    // Verify Cognito was called with normalized email
    expect(cognitoSendMock.mock.calls[0][0]._input.Username).toBe(
      "test@example.com"
    );
  });
});
