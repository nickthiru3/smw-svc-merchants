/**
 * User Sign-Up Handler
 *
 * High-level orchestration of the user registration flow.
 * This handler follows a layered architecture:
 *
 * Layer 1 (This file): Business flow orchestration
 * - Coordinates the sign-up process
 * - Dispatches to appropriate user type pipeline
 * - Handles top-level error catching
 *
 * Layer 2 (helpers.ts): Business logic and transformations
 * - Data validation and normalization
 * - AWS service interactions
 * - Response formatting
 *
 * Layer 3 (AWS SDK, external services): Infrastructure
 * - Cognito, DynamoDB, etc.
 */

import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { apiError } from "#src/helpers/api";
import type { TApiResponse } from "#src/helpers/api";
import {
  parseAndValidateBody,
  getRequiredEnv,
  normalizeData,
  validateData,
  prepareUserAttributesForCognito,
  registerUserWithCognito,
  addUserToGroup,
  extractUserIdFromSignUpResponse,
  prepareUserProfileForDynamoDB,
  saveUserProfileToDynamoDB,
  prepareSuccessResponse,
  prepareErrorResponse,
  logEventReceived,
  logError,
} from "./helpers";
import {
  TUserType,
  TAllowedGroupKey,
  IMerchantContext,
  TMerchantStep,
} from "./types";

/**
 * Handler for the user sign-up process
 *
 * This handler manages the complete user registration flow:
 * 1. Normalizes and validates user input data
 * 2. Registers the user in Cognito with minimal attributes
 * 3. Adds the user to the appropriate user group
 * 4. Stores the complete user profile in DynamoDB
 * 5. Returns a formatted success response
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<TApiResponse> => {
  logEventReceived(event);

  // Parse + validate body
  const bodyResult = parseAndValidateBody(event);
  if (!bodyResult.ok) return bodyResult.response;
  const data = bodyResult.data;

  // Env asserts (lightweight)
  const envResult = getRequiredEnv();
  if (!envResult.ok) return envResult.response;
  const { userPoolId, userPoolClientId, tableName } = envResult.data;

  try {
    // Normalize and validate dynamic rules
    const normalizedData = normalizeData(data);
    // Throws on invalid data
    validateData(normalizedData);

    // Dispatcher by userType (merchant implemented; others 501)
    const pipelines: Record<
      TUserType,
      (ctx: IMerchantContext) => Promise<IMerchantContext>
    > = {
      merchant: runMerchantPipeline,
      customer: async (ctx) => {
        return {
          ...ctx,
          response: apiError(501, "Customer sign-up not implemented"),
        };
      },
      admin: async (ctx) => {
        return {
          ...ctx,
          response: apiError(501, "Admin sign-up not implemented"),
        };
      },
    };

    const initialContext: IMerchantContext = {
      env: { userPoolId, userPoolClientId, tableName },
      input: normalizedData,
    };
    const userTypeKey = normalizedData.userType as TUserType;
    const finalCtx = await pipelines[userTypeKey](initialContext);
    return finalCtx.response!;
  } catch (err) {
    logError(err);
    return prepareErrorResponse(err);
  }
};

// ============================================================================
// MERCHANT SIGN-UP PIPELINE
// ============================================================================

/**
 * Merchant sign-up pipeline steps
 *
 * Each step is a pure transformation of the context object:
 * - Takes context as input
 * - Performs one specific action
 * - Returns updated context
 *
 * This pipeline pattern provides:
 * - Clear sequence of operations
 * - Easy to test individual steps
 * - Easy to add/remove/reorder steps
 * - Consistent error handling
 */

const stepMakeUserAttributes: TMerchantStep = async (ctx) => {
  return { ...ctx, userAttributes: prepareUserAttributesForCognito(ctx.input) };
};

const stepSignUpInCognito: TMerchantStep = async (ctx) => {
  const { userPoolClientId } = ctx.env;
  const resp = await registerUserWithCognito(
    userPoolClientId,
    ctx.input.email,
    ctx.input.password,
    ctx.userAttributes || []
  );
  return { ...ctx, signUpResponse: resp };
};

const stepAddToGroup: TMerchantStep = async (ctx) => {
  const { userPoolId } = ctx.env;
  await addUserToGroup(
    userPoolId,
    ctx.input.email,
    ctx.input.userType as TAllowedGroupKey
  );
  return ctx;
};

const stepBuildUserProfile: TMerchantStep = async (ctx) => {
  const userId = extractUserIdFromSignUpResponse(ctx.signUpResponse!);
  const profile = prepareUserProfileForDynamoDB(ctx.input, userId);
  return { ...ctx, userId, userProfile: profile };
};

const stepSaveProfile: TMerchantStep = async (ctx) => {
  await saveUserProfileToDynamoDB(ctx.env.tableName, ctx.userProfile!);
  return ctx;
};

const stepBuildSuccessResponse: TMerchantStep = async (ctx) => {
  const response = prepareSuccessResponse(
    ctx.signUpResponse!,
    ctx.input.userType as TUserType
  );
  return { ...ctx, response };
};

const merchantPipeline: TMerchantStep[] = [
  stepMakeUserAttributes,
  stepSignUpInCognito,
  stepAddToGroup,
  stepBuildUserProfile,
  stepSaveProfile,
  stepBuildSuccessResponse,
];

/**
 * Runs the merchant sign-up pipeline
 *
 * Executes each step in sequence, passing the context through
 *
 * @param initial - Initial context with env and input
 * @returns Final context with response
 */
async function runMerchantPipeline(
  initial: IMerchantContext
): Promise<IMerchantContext> {
  let ctx = initial;
  for (const step of merchantPipeline) {
    ctx = await step(ctx);
  }
  return ctx;
}
