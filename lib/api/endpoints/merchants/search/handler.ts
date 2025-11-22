/**
 * GET /merchants/search Handler
 *
 * Query merchants by waste category.
 *
 * Layer 1 (This file): Business flow orchestration
 * - Coordinates the query process
 * - Validates input
 * - Handles top-level error catching
 * - Returns formatted response
 *
 * Layer 2 (helpers.ts): Business logic
 * - Query execution
 * - Data transformations
 * - Response formatting
 *
 * Layer 3 (Data Access): Infrastructure
 * - DynamoDB queries via data access layer
 *
 * Design Artifacts:
 * - Actions & Queries: Query 1: Search Merchants by Category
 * - Story Card: Business rules and validation
 * - Entity: Access pattern implementation
 *
 * @see docs/implementation/adding-endpoints-part-1-lambda-handlers.md - Handler patterns
 */

import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import type { TApiResponse } from "#src/helpers/api";
import {
  parseAndValidateQueryParams,
  getRequiredEnv,
  queryMerchants,
  prepareSuccessResponse,
  prepareErrorResponse,
  logEventReceived,
  logQuerySuccess,
} from "./helpers";

/**
 * Handler for GET /merchants/search
 *
 * Flow:
 * 1. Log incoming request
 * 2. Validate query parameters (category)
 * 3. Verify environment configuration
 * 4. Query merchants by category
 * 5. Format and return response
 *
 * Error Handling:
 * - 400: Invalid category parameter
 * - 500: Configuration error or database error
 *
 * @param event - API Gateway proxy event
 * @param context - Lambda context
 * @returns API Gateway proxy response
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<TApiResponse> => {
  const startTime = Date.now();
  const requestId = event.requestContext.requestId;

  // Log incoming request
  logEventReceived(event);

  // Parse and validate query parameters
  const paramsResult = parseAndValidateQueryParams(event);
  if (!paramsResult.ok) {
    return paramsResult.response;
  }
  const { category } = paramsResult.data;

  // Verify environment configuration
  const envResult = getRequiredEnv();
  if (!envResult.ok) {
    return envResult.response;
  }

  try {
    // Query merchants by category
    const result = await queryMerchants(category);

    // Log success metrics
    const duration = Date.now() - startTime;
    logQuerySuccess(category, result.count, requestId, duration);

    // Return success response
    return prepareSuccessResponse(result);
  } catch (error) {
    // Handle unexpected errors
    return prepareErrorResponse(error, requestId);
  }
};
