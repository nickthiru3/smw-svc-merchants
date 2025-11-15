/**
 * Default configuration values for all environments
 */

import { z } from "zod";
import localstackConfig from "./localstack";
import stagingConfig from "./staging";
import productionConfig from "./production";
import type { IDatabaseConfig } from "./database";
import { databaseConfig } from "./database";

export interface IConfig {
  envName: string;
  accountId: string;
  region: string;

  // Service metadata
  service: {
    name: string;
    displayName: string;
  };

  // Database configuration
  database: IDatabaseConfig;

  // GitHub and CodeStar configuration
  github?: {
    repo: string;
    branch: string;
    codestarConnectionId: string;
  };

  // AWS configuration
  aws?: {
    region: string;
    profile?: string;
  };

  // Service endpoints (for LocalStack override)
  endpoints?: {
    dynamodb?: string;
    s3?: string;
    lambda?: string;
    apigateway?: string;
    sns?: string;
    sqs?: string;
    cloudwatch?: string;
    logs?: string;
    iam?: string;
    sts?: string;
    cloudformation?: string;
  };

  // Resource naming configuration
  resources: {
    tablePrefix: string;
    bucketPrefix: string;
    functionPrefix: string;
    apiPrefix: string;
  };

  // Feature toggles
  features?: {
    permissionsEnabled: boolean;
  };

  // Development-specific settings
  development?: {
    enableDebugLogs?: boolean;
    lambdaTimeout?: number;
    enableHotReload?: boolean;
    skipValidations?: boolean;
  };

  // Legacy properties for backward compatibility
  gitHubRepo?: string;
  gitHubBranch?: string;
  codestarConnectionId?: string;
  parameterStorePrefix?: string;
}

// Zod schema for runtime validation of the final, merged config
const ConfigSchema = z
  .object({
    envName: z.string().min(1),
    accountId: z.string().min(1),
    region: z.string().min(1),
    service: z.object({
      name: z.string().min(1),
      displayName: z.string().min(1),
    }),
    database: z.object({
      approach: z.enum(["faux-sql", "single-table"]),
      fauxSql: z.object({
        tables: z.array(z.any()),
      }),
      singleTable: z.object({
        tableName: z.string().optional(),
      }),
    }),
    github: z
      .object({
        repo: z.string().min(1),
        branch: z.string().min(1),
        codestarConnectionId: z.string().min(1),
      })
      .optional(),
    aws: z
      .object({
        region: z.string().min(1),
        profile: z.string().min(1).optional(),
      })
      .optional(),
    endpoints: z
      .object({
        dynamodb: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        s3: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        lambda: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        apigateway: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        sns: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        sqs: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        cloudwatch: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        logs: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        iam: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        sts: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
        cloudformation: z
          .string()
          .regex(/^https?:\/\//, "Must be a valid http(s) URL")
          .optional(),
      })
      .optional(),
    resources: z.object({
      tablePrefix: z.string().min(1),
      bucketPrefix: z.string().min(1),
      functionPrefix: z.string().min(1),
      apiPrefix: z.string().min(1),
    }),
    features: z
      .object({
        permissionsEnabled: z.boolean(),
      })
      .optional(),
    development: z
      .object({
        enableDebugLogs: z.boolean().optional(),
        lambdaTimeout: z.number().int().positive().optional(),
        enableHotReload: z.boolean().optional(),
        skipValidations: z.boolean().optional(),
      })
      .optional(),
    // Legacy fields remain optional
    gitHubRepo: z.string().min(1).optional(),
    gitHubBranch: z.string().min(1).optional(),
    codestarConnectionId: z.string().min(1).optional(),
    parameterStorePrefix: z.string().min(1).optional(),
  })
  .refine((cfg) => cfg.envName === "local" || !!cfg.github?.repo, {
    path: ["github", "repo"],
    message: "github.repo is required for non-local environments",
  })
  .refine(
    (cfg) =>
      cfg.envName === "local" ||
      !!(cfg.github?.codestarConnectionId || cfg.codestarConnectionId),
    {
      path: ["github", "codestarConnectionId"],
      message:
        "github.codestarConnectionId (or legacy codestarConnectionId) is required for non-local environments",
    }
  );

/**
 * Get CodeStar connection ID with fallback hierarchy:
 * 1. Environment variable (for local development)
 * 2. Parameter Store lookup (for deployed environments)
 * 3. Error (no fallback to prevent deployment with placeholder)
 */
function getCodeStarConnectionId(envName: string): string {
  // First try environment variable (local development override)
  if (process.env.CODESTAR_CONNECTION_ID) {
    return process.env.CODESTAR_CONNECTION_ID;
  }

  // For deployed environments, we'll use Parameter Store lookup in the pipeline construct
  // This returns a token that will be resolved during deployment
  return `{{resolve:ssm:/platform/${envName}/github/codestar-connection-id}}`;
}

// Resolve env name once so we can tailor defaults based on it
const envName = process.env.ENV_NAME || "local";

const defaultConfig: IConfig = {
  envName,
  // Account and region are required for all environments in Three-Flow architecture
  accountId:
    process.env.AWS_ACCOUNT_ID ||
    process.env.CDK_DEFAULT_ACCOUNT ||
    (envName === "local"
      ? "000000000000"
      : (() => {
          throw new Error(
            "AWS account ID is required. Set AWS_ACCOUNT_ID (or CDK_DEFAULT_ACCOUNT) environment variable."
          );
        })()),
  region:
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.CDK_DEFAULT_REGION ||
    (envName === "local"
      ? "us-east-1"
      : (() => {
          throw new Error(
            "AWS region is required. Set AWS_REGION (or AWS_DEFAULT_REGION / CDK_DEFAULT_REGION) environment variable."
          );
        })()),

  // Service metadata
  service: {
    name: process.env.SERVICE_NAME || "svc-merchants",
    displayName:
      process.env.SERVICE_DISPLAY_NAME ||
      process.env.SERVICE_NAME ||
      "Merchants Microservice",
  },

  // Database configuration
  database: databaseConfig,

  // Feature toggles
  features: {
    permissionsEnabled: false,
  },

  // GitHub configuration (new structure)
  github:
    envName === "local"
      ? undefined
      : {
          repo:
            process.env.GITHUB_REPO ||
            (() => {
              throw new Error(
                "GitHub repository is required. Set GITHUB_REPO environment variable."
              );
            })(),
          branch: process.env.GITHUB_BRANCH || "release",
          codestarConnectionId: getCodeStarConnectionId(envName),
        },

  // AWS configuration
  aws: {
    region:
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      process.env.CDK_DEFAULT_REGION ||
      (envName === "local"
        ? "us-east-1"
        : (() => {
            throw new Error(
              "AWS region is required. Set AWS_REGION (or AWS_DEFAULT_REGION / CDK_DEFAULT_REGION) environment variable."
            );
          })()),
    profile: process.env.AWS_PROFILE,
  },

  // Resource naming defaults (derived from service name)
  resources: {
    tablePrefix:
      process.env.SERVICE_NAME ||
      (() => {
        throw new Error(
          "Service name is required to derive resource prefixes. Set SERVICE_NAME environment variable."
        );
      })(),
    bucketPrefix:
      process.env.SERVICE_NAME ||
      (() => {
        throw new Error(
          "Service name is required to derive resource prefixes. Set SERVICE_NAME environment variable."
        );
      })(),
    functionPrefix:
      process.env.SERVICE_NAME ||
      (() => {
        throw new Error(
          "Service name is required to derive resource prefixes. Set SERVICE_NAME environment variable."
        );
      })(),
    apiPrefix:
      process.env.SERVICE_NAME ||
      (() => {
        throw new Error(
          "Service name is required to derive resource prefixes. Set SERVICE_NAME environment variable."
        );
      })(),
  },

  // Legacy properties for backward compatibility
  gitHubRepo: envName === "local" ? undefined : process.env.GITHUB_REPO,
  gitHubBranch:
    envName === "local" ? undefined : process.env.GITHUB_BRANCH || "release",
  codestarConnectionId:
    envName === "local" ? undefined : getCodeStarConnectionId(envName),
  /**
   * Canonical SSM base path prefix for the organization/app (e.g. "/super-deals").
   * - Sourced from env APP_BASE_PATH at config load time to keep config the single source of truth.
   * - Helpers (e.g., src/helpers/ssm.ts) should reference this field, not process.env.APP_BASE_PATH directly.
   * - If unset, helpers may apply a sane default ("/super-deals") close to usage.
   */
  parameterStorePrefix: process.env.APP_BASE_PATH || undefined,
};

/**
 * Load environment-specific configuration
 * Supports: local, localstack, staging, production
 * Validates that required properties (account, region) are present
 */
function loadConfig(): IConfig {
  const envName = process.env.ENV_NAME || "local";

  let config: IConfig;

  try {
    // Try to load environment-specific config
    switch (envName) {
      case "localstack":
        config = { ...defaultConfig, ...localstackConfig };
        break;

      case "staging":
        config = { ...defaultConfig, ...stagingConfig };
        break;

      case "production":
        config = { ...defaultConfig, ...productionConfig };
        break;

      default:
        config = defaultConfig;
    }
  } catch (error) {
    console.warn(
      `Failed to load config for environment '${envName}', using default:`,
      error
    );
    config = defaultConfig;
  }

  // Validate required properties for Three-Flow architecture
  if (!config.accountId) {
    throw new Error(
      `AWS account ID is required for environment '${envName}'. Set AWS_ACCOUNT_ID environment variable.`
    );
  }

  if (!config.region) {
    throw new Error(
      `AWS region is required for environment '${envName}'. Set AWS_REGION environment variable.`
    );
  }

  // Zod validation for clearer, typed errors
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid configuration for env '${envName}':\n${formatted}`
    );
  }
  return result.data;
}

export default loadConfig();
