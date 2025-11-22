/**
 * Feature Toggles Configuration
 *
 * Feature flags for enabling/disabling functionality.
 *
 * @module config/features
 */

import { z } from "zod";
import type { IFeaturesConfig } from "./types";

/**
 * Zod schema for features configuration validation
 */
const FeaturesConfigSchema = z.object({
  permissionsEnabled: z.boolean(),
});

/**
 * Feature toggles
 *
 * Can be overridden via environment variables:
 * - PERMISSIONS_ENABLED: Enable OAuth permission scopes (default: false)
 */
const rawFeaturesConfig: IFeaturesConfig = {
  permissionsEnabled:
    process.env.PERMISSIONS_ENABLED === "true" ||
    process.env.PERMISSIONS_ENABLED === "1",
};

// Validate features config
const result = FeaturesConfigSchema.safeParse(rawFeaturesConfig);
if (!result.success) {
  throw new Error(
    `Invalid features configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
  );
}

export const featuresConfig: IFeaturesConfig = result.data;
