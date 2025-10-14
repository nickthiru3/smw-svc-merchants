/**
 * SSM Parameter Publications
 *
 * Publishes service configuration to AWS Systems Manager Parameter Store
 * for service discovery by other services and clients.
 *
 * Published Parameters:
 * - Auth: User Pool ID, Client ID, Identity Pool ID
 * - IAM: Role ARNs for merchant and customer groups
 *
 * Path Structure:
 * `/super-deals/{env}/{service}/public/*`
 *
 * Example:
 * - `/super-deals/dev/users-ms/public/auth/userPoolId`
 * - `/super-deals/dev/users-ms/public/auth/userPoolClientId`
 * - `/super-deals/dev/users-ms/public/iam/merchantRoleArn`
 *
 * @module lib/ssm-publications/construct
 */

import { Construct } from "constructs";
import AuthBindingsConstruct from "./auth/construct";
import IamBindingsConstruct from "./iam/construct";
import AuthConstruct from "#lib/auth/construct";
import IamConstruct from "#lib/iam/construct";
import type { IConfig } from "#config/default";
import { buildSsmPublicPath } from "#src/helpers/ssm";

/**
 * Props for SsmPublicationsConstruct
 *
 * @property config - Application configuration
 * @property auth - Authentication construct (for pool IDs)
 * @property iam - IAM construct (for role ARNs)
 */
interface ISsmPublicationsConstructProps {
  readonly config: IConfig;
  readonly auth: AuthConstruct;
  readonly iam: IamConstruct;
}

/**
 * SSM Publications Construct
 *
 * Publishes service configuration to SSM Parameter Store for service discovery.
 * Other services and clients can read these parameters to discover:
 * - Authentication endpoints (User Pool, Identity Pool)
 * - IAM role ARNs for cross-service access
 *
 * Use Cases:
 * - Web app reads User Pool ID/Client ID for authentication
 * - Other microservices read role ARNs for cross-service calls
 * - Monitoring tools read service configuration
 *
 * @example
 * // Create SSM publications
 * new SsmPublicationsConstruct(this, 'SsmPublicationsConstruct', {
 *   config: appConfig,
 *   auth: authConstruct,
 *   iam: iamConstruct
 * });
 *
 * // Other services read parameters
 * const userPoolId = StringParameter.valueFromLookup(
 *   this,
 *   '/super-deals/dev/users-ms/public/auth/userPoolId'
 * );
 */
class SsmPublicationsConstruct extends Construct {
  /**
   * Creates the SSM publications construct
   *
   * Publishes:
   * 1. Auth parameters - User Pool ID, Client ID, Identity Pool ID
   * 2. IAM parameters - Role ARNs for merchant and customer groups
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(
    scope: Construct,
    id: string,
    props: ISsmPublicationsConstructProps
  ) {
    super(scope, id);

    const { config, auth, iam } = props;

    const envName = config.envName;
    const serviceName = config.service.name;

    // Build base path: /super-deals/{env}/{service}/public
    const basePath = buildSsmPublicPath(envName, serviceName);

    // Publish auth parameters (User Pool ID, Client ID, Identity Pool ID)
    new AuthBindingsConstruct(this, "AuthBindingsConstruct", {
      basePath,
      auth,
    });

    // Publish IAM parameters (Role ARNs for merchant/customer groups)
    new IamBindingsConstruct(this, "IamBindingsConstruct", {
      basePath,
      iam,
    });
  }
}

export default SsmPublicationsConstruct;
