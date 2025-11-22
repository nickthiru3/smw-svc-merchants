/**
 * API Gateway Infrastructure
 *
 * Creates and configures API Gateway REST API with:
 * - Regional endpoint
 * - Custom deployment stages
 * - Cognito User Pool authorization
 * - CORS configuration
 * - Lambda-backed endpoints
 *
 * Architecture:
 * ```
 * ApiConstruct
 * ├── RestApi (API Gateway)
 * ├── StageConstruct (dev/staging/production stages)
 * ├── AuthorizationConstruct (Cognito authorizer)
 * └── EndpointsConstruct (Lambda endpoints)
 *     ├── UsersConstruct (POST /users)
 *     └── BindingsConstruct (GET /.well-known/bindings)
 * ```
 *
 * @module lib/api/construct
 */

import { Construct } from "constructs";
import {
  RestApi,
  EndpointType,
  Cors,
  ResourceOptions,
} from "aws-cdk-lib/aws-apigateway";
import { Duration } from "aws-cdk-lib";
import StageConstruct from "./stage/construct";
import AuthorizationConstruct from "./authorization/construct";
import EndpointsConstruct from "./endpoints/construct";
import AuthConstruct from "#lib/auth/construct";
import DatabaseConstruct from "#lib/db/construct";
import type { IPermissionsProvider } from "#lib/permissions/construct";
import type { IConfig } from "#config/default";

/**
 * Props for ApiConstruct
 *
 * @property config - Application configuration
 * @property auth - Authentication construct (Cognito)
 * @property db - Database construct (DynamoDB)
 * @property permissions - Permissions provider (OAuth scopes)
 */
interface IApiConstructProps {
  readonly config: IConfig;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
  readonly permissions: IPermissionsProvider;
}

/**
 * CORS-only resource options
 *
 * Subset of ResourceOptions containing only CORS configuration.
 * Used for resources that don't require authorization.
 */
type TCorsOnlyResourceOptions = Pick<
  ResourceOptions,
  "defaultCorsPreflightOptions"
>;

/**
 * API properties passed to endpoint constructs
 *
 * Contains shared configuration that all endpoints need:
 * - RestApi instance for creating resources/methods
 * - CORS options for browser compatibility
 * - Authorization options for protected endpoints
 *
 * @property restApi - API Gateway RestApi instance
 * @property optionsWithCors - CORS preflight configuration
 * @property optionsWithAuth - Authorization configurations (Cognito, OAuth)
 */
export interface IApiProps {
  readonly restApi: RestApi;
  readonly optionsWithCors: TCorsOnlyResourceOptions;
  // Full set of authorization options from AuthorizationConstruct
  readonly optionsWithAuth: AuthorizationConstruct["authOptions"];
}

/**
 * API Gateway Construct
 *
 * Orchestrates API Gateway infrastructure including:
 * - REST API with regional endpoint
 * - Custom deployment stages (no default 'prod' stage)
 * - Cognito User Pool authorizer
 * - CORS configuration for all endpoints
 * - Lambda-backed endpoints (users, bindings)
 *
 * @example
 * // Create API construct
 * new ApiConstruct(this, 'ApiConstruct', {
 *   config: appConfig,
 *   auth: authConstruct,
 *   db: dbConstruct,
 *   permissions: permissionsConstruct
 * });
 */
class ApiConstruct extends Construct {
  /**
   * Creates the API Gateway construct
   *
   * Orchestrates:
   * 1. REST API creation
   * 2. Stage configuration
   * 3. Authorization setup
   * 4. CORS configuration
   * 5. Endpoint creation
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IApiConstructProps) {
    super(scope, id);

    const { config, auth, db, permissions } = props;

    const serviceName = config.service.name;
    const { restApi: restApiConfig, cors: corsConfig } = config.api;

    /*** API Gateway REST API ***/

    const restApi = new RestApi(this, "RestApi", {
      restApiName: restApiConfig.name || serviceName,
      description:
        restApiConfig.description || `API Gateway for ${serviceName}`,
      endpointTypes: [EndpointType[restApiConfig.endpointType]],
      deploy: restApiConfig.deploy,
      cloudWatchRole: restApiConfig.cloudWatchRole,
    });

    // Stages
    new StageConstruct(this, `StageConstruct`, {
      restApi,
      config,
    });

    /*** Authorization ***/
    const authorization = new AuthorizationConstruct(this, "Authorization", {
      restApi,
      auth,
      permissions,
      config,
    });

    /*** CORS ***/

    // Attach this to each root-level Resource
    const optionsWithCors: TCorsOnlyResourceOptions = {
      defaultCorsPreflightOptions: {
        allowOrigins:
          corsConfig.allowOrigins === "*"
            ? Cors.ALL_ORIGINS
            : corsConfig.allowOrigins,
        allowMethods:
          corsConfig.allowMethods.length > 0
            ? corsConfig.allowMethods.map((m) => m as any)
            : Cors.ALL_METHODS,
        allowHeaders: corsConfig.allowHeaders,
        allowCredentials: corsConfig.allowCredentials,
        maxAge: corsConfig.maxAge
          ? Duration.seconds(corsConfig.maxAge)
          : undefined,
      },
    };

    /*** Endpoints ***/

    const apiProps: IApiProps = {
      restApi,
      optionsWithCors,
      optionsWithAuth: authorization.authOptions,
    };

    new EndpointsConstruct(this, "EndpointsConstruct", {
      config,
      apiProps,
      db,
      auth,
    });
  }
}

export default ApiConstruct;
