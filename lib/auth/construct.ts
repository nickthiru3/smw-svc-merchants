/**
 * Authentication Infrastructure
 *
 * Orchestrates all authentication-related constructs:
 * - Cognito User Pool (user registration, authentication)
 * - Cognito Identity Pool (AWS credentials for authenticated users)
 * - User Groups (merchant, customer groups with roles)
 *
 * Architecture:
 * ```
 * AuthConstruct
 * ├── UserPoolConstruct
 * │   ├── User Pool (authentication)
 * │   ├── User Pool Client (app integration)
 * │   ├── Custom Message Lambda (verification emails)
 * │   └── Welcome Email Lambda (post-confirmation)
 * ├── IdentityPoolConstruct
 * │   └── Identity Pool (AWS credentials)
 * └── UserGroupsConstruct
 *     ├── Merchant Group
 *     └── Customer Group
 * ```
 *
 * @module lib/auth/construct
 */

import { Construct } from "constructs";
import UserPoolConstruct from "./user-pool/construct";
import IdentityPoolConstruct from "./identity-pool/construct";
import UserGroupsConstruct from "./user-groups/construct";
import MonitorConstruct from "#lib/monitor/construct";
import type { IConfig } from "#config/default";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

/**
 * Props for AuthConstruct
 *
 * @property config - Application configuration
 * @property ssmBindings - SSM bindings for external configs (website URL)
 * @property monitor - Monitoring construct for SES event tracking
 */
interface IAuthConstructProps {
  readonly config: IConfig;
  readonly ssmBindings: SsmBindingsConstruct;
  readonly monitor: MonitorConstruct;
}

/**
 * Authentication Construct
 *
 * Orchestrates Cognito User Pool, Identity Pool, and User Groups.
 * Provides complete authentication and authorization infrastructure.
 *
 * Components:
 * - **User Pool**: Handles user registration, sign-in, MFA, password policies
 * - **Identity Pool**: Provides AWS credentials for authenticated users
 * - **User Groups**: Organizes users into merchant/customer groups with IAM roles
 *
 * @example
 * // Create auth construct
 * const auth = new AuthConstruct(this, 'AuthConstruct', {
 *   config: appConfig,
 *   ssmBindings: ssmBindings,
 *   monitor: monitor
 * });
 *
 * // Use in API Gateway authorizer
 * const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
 *   cognitoUserPools: [auth.userPool.pool]
 * });
 */
class AuthConstruct extends Construct {
  /**
   * Cognito User Pool construct
   *
   * Public property to allow:
   * - API Gateway to create Cognito authorizers
   * - Lambda functions to access pool ID/client ID
   * - IAM roles to reference pool ARN
   */
  userPool: UserPoolConstruct;

  /**
   * Cognito Identity Pool construct
   *
   * Public property to allow:
   * - IAM roles to be attached to identity pool
   * - Other services to reference identity pool ID
   */
  identityPool: IdentityPoolConstruct;

  /**
   * Creates the authentication construct
   *
   * Orchestrates:
   * 1. User Pool - User registration and authentication
   * 2. Identity Pool - AWS credentials for authenticated users
   * 3. User Groups - Merchant and customer groups
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IAuthConstructProps) {
    super(scope, id);

    const { config, ssmBindings, monitor } = props;

    // 1. User Pool - Handles user registration, authentication, Lambda triggers
    this.userPool = new UserPoolConstruct(this, `UserPoolStack`, {
      config,
      ssmBindings,
      monitor,
    });

    // 2. Identity Pool - Provides AWS credentials for authenticated users
    this.identityPool = new IdentityPoolConstruct(this, `IdentityPoolStack`, {
      userPool: this.userPool,
    });

    // 3. User Groups - Merchant and customer groups with IAM roles
    new UserGroupsConstruct(this, `UserGroupsStack`, {
      userPool: this.userPool,
    });
  }
}

export default AuthConstruct;
