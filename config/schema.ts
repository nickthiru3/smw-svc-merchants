/**
 * Configuration Validation Schema
 *
 * Zod schemas for runtime validation of configuration.
 * Validates the merged configuration before use.
 *
 * @module config/schema
 */

import { z } from "zod";

/**
 * Zod schema for runtime validation of the final, merged config
 *
 * Validates:
 * - Required fields are present
 * - Types are correct
 * - Values meet constraints (e.g., URLs, non-empty strings)
 * - Environment-specific requirements (e.g., GitHub config for non-local)
 */
export const ConfigSchema = z
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
    api: z.object({
      restApi: z.any(),
      cors: z.any(),
      stages: z.array(z.any()),
      authorization: z.any(),
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
