/**
 * Merchants Microservice Stack
 *
 * Main CDK stack that orchestrates all infrastructure for the merchants microservice.
 * Creates and wires together all constructs in the correct dependency order.
 *
 * Architecture:
 * ```
 * ServiceStack
 * ├── SsmBindingsConstruct (reads external service configs)
 * ├── MonitorConstruct (CloudWatch alarms, SNS topics)
 * ├── DatabaseConstruct (DynamoDB table)
 * ├── AuthConstruct (Cognito User Pool, Identity Pool, Groups)
 * ├── IamConstruct (IAM roles for authenticated users)
 * ├── PermissionsConstruct (OAuth scopes, resource server) [optional]
 * ├── ApiConstruct (API Gateway, Lambda endpoints)
 * └── SsmPublicationsConstruct (publishes service configs to SSM)
 * ```
 *
 * Dependency Flow:
 * 1. SSM Bindings (no dependencies)
 * 2. Monitor (depends on SSM Bindings)
 * 3. Database (no dependencies)
 * 4. Auth (depends on SSM Bindings, Monitor)
 * 5. IAM (depends on Auth)
 * 6. Permissions (depends on IAM, Auth) [optional]
 * 7. API (depends on Auth, Database, Permissions)
 * 8. SSM Publications (depends on Auth, IAM)
 *
 * @module lib/service-stack
 */

import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import SsmBindingsConstruct from "./ssm-bindings/construct";
import MonitorConstruct from "./monitor/construct";
import DatabaseConstruct from "./db/construct";
import AuthConstruct from "./auth/construct";
import IamConstruct from "./iam/construct";
import {
  PermissionsConstruct,
  NoopPermissionsConstruct,
  type IPermissionsProvider,
} from "#lib/permissions/construct";
import ApiConstruct from "./api/construct";
// import EventsConstruct from "./events/construct";
import SsmPublicationsConstruct from "./ssm-publications/construct";
import type { IConfig } from "#config/default";

/**
 * Props for ServiceStack
 *
 * @property config - Application configuration object
 */
interface IServiceStackProps extends StackProps {
  readonly config: IConfig;
}

/**
 * Merchants Microservice Service Stack
 *
 * Creates all infrastructure for the merchants microservice including:
 * - Authentication (Cognito User Pool, Identity Pool)
 * - Database (DynamoDB table for user data)
 * - API (API Gateway with Lambda endpoints)
 * - Monitoring (CloudWatch alarms, SNS notifications)
 * - IAM (Roles for authenticated users)
 * - Permissions (OAuth scopes) [optional]
 * - Service Discovery (SSM parameter publications)
 *
 * The stack orchestrates construct creation in dependency order,
 * ensuring all resources are available when needed.
 *
 * @example
 * // Create service stack
 * const app = new App();
 * new ServiceStack(app, 'dev-svc-merchants-ServiceStack', {
 *   env: { account: '123456789012', region: 'us-east-1' },
 *   config: appConfig,
 *   description: 'Merchants Microservice Infrastructure (dev)',
 *   tags: { Environment: 'dev', Service: 'svc-merchants' }
 * });
 */
export class ServiceStack extends Stack {
  /**
   * Creates the service stack
   *
   * Orchestrates infrastructure creation in this order:
   * 1. SSM Bindings - Read external service configurations
   * 2. Monitor - CloudWatch alarms and SNS topics
   * 3. Database - DynamoDB tables for merchant data (Faux-SQL design)
   * 4. Auth - Cognito User Pool, Identity Pool, Groups
   * 5. IAM - Roles for authenticated users
   * 6. Permissions - OAuth scopes (if enabled)
   * 7. API - API Gateway with Lambda endpoints
   * 8. SSM Publications - Publish service configs for other services
   *
   * @param scope - CDK app or parent construct
   * @param id - Stack identifier
   * @param props - Stack properties including config
   */
  constructor(scope: Construct, id: string, props: IServiceStackProps) {
    super(scope, id, props);

    const { config } = props;

    // 1. SSM Bindings - Read external service configurations (e.g., website URL, monitoring webhook)
    const ssmBindings = new SsmBindingsConstruct(this, "SsmBindingsConstruct", {
      config,
    });

    // 2. Monitor - CloudWatch alarms and SNS topics for API errors and SES events
    const monitor = new MonitorConstruct(this, "MonitorConstruct", {
      config,
      ssmBindings,
    });

    // 3. Database - DynamoDB tables for merchant data (Faux-SQL design)
    const db = new DatabaseConstruct(this, "DatabaseConstruct", {
      config,
    });

    // 4. Auth - Cognito User Pool, Identity Pool, User Groups, Lambda triggers
    const auth = new AuthConstruct(this, "AuthConstruct", {
      config,
      ssmBindings,
      monitor,
    });

    // 5. IAM - Roles for authenticated users (merchant, customer)
    const iam = new IamConstruct(this, "IamConstruct", {
      auth,
    });

    // 6. Permissions - OAuth scopes and resource server (optional, feature-flagged)
    const permissions: IPermissionsProvider = config.features
      ?.permissionsEnabled
      ? new PermissionsConstruct(this, "PermissionsConstruct", {
          config,
          iam,
          auth,
        })
      : new NoopPermissionsConstruct();

    // 7. API - API Gateway with Lambda endpoints (user sign-up, bindings)
    new ApiConstruct(this, "ApiConstruct", {
      config,
      auth,
      db,
      permissions,
    });

    // SNS/EventBridge events (future feature)
    // new EventsConstruct(this, "EventsConstruct", {
    //   config,
    // });

    // 8. SSM Publications - Publish service configs for other services to consume
    new SsmPublicationsConstruct(this, "SsmPublicationsConstruct", {
      config,
      auth,
      iam,
    });
  }
}
