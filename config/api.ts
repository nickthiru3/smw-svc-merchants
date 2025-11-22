/**
 * API Gateway Configuration
 *
 * Defines API Gateway REST API settings, CORS policies, deployment stages,
 * and authorization configurations.
 *
 * This configuration follows the same pattern as database.ts:
 * - Template-level settings (REST API, CORS, stages, authorization)
 * - Environment-specific overrides (CORS origins, throttling, logging)
 * - Story-specific endpoints remain in code (constructs)
 *
 * @module config/api
 */

import { z } from "zod";

/**
 * REST API endpoint type
 */
export type ApiEndpointType = "REGIONAL" | "EDGE" | "PRIVATE";

/**
 * API Gateway logging level
 */
export type ApiLoggingLevel = "OFF" | "ERROR" | "INFO";

/**
 * REST API configuration
 */
export interface IRestApiConfig {
  readonly name?: string; // Override default (service name)
  readonly description?: string; // Override default
  readonly endpointType: ApiEndpointType;
  readonly cloudWatchRole: boolean;
  readonly deploy: boolean; // Auto-deploy or manual stages
}

/**
 * CORS configuration
 */
export interface ICorsConfig {
  readonly allowOrigins: string[] | "*";
  readonly allowMethods: string[];
  readonly allowHeaders?: string[];
  readonly allowCredentials?: boolean;
  readonly maxAge?: number; // Seconds
}

/**
 * Stage throttling configuration
 */
export interface IThrottlingConfig {
  readonly rateLimit: number; // Requests per second
  readonly burstLimit: number; // Concurrent requests
}

/**
 * Stage logging configuration
 */
export interface ILoggingConfig {
  readonly dataTrace: boolean;
  readonly loggingLevel: ApiLoggingLevel;
}

/**
 * Stage caching configuration
 */
export interface ICachingConfig {
  readonly enabled: boolean;
  readonly ttl?: number; // Seconds
}

/**
 * Deployment stage configuration
 */
export interface IStageConfig {
  readonly name: string;
  readonly throttling?: IThrottlingConfig;
  readonly logging?: ILoggingConfig;
  readonly caching?: ICachingConfig;
}

/**
 * Cognito authorization configuration
 */
export interface ICognitoAuthConfig {
  readonly enabled: boolean;
  readonly identitySource?: string; // Default: 'method.request.header.Authorization'
}

/**
 * OAuth authorization configuration
 */
export interface IOAuthAuthConfig {
  readonly enabled: boolean;
}

/**
 * Authorization configuration
 */
export interface IAuthorizationConfig {
  readonly cognito: ICognitoAuthConfig;
  readonly oauth?: IOAuthAuthConfig;
}

/**
 * API Gateway configuration
 */
export interface IApiConfig {
  readonly restApi: IRestApiConfig;
  readonly cors: ICorsConfig;
  readonly stages: IStageConfig[];
  readonly authorization: IAuthorizationConfig;
}

/**
 * Zod schema for API configuration validation
 */
export const ApiConfigSchema = z.object({
  restApi: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    endpointType: z.enum(["REGIONAL", "EDGE", "PRIVATE"]),
    cloudWatchRole: z.boolean(),
    deploy: z.boolean(),
  }),
  cors: z.object({
    allowOrigins: z.union([z.array(z.string().url()), z.literal("*")]),
    allowMethods: z.array(z.string()),
    allowHeaders: z.array(z.string()).optional(),
    allowCredentials: z.boolean().optional(),
    maxAge: z.number().int().positive().optional(),
  }),
  stages: z
    .array(
      z.object({
        name: z.string().min(1),
        throttling: z
          .object({
            rateLimit: z.number().int().positive(),
            burstLimit: z.number().int().positive(),
          })
          .optional(),
        logging: z
          .object({
            dataTrace: z.boolean(),
            loggingLevel: z.enum(["OFF", "ERROR", "INFO"]),
          })
          .optional(),
        caching: z
          .object({
            enabled: z.boolean(),
            ttl: z.number().int().positive().optional(),
          })
          .optional(),
      })
    )
    .min(1),
  authorization: z.object({
    cognito: z.object({
      enabled: z.boolean(),
      identitySource: z.string().optional(),
    }),
    oauth: z
      .object({
        enabled: z.boolean(),
      })
      .optional(),
  }),
});

/**
 * API Gateway configuration for SMW Merchants microservice
 *
 * Template-level settings:
 * - REST API: Regional endpoint, CloudWatch role enabled, manual stages
 * - CORS: Environment-specific origins, all HTTP methods
 * - Stages: Single stage per environment (dev/staging/production)
 * - Authorization: Cognito User Pool authorizer
 *
 * Environment-specific overrides:
 * - Local/Dev: Allow all origins (*)
 * - Staging/Prod: Specific domain origins
 * - Throttling: Higher limits in production
 */
export const apiConfig: IApiConfig = {
  // REST API settings
  restApi: {
    // name: undefined, // Defaults to service name
    // description: undefined, // Defaults to "API Gateway for {service name}"
    endpointType: "REGIONAL",
    cloudWatchRole: true,
    deploy: false, // Use manual stages (no default 'prod' stage)
  },

  // CORS configuration (environment-specific)
  cors: {
    allowOrigins:
      process.env.ENV_NAME === "production"
        ? [
            process.env.WEBSITE_URL || "https://app.example.com",
            // Add more production origins as needed
          ]
        : "*", // Allow all origins in dev/staging
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date"],
    allowCredentials: true,
    maxAge: 300, // 5 minutes
  },

  // Stage configuration (one stage per environment)
  stages: [
    {
      name: process.env.ENV_NAME || "dev",
      throttling: {
        rateLimit:
          process.env.ENV_NAME === "production"
            ? 10000 // Higher limit for production
            : 1000, // Lower limit for dev/staging
        burstLimit:
          process.env.ENV_NAME === "production"
            ? 20000 // Higher burst for production
            : 2000, // Lower burst for dev/staging
      },
      logging: {
        dataTrace: process.env.ENV_NAME !== "production", // Disable in prod for performance
        loggingLevel: process.env.ENV_NAME === "production" ? "ERROR" : "INFO",
      },
      caching: {
        enabled: false, // Disable caching by default (enable per-endpoint if needed)
        // ttl: 300, // 5 minutes
      },
    },
  ],

  // Authorization configuration
  authorization: {
    cognito: {
      enabled: true,
      identitySource: "method.request.header.Authorization", // Default
    },
    oauth: {
      enabled: false, // Tied to features.permissionsEnabled in default.ts
    },
  },
};
