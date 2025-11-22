/**
 * Business Logic and Helper Functions for GET /merchants/search
 *
 * Layer 2: Business logic and transformations
 * - Input validation
 * - Data access layer integration
 * - Response formatting
 * - Error handling
 *
 * Design Artifacts:
 * - Actions & Queries: Query execution and response formatting
 * - Story Card: Business rules implementation
 *
 * @see docs/implementation/adding-endpoints-part-1-lambda-handlers.md - Helper patterns
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import { apiError, apiSuccess } from "#src/helpers/api";
import type { TApiResponse } from "#src/helpers/api";
import { getDocumentClient } from "#src/helpers/ddb";
import { searchMerchantsByCategory } from "#src/data-access/merchants";
import { PrimaryCategory } from "#src/types/merchant";
import type {
  ISearchMerchantsQueryParams,
  ISearchMerchantsResponse,
} from "./types";
import { queryParamsSchema } from "./payload.schema";

/**
 * Parse and validate query parameters
 *
 * Validates category parameter using Zod schema.
 * Returns typed result with either valid data or error response.
 *
 * @param event - API Gateway event
 * @returns Success with parsed data or error response
 */
export function parseAndValidateQueryParams(
  event: APIGatewayProxyEvent
):
  | { readonly ok: true; readonly data: ISearchMerchantsQueryParams }
  | { readonly ok: false; readonly response: TApiResponse } {
  try {
    const params = queryParamsSchema.parse(event.queryStringParameters);
    return { ok: true, data: params };
  } catch (error) {
    return {
      ok: false,
      response: apiError(400, "Invalid query parameters", {
        code: "INVALID_CATEGORY",
        message: "Category must be one of: Repair, Refill, Recycling, Donate",
        details: error,
      }),
    };
  }
}

/**
 * Get required environment variables
 *
 * Validates that required environment variables are set.
 * Table name is injected by CDK Lambda construct.
 *
 * @returns Success with env vars or error response
 */
export function getRequiredEnv():
  | { readonly ok: true; readonly data: { readonly tableName: string } }
  | { readonly ok: false; readonly response: TApiResponse } {
  const tableName = process.env.MERCHANTS_TABLE_NAME;

  if (!tableName) {
    return {
      ok: false,
      response: apiError(500, "Internal server error", {
        code: "CONFIG_ERROR",
        message: "MERCHANTS_TABLE_NAME environment variable not configured",
      }),
    };
  }

  return { ok: true, data: { tableName } };
}

/**
 * Query merchants by category
 *
 * Uses data access layer to query merchants from DynamoDB.
 * Returns all merchants in the specified category.
 *
 * Note: Client performs distance filtering after receiving results.
 *
 * @param category - Primary category to filter by
 * @returns Search result with merchants array
 *
 * @throws Error if database query fails
 */
export async function queryMerchants(
  category: PrimaryCategory
): Promise<ISearchMerchantsResponse> {
  const client = getDocumentClient();

  // Use data access layer
  const result = await searchMerchantsByCategory(client, category);

  return {
    merchants: result.merchants,
    count: result.count,
    category: result.category,
  };
}

/**
 * Prepare success response
 *
 * Formats successful query result as API response.
 *
 * @param data - Search result data
 * @returns API Gateway response (200 OK)
 */
export function prepareSuccessResponse(
  data: ISearchMerchantsResponse
): TApiResponse {
  return apiSuccess(data, 200);
}

/**
 * Prepare error response
 *
 * Formats error as API response with appropriate status code.
 * Logs error for CloudWatch monitoring.
 *
 * @param error - Error object
 * @param requestId - Request ID for tracing
 * @returns API Gateway response (500 Internal Server Error)
 */
export function prepareErrorResponse(
  error: unknown,
  requestId?: string
): TApiResponse {
  console.error(
    JSON.stringify({
      level: "ERROR",
      message: "Failed to search merchants",
      error: {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      requestId,
    })
  );

  return apiError(500, "Internal server error", {
    code: "QUERY_FAILED",
    message: "Failed to retrieve merchants",
  });
}

/**
 * Log event received
 *
 * Logs incoming request with metadata for CloudWatch.
 * Sanitizes sensitive data before logging.
 *
 * @param event - API Gateway event
 */
export function logEventReceived(event: APIGatewayProxyEvent): void {
  console.log(
    JSON.stringify({
      level: "INFO",
      message: "Request received",
      requestId: event.requestContext.requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      // Don't log full event in production (too verbose, potential PII)
    })
  );
}

/**
 * Log successful query
 *
 * Logs query success with metrics for monitoring.
 *
 * @param category - Category queried
 * @param count - Number of results
 * @param requestId - Request ID for tracing
 * @param duration - Query duration in milliseconds
 */
export function logQuerySuccess(
  category: string,
  count: number,
  requestId: string,
  duration: number
): void {
  console.log(
    JSON.stringify({
      level: "INFO",
      message: "Query executed successfully",
      requestId,
      category,
      resultCount: count,
      duration,
    })
  );
}
