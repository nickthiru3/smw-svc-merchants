/**
 * Helper functions for user sign-up endpoint
 *
 * This module follows a layered architecture approach:
 * - Top layer (handler.ts): High-level orchestration and business flow
 * - Middle layer (this file): Reusable business logic and data transformations
 * - Bottom layer (AWS SDK, external services): Infrastructure interactions
 *
 * Benefits of this separation:
 * - Each function has a single, clear responsibility
 * - Functions can be tested in isolation
 * - Implementation details don't clutter the main handler
 * - Functions can be reused across different contexts
 */

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminAddUserToGroupCommand,
  type AttributeType,
  type SignUpCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";
import { apiSuccess, apiError, serializeErr } from "#src/helpers/api";
import type { TApiResponse } from "#src/helpers/api";
import { merchantPayloadSchema } from "./payload.schema";
import {
  TUserType,
  TAllowedGroupKey,
  TMerchantPayloadSchema,
  TNormalizedUserData,
  IUserProfile,
  TResult,
} from "./types";

const cognitoClient = new CognitoIdentityProviderClient();
const ddbClient = new DynamoDBClient();

const ALLOWED_GROUPS = {
  merchant: "merchant",
  customer: "customer",
  admin: "admin",
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a URL string
 * @param url - The URL string to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Validates business rules not covered by schema validation
 *
 * Throws errors for:
 * - Year of registration in the future
 * - Year of registration before 1900
 * - Invalid website URL format
 *
 * @param data - Normalized user data to validate
 * @throws Error if validation fails
 */
export function validateData(data: TNormalizedUserData): void {
  const currentYear = new Date().getFullYear();

  // Validate year of registration is not in the future
  if (data.yearOfRegistration > currentYear) {
    throw new Error("Year of registration cannot be in the future");
  }

  // Validate year of registration is not too far in the past (arbitrary business rule)
  if (data.yearOfRegistration < 1900) {
    throw new Error("Year of registration is invalid");
  }

  // Validate website if provided
  if (data.website) {
    if (!isValidUrl(data.website)) {
      throw new Error("Website URL is invalid");
    }
  }
}

/**
 * Parses and validates the request body against the merchant payload schema
 *
 * @param event - API Gateway proxy event
 * @returns Result object with either validated data or error response
 */
export function parseAndValidateBody(
  event: APIGatewayProxyEvent
): TResult<TMerchantPayloadSchema> {
  if (!event.body) {
    return {
      ok: false,
      response: apiError(400, "Invalid request body: body is required"),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch (e) {
    return {
      ok: false,
      response: apiError(400, "Invalid JSON in request body", serializeErr(e)),
    };
  }
  const result = merchantPayloadSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(400, "Invalid request body", result.error.flatten()),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates required environment variables are present
 *
 * @returns Result object with either env vars or error response
 */
export function getRequiredEnv(): TResult<{
  userPoolId: string;
  userPoolClientId: string;
  tableName: string;
}> {
  const userPoolId = process.env.USER_POOL_ID;
  const userPoolClientId = process.env.USER_POOL_CLIENT_ID;
  const tableName = process.env.TABLE_NAME;
  if (!userPoolId || !userPoolClientId || !tableName) {
    return {
      ok: false,
      response: apiError(500, "Server configuration error", {
        missing: {
          USER_POOL_ID: !userPoolId,
          USER_POOL_CLIENT_ID: !userPoolClientId,
          TABLE_NAME: !tableName,
        },
      }),
    };
  }
  return { ok: true, data: { userPoolId, userPoolClientId, tableName } };
}

// ============================================================================
// DATA TRANSFORMATION HELPERS
// ============================================================================

/**
 * Normalizes user data by trimming whitespace and standardizing formats
 *
 * Transformations:
 * - Email: lowercase and trim
 * - UserType: lowercase
 * - Text fields: trim whitespace
 * - Nested objects: recursively normalize
 *
 * @param data - Raw merchant payload data
 * @returns Normalized user data
 */
export function normalizeData(
  data: TMerchantPayloadSchema
): TNormalizedUserData {
  const normalizedData: TNormalizedUserData = {
    ...data,
    email: data.email.toLowerCase().trim(),
    userType: data.userType.toLowerCase() as typeof data.userType,
    businessName: data.businessName.trim(),
    registrationNumber: data.registrationNumber.trim(),
    website:
      typeof data.website === "string" ? data.website.trim() : data.website,
    phone: data.phone.trim(),
    primaryContact: {
      ...data.primaryContact,
      name: data.primaryContact.name.trim(),
      email: data.primaryContact.email.toLowerCase().trim(),
      phone: data.primaryContact.phone.trim(),
    },
  };

  return normalizedData;
}

/**
 * Prepares minimal user attributes for Cognito registration
 *
 * Only includes attributes needed for authentication:
 * - email (standard attribute)
 * - custom:userType (custom attribute)
 *
 * @param data - Normalized user data
 * @returns Array of Cognito attribute objects
 */
export function prepareUserAttributesForCognito(
  data: TNormalizedUserData
): AttributeType[] {
  return [
    { Name: "email", Value: data.email },
    { Name: "custom:userType", Value: data.userType },
  ];
}

/**
 * Extracts the user ID from Cognito sign-up response
 *
 * @param signUpResponse - Cognito SignUp command output
 * @returns User ID (UserSub)
 */
export function extractUserIdFromSignUpResponse(
  signUpResponse: SignUpCommandOutput
): string {
  return signUpResponse.UserSub as string;
}

/**
 * Prepares complete user profile for DynamoDB storage
 *
 * Uses single-table design pattern:
 * - PK: USER#{userId}
 * - SK: USER#{userId}
 * - GSI1PK: USERTYPE#{userType}
 * - GSI1SK: USER#{userId}
 *
 * @param data - Normalized user data
 * @param userId - Cognito user ID
 * @returns User profile object ready for DynamoDB
 */
export function prepareUserProfileForDynamoDB(
  data: TNormalizedUserData,
  userId: string
): IUserProfile {
  const timestamp = new Date().toISOString();

  const userProfile: IUserProfile = {
    // Primary key - using the same value for PK and SK
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,

    // Data fields
    userId,
    userType: data.userType,
    email: data.email,
    createdAt: timestamp,
    updatedAt: timestamp,
    // GSI keys for querying users by type
    GSI1PK: `USERTYPE#${data.userType}`,
    GSI1SK: `USER#${userId}`,
  };

  // Add merchant-specific fields if user is a merchant
  if (data.userType === "merchant") {
    userProfile.businessName = data.businessName;
    userProfile.registrationNumber = data.registrationNumber;
    userProfile.yearOfRegistration = data.yearOfRegistration;
    userProfile.website = data.website;
    userProfile.phone = data.phone;

    // Store complex objects directly in DynamoDB
    userProfile.address = data.address;
    userProfile.primaryContact = data.primaryContact;
    userProfile.productCategories = data.productCategories;
  }

  return userProfile;
}

// ============================================================================
// AWS SERVICE INTERACTION HELPERS
// ============================================================================

/**
 * Registers a new user in Cognito
 *
 * @param userPoolClientId - Cognito User Pool Client ID
 * @param username - User's email (used as username)
 * @param password - User's password
 * @param userAttributes - Array of user attributes
 * @returns Cognito sign-up response
 * @throws Error with statusCode 409 if user already exists
 * @throws Error with statusCode 502 for other Cognito errors
 */
export async function registerUserWithCognito(
  userPoolClientId: string,
  username: string,
  password: string,
  userAttributes: AttributeType[]
): Promise<SignUpCommandOutput> {
  console.log("Signing up user with Cognito:", {
    email: username,
    userPoolClientId: userPoolClientId,
    attributesCount: userAttributes.length,
  });

  try {
    const signUpResponse = await cognitoClient.send(
      new SignUpCommand({
        ClientId: userPoolClientId,
        Username: username,
        Password: password,
        UserAttributes: userAttributes,
      })
    );

    console.log(
      "Cognito sign-up response:",
      JSON.stringify(signUpResponse, null, 2)
    );

    return signUpResponse;
  } catch (err: any) {
    if (err?.name === "UsernameExistsException") {
      throw Object.assign(new Error("User already exists"), {
        statusCode: 409,
        details: serializeErr(err),
      });
    }
    throw Object.assign(new Error("Error during sign-up"), {
      statusCode: 502,
      details: serializeErr(err),
    });
  }
}

/**
 * Adds a user to a Cognito user group
 *
 * @param userPoolId - Cognito User Pool ID
 * @param username - User's email
 * @param userType - User type (merchant, customer, admin)
 */
export async function addUserToGroup(
  userPoolId: string,
  username: string,
  userType: TAllowedGroupKey
): Promise<void> {
  console.log(`Adding user ${username} to group ${userType}`);

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: ALLOWED_GROUPS[userType],
    })
  );

  console.log(`User ${username} successfully added to group ${userType}`);
}

/**
 * Saves user profile to DynamoDB with conditional write
 *
 * Uses conditional expression to prevent overwriting existing profiles
 *
 * @param tableName - DynamoDB table name
 * @param userProfile - User profile object
 * @throws Error with statusCode 409 if profile already exists
 * @throws Error with statusCode 502 for other DynamoDB errors
 */
export async function saveUserProfileToDynamoDB(
  tableName: string,
  userProfile: IUserProfile
): Promise<void> {
  console.log("Saving user profile to DynamoDB:", {
    userId: userProfile.userId,
    userType: userProfile.userType,
    tableName,
  });

  try {
    await ddbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(userProfile),
        ConditionExpression:
          "attribute_not_exists(#PK) AND attribute_not_exists(#SK)",
        ExpressionAttributeNames: { "#PK": "PK", "#SK": "SK" },
      })
    );
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw Object.assign(new Error("Profile already exists"), {
        statusCode: 409,
        details: serializeErr(err),
      });
    }
    throw Object.assign(new Error("Error saving profile"), {
      statusCode: 502,
      details: serializeErr(err),
    });
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Creates a success API response for user sign-up
 *
 * Includes:
 * - Success message
 * - User confirmation status
 * - User type
 * - User ID
 * - Code delivery details (if available)
 * - Backward compatibility merchantId field for merchant users
 *
 * @param signUpResponse - Cognito sign-up response
 * @param userType - User type
 * @returns Formatted API success response
 */
export function prepareSuccessResponse(
  signUpResponse: SignUpCommandOutput,
  userType: TUserType
): TApiResponse {
  const userId = signUpResponse.UserSub as string;

  const responseData = {
    message: "Merchant registered. Needs to submit OTP to complete sign-up",
    userConfirmed: signUpResponse.UserConfirmed || false,
    userType: userType,
    userId: userId,
  };

  // Add code delivery details if available
  if (signUpResponse.CodeDeliveryDetails) {
    (responseData as any).codeDeliveryDetails =
      signUpResponse.CodeDeliveryDetails;
  }

  // Add backward compatibility for merchant-specific clients
  if (userType === "merchant") {
    (responseData as any).merchantId = userId;
  }

  const successResponse = apiSuccess(responseData, 201);

  console.log(`Success Response: ${JSON.stringify(successResponse, null, 2)}`);

  return successResponse;
}

/**
 * Creates a standardized error API response
 *
 * Extracts status code from error object if present, defaults to 400
 *
 * @param err - Error object
 * @returns Formatted API error response
 */
export function prepareErrorResponse(err: unknown): TApiResponse {
  console.log(err);

  const anyErr = err as any;
  const status =
    typeof anyErr?.statusCode === "number" ? anyErr.statusCode : 400;
  const message = anyErr?.message || "Failed to register user account";
  const details = anyErr?.details ?? serializeErr(err);

  const errorResponse = apiError(status, message, details);

  return errorResponse;
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

/**
 * Logs the received API Gateway event
 * @param event - API Gateway proxy event
 */
export function logEventReceived(event: APIGatewayProxyEvent): void {
  console.log("Received event:", JSON.stringify(event, null, 2));
}

/**
 * Logs an error that occurred during processing
 * @param err - Error object
 */
export function logError(err: unknown): void {
  console.error("Error in sign-up handler:", err);
}
