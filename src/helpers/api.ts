/**
 * API Response Helpers
 *
 * Provides standardized response formatting for AWS Lambda functions
 * integrated with API Gateway. All responses include CORS headers for
 * browser compatibility.
 *
 * @module helpers/api
 */

/**
 * API Gateway proxy response structure
 *
 * @property statusCode - HTTP status code (200, 201, 400, 500, etc.)
 * @property headers - HTTP response headers (includes CORS)
 * @property body - JSON-stringified response body
 */
export type TApiResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

/**
 * Creates CORS headers for API Gateway responses
 *
 * Configures permissive CORS policy for development and testing.
 * In production, consider restricting Access-Control-Allow-Origin
 * to specific domains.
 *
 * @returns Headers object with CORS configuration
 *
 * @internal This is a private helper function
 */
function addCorsHeader(): Record<string, string> {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Content-Type": "application/json",
  };
}

/**
 * Creates a successful API Gateway response
 *
 * Formats data as JSON and includes CORS headers. Use this for all
 * successful Lambda responses to ensure consistent formatting.
 *
 * @template T - Type of the response data
 * @param data - Response data to be JSON-stringified
 * @param statusCode - HTTP status code (default: 200)
 * @returns API Gateway proxy response object
 *
 * @example
 * // Simple success response
 * return apiSuccess({ message: "User created" }, 201);
 *
 * @example
 * // Response with typed data
 * interface User { id: string; name: string; }
 * const user: User = { id: "123", name: "John" };
 * return apiSuccess<User>(user);
 *
 * @see {@link apiError} for error responses
 */
export function apiSuccess<T>(data: T, statusCode: number = 200): TApiResponse {
  const headers = addCorsHeader();
  const response: TApiResponse = {
    statusCode,
    headers,
    body: JSON.stringify(data),
  };
  return response;
}

/**
 * Creates an error API Gateway response
 *
 * Formats error message and optional details as JSON with CORS headers.
 * Logs the error response for debugging. Use this for all error responses
 * to ensure consistent error formatting.
 *
 * @param statusCode - HTTP error status code (400, 404, 500, etc.)
 * @param message - Human-readable error message
 * @param details - Optional additional error details (stack trace, validation errors, etc.)
 * @returns API Gateway proxy response object with error structure
 *
 * @example
 * // Simple error response
 * return apiError(404, "User not found");
 *
 * @example
 * // Error with details
 * return apiError(400, "Validation failed", {
 *   field: "email",
 *   reason: "Invalid format"
 * });
 *
 * @example
 * // Error from caught exception
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   return apiError(500, "Operation failed", serializeErr(err));
 * }
 *
 * @see {@link apiSuccess} for success responses
 * @see {@link serializeErr} for error serialization
 */
export function apiError(
  statusCode: number,
  message: string,
  details?: unknown
): TApiResponse {
  const headers = addCorsHeader();
  const body: { error: string; details?: unknown } = { error: message };
  if (details !== undefined) {
    body.details = details;
  }
  const response: TApiResponse = {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
  console.log(`Error Response: ${JSON.stringify(response, null, 2)}`);
  return response;
}

/**
 * Serializes unknown errors into JSON-safe objects
 *
 * Converts error objects (including AWS SDK errors) into a shallow,
 * JSON-serializable format suitable for API responses. Extracts only
 * safe properties to avoid exposing sensitive information like stack traces.
 *
 * @param err - Error object of unknown type
 * @returns JSON-serializable object with error properties
 *
 * @example
 * // Serialize standard Error
 * try {
 *   throw new Error("Something went wrong");
 * } catch (err) {
 *   const serialized = serializeErr(err);
 *   // { name: "Error", message: "Something went wrong" }
 * }
 *
 * @example
 * // Serialize AWS SDK error
 * try {
 *   await dynamodb.getItem(params);
 * } catch (err) {
 *   const serialized = serializeErr(err);
 *   // { name: "ResourceNotFoundException", message: "...", code: "...", $metadata: {...} }
 * }
 *
 * @remarks
 * Only extracts safe properties (name, message, code, $metadata).
 * Stack traces are intentionally excluded to avoid exposing internal details.
 *
 * @see {@link apiError} for using serialized errors in responses
 */
export function serializeErr(err: unknown): Record<string, unknown> {
  const e = err as any;
  const out: Record<string, unknown> = {};
  if (e?.name) out.name = e.name;
  if (e?.message) out.message = e.message;
  if (e?.code) out.code = e.code;
  if (e?.$metadata) out.$metadata = e.$metadata;
  // Avoid logging full stack traces to API consumers; keep minimal
  return out;
}
