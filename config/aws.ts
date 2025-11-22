/**
 * AWS Configuration
 *
 * AWS-specific settings including region and profile.
 *
 * @module config/aws
 */

import { z } from "zod";
import type { IAwsConfig } from "./types";

/**
 * Zod schema for AWS configuration validation
 */
const AwsConfigSchema = z.object({
  region: z.string().min(1, "AWS region is required"),
  profile: z.string().optional(),
});

/**
 * Get AWS region from environment variables
 *
 * Checks multiple environment variables in order:
 * 1. AWS_REGION
 * 2. AWS_DEFAULT_REGION
 * 3. CDK_DEFAULT_REGION
 * 4. Defaults to us-east-1 for local, throws error for other environments
 *
 * @param envName - Environment name (local, dev, staging, production)
 * @returns AWS region
 */
function getAwsRegion(envName: string): string {
  const region =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.CDK_DEFAULT_REGION;

  if (region) {
    return region;
  }

  if (envName === "local") {
    return "us-east-1";
  }

  throw new Error(
    "AWS region is required. Set AWS_REGION (or AWS_DEFAULT_REGION / CDK_DEFAULT_REGION) environment variable."
  );
}

/**
 * AWS configuration
 *
 * Can be overridden via environment variables:
 * - AWS_REGION (or AWS_DEFAULT_REGION / CDK_DEFAULT_REGION): AWS region
 * - AWS_PROFILE: AWS CLI profile name (optional)
 */
export function createAwsConfig(envName: string): IAwsConfig {
  const rawConfig = {
    region: getAwsRegion(envName),
    profile: process.env.AWS_PROFILE,
  };

  // Validate AWS config
  const result = AwsConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new Error(
      `Invalid AWS configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  return result.data;
}
