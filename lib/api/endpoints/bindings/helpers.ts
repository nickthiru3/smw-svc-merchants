/**
 * Helper functions for service discovery bindings endpoint
 *
 * This module follows a layered architecture approach:
 * - Top layer (handler.ts): High-level orchestration
 * - Middle layer (this file): Reusable utility functions
 * - Bottom layer (AWS SDK): Infrastructure interactions
 *
 * Benefits of this separation:
 * - Functions can be tested in isolation
 * - Clear separation between business logic and infrastructure
 * - Easier to mock AWS services in tests
 */

import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import type { IServiceBindings } from "./types";

const ssm = new SSMClient({});

/**
 * Retrieves an environment variable value with optional fallback
 *
 * Safe accessor for environment variables that handles undefined values
 * gracefully. Returns the environment variable value, fallback value,
 * or empty string in that order of precedence.
 *
 * @param name - Environment variable name
 * @param fallback - Optional fallback value if env var is not set
 * @returns Environment variable value, fallback, or empty string
 *
 * @example
 * // Get required environment variable
 * const region = env("AWS_REGION");
 * // Returns: "us-east-1" or "" if not set
 *
 * @example
 * // Get with fallback
 * const serviceName = env("SERVICE_NAME", "users-ms");
 * // Returns: process.env.SERVICE_NAME or "users-ms" if not set
 *
 * @remarks
 * This is a convenience wrapper around process.env that:
 * - Handles undefined values safely
 * - Provides fallback mechanism
 * - Always returns a string (never undefined)
 */
export function env(name: string, fallback?: string): string {
  return process.env[name] ?? fallback ?? "";
}

/**
 * Reads public service bindings from AWS Systems Manager Parameter Store
 *
 * Retrieves all parameters under the SSM_PUBLIC_PATH and transforms them
 * into a flat key-value object. The path prefix is stripped from parameter
 * names to create relative keys.
 *
 * This function is the primary source for service discovery bindings,
 * with fallback to environment variables if SSM is unavailable.
 *
 * @returns Object with parameter bindings, or null if path not configured or error occurs
 *
 * @example
 * // With SSM_PUBLIC_PATH = "/super-deals/dev/users-ms/public"
 * const bindings = await readPublicBindingsFromSSM();
 * // Returns: {
 * //   "auth/userPoolId": "us-east-1_ABC123",
 * //   "auth/userPoolClientId": "xyz789",
 * //   "api/baseUrl": "https://api.example.com"
 * // }
 *
 * @example
 * // When SSM_PUBLIC_PATH not set
 * const bindings = await readPublicBindingsFromSSM();
 * // Returns: null
 *
 * @remarks
 * Path transformation:
 * - Parameter: `/super-deals/dev/users/public/auth/userPoolId`
 * - SSM_PUBLIC_PATH: `/super-deals/dev/users/public`
 * - Result key: `auth/userPoolId`
 *
 * Error handling:
 * - Returns null if SSM_PUBLIC_PATH not set
 * - Returns null on SSM errors (permissions, network, etc.)
 * - Logs errors to console for debugging
 * - Skips parameters without Name or Value
 *
 * @see {@link createFallbackBindings} for fallback when SSM unavailable
 */
export async function readPublicBindingsFromSSM(): Promise<Record<
  string,
  any
> | null> {
  const path = env("SSM_PUBLIC_PATH");
  if (!path) return null;

  try {
    const out = await ssm.send(
      new GetParametersByPathCommand({
        Path: path,
        WithDecryption: false,
        Recursive: true,
      })
    );

    const result: Record<string, any> = {};
    for (const p of out.Parameters ?? []) {
      if (!p.Name || typeof p.Value === "undefined") continue;
      // Strip the base path and leading slash to create relative key
      const key = p.Name.replace(path, "").replace(/^\//, "");
      result[key] = p.Value;
    }

    return result;
  } catch (error) {
    // Silently return null on error - fallback will be used
    console.error("Error reading SSM bindings:", error);
    return null;
  }
}

/**
 * Creates fallback bindings from environment variables
 *
 * Used when SSM parameters are not available or fail to load.
 * Provides basic service discovery information from Lambda environment
 * variables set by CDK at deployment time.
 *
 * This ensures the bindings endpoint always returns valid data,
 * even if SSM is unavailable or misconfigured.
 *
 * @returns Fallback bindings object with service discovery information
 *
 * @example
 * // When SSM unavailable, use fallback
 * const ssmBindings = await readPublicBindingsFromSSM();
 * const bindings = ssmBindings ?? createFallbackBindings();
 * // Returns: {
 * //   service: "users-ms",
 * //   env: "dev",
 * //   region: "us-east-1",
 * //   api: { baseUrl: "https://api.example.com" },
 * //   storage: { bucket: "my-bucket", region: "us-east-1" }
 * // }
 *
 * @remarks
 * Environment variables used:
 * - SERVICE_NAME (default: "users-ms")
 * - ENV_NAME
 * - AWS_REGION or REGION
 * - API_BASE_URL
 * - S3_BUCKET_NAME
 *
 * All values are optional and will be empty strings if not set.
 * This prevents the endpoint from failing when environment variables
 * are missing.
 *
 * @see {@link readPublicBindingsFromSSM} for primary SSM-based bindings
 * @see {@link IServiceBindings} for binding structure
 */
export function createFallbackBindings(): IServiceBindings {
  return {
    service: env("SERVICE_NAME", "users-ms"),
    env: env("ENV_NAME"),
    region: env("AWS_REGION") || env("REGION"),
    api: {
      baseUrl: env("API_BASE_URL"),
    },
    storage: {
      bucket: env("S3_BUCKET_NAME"),
      region: env("AWS_REGION") || env("REGION"),
    },
  };
}
