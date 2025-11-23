/**
 * Service Discovery Bindings Handler
 *
 * Provides a service discovery endpoint that returns configuration bindings
 * for client applications. This follows a layered architecture:
 *
 * Layer 1 (This file): HTTP response orchestration
 * - Fetches bindings from SSM or fallback
 * - Formats HTTP response with caching headers
 *
 * Layer 2 (helpers.ts): Data retrieval and transformation
 * - SSM parameter reading
 * - Fallback binding creation
 * - Environment variable access
 *
 * Layer 3 (AWS SDK): Infrastructure
 * - SSM client interactions
 *
 * The endpoint returns public service bindings that clients can use to
 * discover API URLs, storage buckets, and other service configuration.
 */

import { readPublicBindingsFromSSM, createFallbackBindings } from "./helpers";

/**
 * Handler for GET /.well-known/bindings
 *
 * Returns service discovery bindings from SSM Parameter Store,
 * falling back to environment variables if SSM is unavailable.
 *
 * Response is cached for 5 minutes (max-age=300) to reduce SSM calls.
 *
 * @returns API Gateway response with bindings in JSON format
 */
export const handler = async () => {
  // Try to read bindings from SSM Parameter Store
  const ssmBindings = await readPublicBindingsFromSSM();

  // Fall back to environment variables if SSM unavailable
  const fallback = createFallbackBindings();

  // Use SSM bindings if available, otherwise use fallback
  const body = ssmBindings ?? fallback;

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "max-age=300", // Cache for 5 minutes
    },
    body: JSON.stringify(body),
  };
};
