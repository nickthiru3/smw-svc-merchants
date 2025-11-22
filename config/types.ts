/**
 * Configuration Type Definitions
 *
 * Central location for all configuration interfaces.
 * Imported by domain-specific config files and default.ts.
 *
 * @module config/types
 */

import type { IDatabaseConfig } from "./database";
import type { IApiConfig } from "./api";

/**
 * Service metadata configuration
 */
export interface IServiceConfig {
  readonly name: string;
  readonly displayName: string;
}

/**
 * GitHub and CodeStar configuration for CI/CD
 */
export interface IGitHubConfig {
  readonly repo: string;
  readonly branch: string;
  readonly codestarConnectionId: string;
}

/**
 * AWS-specific configuration
 */
export interface IAwsConfig {
  readonly region: string;
  readonly profile?: string;
}

/**
 * AWS service endpoints (for LocalStack override)
 */
export interface IEndpointsConfig {
  readonly dynamodb?: string;
  readonly s3?: string;
  readonly lambda?: string;
  readonly apigateway?: string;
  readonly sns?: string;
  readonly sqs?: string;
  readonly cloudwatch?: string;
  readonly logs?: string;
  readonly iam?: string;
  readonly sts?: string;
  readonly cloudformation?: string;
}

/**
 * Resource naming configuration
 */
export interface IResourcesConfig {
  readonly tablePrefix: string;
  readonly bucketPrefix: string;
  readonly functionPrefix: string;
  readonly apiPrefix: string;
}

/**
 * Feature toggles
 */
export interface IFeaturesConfig {
  readonly permissionsEnabled: boolean;
}

/**
 * Development-specific settings
 */
export interface IDevelopmentConfig {
  readonly enableDebugLogs?: boolean;
  readonly lambdaTimeout?: number;
  readonly enableHotReload?: boolean;
  readonly skipValidations?: boolean;
}

/**
 * Main configuration interface
 *
 * Aggregates all domain-specific configurations.
 * This is the single source of truth for application configuration.
 */
export interface IConfig {
  // Environment metadata
  envName: string;
  accountId: string;
  region: string;

  // Domain-specific configurations
  service: IServiceConfig;
  database: IDatabaseConfig;
  api: IApiConfig;
  resources: IResourcesConfig;

  // Optional configurations
  github?: IGitHubConfig;
  aws?: IAwsConfig;
  endpoints?: IEndpointsConfig;
  features?: IFeaturesConfig;
  development?: IDevelopmentConfig;

  // Legacy properties (backward compatibility)
  gitHubRepo?: string;
  gitHubBranch?: string;
  codestarConnectionId?: string;
  parameterStorePrefix?: string;
}
