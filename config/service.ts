/**
 * Service Configuration
 *
 * Service metadata including name and display name.
 *
 * @module config/service
 */

import { z } from "zod";
import type { IServiceConfig } from "./types";

/**
 * Zod schema for service configuration validation
 */
const ServiceConfigSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  displayName: z.string().min(1, "Service display name is required"),
});

/**
 * Service metadata configuration
 *
 * Values can be overridden via environment variables:
 * - SERVICE_NAME: Technical service name (used in resource naming)
 * - SERVICE_DISPLAY_NAME: Human-readable service name
 */
const rawServiceConfig: IServiceConfig = {
  name: process.env.SERVICE_NAME || "svc-merchants",
  displayName:
    process.env.SERVICE_DISPLAY_NAME ||
    process.env.SERVICE_NAME ||
    "Merchants Microservice",
};

// Validate service config
const result = ServiceConfigSchema.safeParse(rawServiceConfig);
if (!result.success) {
  throw new Error(
    `Invalid service configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
  );
}

export const serviceConfig: IServiceConfig = result.data;
