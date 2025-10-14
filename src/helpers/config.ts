/**
 * CDK Configuration Helpers
 *
 * Provides utility functions for creating CDK stack configuration objects
 * from the application config. These helpers standardize how environment,
 * tags, and descriptions are created across all stacks.
 *
 * @module helpers/config
 */

import type { IConfig } from "#config/default";

/**
 * Creates CDK environment object for stack deployment
 *
 * Determines AWS account and region based on environment name.
 * For local development, uses placeholder account ID.
 *
 * @param env - Environment name (local, dev, staging, production)
 * @param cfg - Application configuration object
 * @returns CDK environment object with account and region
 *
 * @example
 * // Local development
 * makeEnv("local", config)
 * // Returns: { account: "000000000000", region: "us-east-1" }
 *
 * @example
 * // Production deployment
 * makeEnv("production", config)
 * // Returns: { account: "123456789012", region: "us-east-1" }
 *
 * @remarks
 * Local environment uses placeholder account (000000000000) for CDK synthesis
 * without requiring AWS credentials.
 */
export const makeEnv = (env: string, cfg: IConfig) =>
  env === "local"
    ? { account: "000000000000", region: cfg.region || "us-east-1" }
    : { account: cfg.accountId, region: cfg.region };

/**
 * Creates standardized tags for CDK stacks
 *
 * Generates consistent tags across all stacks for resource organization,
 * cost allocation, and operational management.
 *
 * @param env - Environment name (local, dev, staging, production)
 * @param cfg - Application configuration object
 * @param stackType - Type of stack (service-only, pipeline-with-service, etc.)
 * @returns Tag object for CDK stack
 *
 * @example
 * makeTags("production", config, "service-only")
 * // Returns: {
 * //   Environment: "production",
 * //   Service: "users-ms",
 * //   ServiceDisplayName: "Users Microservice",
 * //   StackType: "service-only"
 * // }
 *
 * @remarks
 * Tags are used for:
 * - Cost allocation and tracking
 * - Resource filtering in AWS Console
 * - Operational dashboards and monitoring
 * - Compliance and governance
 */
export const makeTags = (env: string, cfg: IConfig, stackType: string) => ({
  Environment: env,
  Service: cfg.service?.name || "microservice",
  ServiceDisplayName:
    cfg.service?.displayName || cfg.service?.name || "Microservice",
  StackType: stackType,
});

/**
 * Creates standardized description for CDK stacks
 *
 * Generates human-readable stack description following consistent format.
 *
 * @param env - Environment name (local, dev, staging, production)
 * @param kind - Stack kind/purpose (Service Infrastructure, CI/CD Stack, etc.)
 * @returns Formatted stack description
 *
 * @example
 * makeDescription("production", "Service Infrastructure")
 * // Returns: "Microservice Service Infrastructure (production)"
 *
 * @example
 * makeDescription("dev", "CI/CD Stack")
 * // Returns: "Microservice CI/CD Stack (dev)"
 */
export const makeDescription = (env: string, kind: string) =>
  `Microservice ${kind} (${env})`;
