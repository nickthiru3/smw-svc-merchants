/**
 * Resource Naming Configuration
 *
 * Defines prefixes for AWS resource names (tables, buckets, functions, APIs).
 * Derived from service name by default.
 *
 * @module config/resources
 */

import { z } from "zod";
import type { IResourcesConfig } from "./types";

/**
 * Zod schema for resources configuration validation
 */
const ResourcesConfigSchema = z.object({
  tablePrefix: z.string().min(1, "Table prefix is required"),
  bucketPrefix: z.string().min(1, "Bucket prefix is required"),
  functionPrefix: z.string().min(1, "Function prefix is required"),
  apiPrefix: z.string().min(1, "API prefix is required"),
});

/**
 * Get service name for resource prefixes
 *
 * Throws error if SERVICE_NAME is not set (required for resource naming).
 */
function getServiceName(): string {
  const serviceName = process.env.SERVICE_NAME;
  if (!serviceName) {
    throw new Error(
      "Service name is required to derive resource prefixes. Set SERVICE_NAME environment variable."
    );
  }
  return serviceName;
}

/**
 * Resource naming configuration
 *
 * All prefixes default to the service name.
 * Can be overridden via environment variables:
 * - TABLE_PREFIX
 * - BUCKET_PREFIX
 * - FUNCTION_PREFIX
 * - API_PREFIX
 */
const rawResourcesConfig: IResourcesConfig = {
  tablePrefix: process.env.TABLE_PREFIX || getServiceName(),
  bucketPrefix: process.env.BUCKET_PREFIX || getServiceName(),
  functionPrefix: process.env.FUNCTION_PREFIX || getServiceName(),
  apiPrefix: process.env.API_PREFIX || getServiceName(),
};

// Validate resources config
const result = ResourcesConfigSchema.safeParse(rawResourcesConfig);
if (!result.success) {
  throw new Error(
    `Invalid resources configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
  );
}

export const resourcesConfig: IResourcesConfig = result.data;
