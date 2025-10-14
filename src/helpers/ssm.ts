/**
 * AWS Systems Manager Parameter Store Helpers
 *
 * Provides utilities for reading and publishing SSM parameters in CDK constructs.
 * Supports both standard and secure (encrypted) parameters with consistent
 * path naming conventions.
 *
 * Path Structure:
 * - `/super-deals/{env}/{service}/public/*` - Public parameters (API URLs, etc.)
 * - `/super-deals/{env}/{service}/private/*` - Private parameters (secrets, keys)
 *
 * @module helpers/ssm
 */

import { SecretValue } from "aws-cdk-lib";
import { StringParameter, ParameterTier } from "aws-cdk-lib/aws-ssm";
import type { CfnParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import config from "#config/default";

/**
 * SSM parameter visibility level
 *
 * - `public`: Accessible parameters (API URLs, pool IDs, etc.)
 * - `private`: Sensitive parameters (secrets, API keys, etc.)
 */
export type TSsmVisibility = "public" | "private";

/**
 * Resolves the application base path for SSM parameters
 *
 * Uses config.parameterStorePrefix as single source of truth,
 * falling back to "/super-deals" if not configured.
 *
 * @returns Base path for all SSM parameters (e.g., "/super-deals")
 *
 * @internal This is a private helper function
 */
function resolveAppBasePath(): string {
  // Single source of truth: config.parameterStorePrefix (set from env in config/default.ts)
  return config.parameterStorePrefix || "/super-deals";
}

/**
 * Resolves the service name for SSM parameter paths
 *
 * Uses provided name if given, otherwise falls back to config.service.name.
 *
 * @param provided - Optional service name override
 * @returns Service name (e.g., "users-ms", "deals-ms")
 *
 * @internal This is a private helper function
 */
function resolveServiceName(provided?: string): string {
  return provided || config.service.name;
}

/**
 * Builds SSM parameter path following naming convention
 *
 * Creates hierarchical path: `/{appBase}/{env}/{service}/{visibility}`
 * Normalizes path to avoid duplicate slashes.
 *
 * @param envName - Environment name (dev, staging, production)
 * @param visibility - Parameter visibility (public or private)
 * @param serviceName - Optional service name override
 * @returns Normalized SSM parameter path
 *
 * @example
 * buildSsmPath("dev", "public", "users-ms")
 * // Returns: "/super-deals/dev/users-ms/public"
 *
 * @internal This is a private helper function
 */
function buildSsmPath(
  envName: string,
  visibility: TSsmVisibility,
  serviceName?: string
): string {
  const appBasePath = resolveAppBasePath();
  const svc = resolveServiceName(serviceName);
  // Normalize to avoid accidental duplicate slashes
  return `${appBasePath}/${envName}/${svc}/${visibility}`.replace(/\/+/, "/");
}

/**
 * Builds SSM path for public parameters
 *
 * Creates path for publicly accessible parameters like API URLs,
 * Cognito Pool IDs, and other non-sensitive configuration.
 *
 * @param envName - Environment name (dev, staging, production)
 * @param serviceName - Optional service name override (defaults to config.service.name)
 * @returns Public SSM parameter path
 *
 * @example
 * buildSsmPublicPath("dev")
 * // Returns: "/super-deals/dev/users-ms/public"
 *
 * @example
 * buildSsmPublicPath("production", "deals-ms")
 * // Returns: "/super-deals/production/deals-ms/public"
 *
 * @see {@link buildSsmPrivatePath} for private parameters
 */
export function buildSsmPublicPath(
  envName: string,
  serviceName?: string
): string {
  return buildSsmPath(envName, "public", serviceName);
}

/**
 * Builds SSM path for private (sensitive) parameters
 *
 * Creates path for sensitive parameters like API keys, secrets,
 * and other confidential configuration that should be encrypted.
 *
 * @param envName - Environment name (dev, staging, production)
 * @param serviceName - Optional service name override (defaults to config.service.name)
 * @returns Private SSM parameter path
 *
 * @example
 * buildSsmPrivatePath("dev")
 * // Returns: "/super-deals/dev/users-ms/private"
 *
 * @example
 * buildSsmPrivatePath("production", "deals-ms")
 * // Returns: "/super-deals/production/deals-ms/private"
 *
 * @see {@link buildSsmPublicPath} for public parameters
 */
export function buildSsmPrivatePath(
  envName: string,
  serviceName?: string
): string {
  return buildSsmPath(envName, "private", serviceName);
}

/**
 * Reads a standard SSM parameter value in CDK
 *
 * Creates a CDK reference to an existing SSM parameter. The value is
 * resolved at deployment time. Use this for reading standard (non-encrypted)
 * parameters.
 *
 * @param scope - CDK construct scope
 * @param parameterName - Full SSM parameter name (e.g., "/super-deals/dev/users-ms/public/apiUrl")
 * @returns Parameter value as CDK token (resolved at deployment)
 *
 * @example
 * // Read API URL from SSM
 * const apiUrl = readParam(this, "/super-deals/dev/users-ms/public/apiUrl");
 * // Use in Lambda environment variable
 * new NodejsFunction(this, 'Function', {
 *   environment: { API_URL: apiUrl }
 * });
 *
 * @see {@link readSecureParam} for encrypted parameters
 * @see {@link readBindings} for reading multiple parameters
 */
export function readParam(scope: Construct, parameterName: string): string {
  // Create a stable ID from the parameter name
  const id = `SsmParam-${parameterName.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return StringParameter.fromStringParameterName(scope, id, parameterName)
    .stringValue;
}

/**
 * Reads an encrypted (SecureString) SSM parameter in CDK
 *
 * Creates a CDK reference to an encrypted SSM parameter. The value is
 * resolved at deployment time and remains encrypted in CloudFormation.
 * Use this for reading sensitive parameters like API keys and secrets.
 *
 * @param _scope - CDK construct scope (unused but kept for API consistency)
 * @param parameterName - Full SSM parameter name (e.g., "/super-deals/dev/users-ms/private/apiKey")
 * @returns Encrypted parameter value as CDK token (resolved at deployment)
 *
 * @example
 * // Read API key from encrypted SSM parameter
 * const apiKey = readSecureParam(this, "/super-deals/dev/users-ms/private/apiKey");
 * // Use in Lambda environment variable (remains encrypted in CFN)
 * new NodejsFunction(this, 'Function', {
 *   environment: { API_KEY: apiKey }
 * });
 *
 * @remarks
 * The parameter must be created as a SecureString type in SSM.
 * Uses dynamic reference to always fetch the latest version.
 *
 * @see {@link readParam} for standard parameters
 * @see {@link readSecureBindings} for reading multiple secure parameters
 */
export function readSecureParam(
  _scope: Construct,
  parameterName: string
): string {
  return SecretValue.ssmSecure(parameterName).unsafeUnwrap();
}

/**
 * Publishes multiple standard SSM parameters from a key-value map
 *
 * Creates SSM parameters for each entry in the values object.
 * Parameters are created as STANDARD tier (non-encrypted) strings.
 * Keys are appended to basePath to form the full parameter name.
 *
 * @param scope - CDK construct scope
 * @param basePath - Base path for all parameters (e.g., "/super-deals/dev/users-ms/public")
 * @param values - Key-value pairs to publish as parameters
 *
 * @example
 * // Publish public service configuration
 * publishStringParameters(this, "/super-deals/dev/users-ms/public", {
 *   apiUrl: "https://api.example.com",
 *   userPoolId: "us-east-1_ABC123",
 *   region: "us-east-1"
 * });
 * // Creates:
 * // - /super-deals/dev/users-ms/public/apiUrl = "https://api.example.com"
 * // - /super-deals/dev/users-ms/public/userPoolId = "us-east-1_ABC123"
 * // - /super-deals/dev/users-ms/public/region = "us-east-1"
 *
 * @remarks
 * - Keys are sanitized to create valid CDK construct IDs
 * - Empty values are stored as empty strings
 * - Parameters use STANDARD tier (not encrypted)
 *
 * @see {@link publishSecureStringParameters} for encrypted parameters
 */
export function publishStringParameters(
  scope: Construct,
  basePath: string,
  values: Record<string, string>
): void {
  Object.entries(values).forEach(([key, value]) => {
    const safeKey = key.replace(/[^A-Za-z0-9]/g, "_");
    const name = `${basePath}/${key}`.replace(/\/+/, "/");
    new StringParameter(scope, `Param_${safeKey}`, {
      parameterName: name,
      stringValue: value ?? "",
      tier: ParameterTier.STANDARD,
    });
  });
}

/**
 * Options for publishing secure (encrypted) SSM parameters
 *
 * @property encryptionKeyArn - Optional KMS key ARN for encryption (uses AWS managed key if not provided)
 */
export interface IPublishSecureStringParametersOptions {
  readonly encryptionKeyArn?: string;
}

/**
 * Publishes multiple encrypted (SecureString) SSM parameters from a key-value map
 *
 * Creates encrypted SSM parameters for each entry in the values object.
 * Parameters are created as SecureString type with optional KMS encryption.
 * Uses CloudFormation property overrides to set SecureString type.
 *
 * @param scope - CDK construct scope
 * @param basePath - Base path for all parameters (e.g., "/super-deals/dev/users-ms/private")
 * @param values - Key-value pairs to publish as encrypted parameters
 * @param options - Optional configuration (KMS key ARN)
 *
 * @example
 * // Publish encrypted secrets with AWS managed key
 * publishSecureStringParameters(this, "/super-deals/dev/users-ms/private", {
 *   apiKey: "secret-api-key",
 *   dbPassword: "secret-password"
 * });
 *
 * @example
 * // Publish encrypted secrets with custom KMS key
 * publishSecureStringParameters(
 *   this,
 *   "/super-deals/dev/users-ms/private",
 *   { apiKey: "secret-api-key" },
 *   { encryptionKeyArn: "arn:aws:kms:us-east-1:123456789012:key/abc-123" }
 * );
 *
 * @remarks
 * - Uses CloudFormation property overrides to set SecureString type
 * - If no KMS key provided, uses AWS managed key (aws/ssm)
 * - Keys are sanitized to create valid CDK construct IDs
 * - Empty values are stored as empty strings
 *
 * @see {@link publishStringParameters} for non-encrypted parameters
 */
export function publishSecureStringParameters(
  scope: Construct,
  basePath: string,
  values: Record<string, string>,
  options: IPublishSecureStringParametersOptions = {}
): void {
  const { encryptionKeyArn } = options;

  Object.entries(values).forEach(([key, value]) => {
    const safeKey = key.replace(/[^A-Za-z0-9]/g, "_");
    const name = `${basePath}/${key}`.replace(/\/+/, "/");
    const parameter = new StringParameter(scope, `SecureParam_${safeKey}`, {
      parameterName: name,
      stringValue: value ?? "",
      tier: ParameterTier.STANDARD,
    });

    const cfnParameter = parameter.node.defaultChild as
      | CfnParameter
      | undefined;
    if (cfnParameter) {
      cfnParameter.addPropertyOverride("Type", "SecureString");
      if (encryptionKeyArn) {
        cfnParameter.addPropertyOverride("KeyId", encryptionKeyArn);
      }
    }
  });
}

/**
 * Reads multiple standard SSM parameters as a typed object
 *
 * Convenience function for reading multiple related parameters.
 * Maps parameter suffixes to full paths and reads all values.
 * Returns a typed object with the same keys as the input spec.
 *
 * @template TSpec - Type of the parameter specification object
 * @param scope - CDK construct scope
 * @param basePath - Base path for all parameters (e.g., "/super-deals/dev/users-ms/public")
 * @param params - Object mapping keys to parameter path suffixes
 * @returns Object with same keys as params, values from SSM
 *
 * @example
 * // Read multiple public parameters
 * const bindings = readBindings(this, "/super-deals/dev/users-ms/public", {
 *   apiUrl: "api/baseUrl",
 *   userPoolId: "auth/userPoolId",
 *   region: "region"
 * });
 * // Returns: {
 * //   apiUrl: "<value from /super-deals/dev/users-ms/public/api/baseUrl>",
 * //   userPoolId: "<value from /super-deals/dev/users-ms/public/auth/userPoolId>",
 * //   region: "<value from /super-deals/dev/users-ms/public/region>"
 * // }
 *
 * @remarks
 * - All values are resolved at CDK deployment time
 * - Type-safe: return type matches input spec
 * - Use for reading multiple related parameters efficiently
 *
 * @see {@link readParam} for reading single parameters
 * @see {@link readSecureBindings} for encrypted parameters
 */
export function readBindings<TSpec extends Record<string, string>>(
  scope: Construct,
  basePath: string,
  params: TSpec
): { [K in keyof TSpec]: string } {
  const out = {} as { [K in keyof TSpec]: string };
  for (const key in params) {
    const suffix = params[key];
    out[key] = readParam(scope, `${basePath}/${suffix}`);
  }
  return out;
}

/**
 * Reads multiple encrypted (SecureString) SSM parameters as a typed object
 *
 * Convenience function for reading multiple related encrypted parameters.
 * Maps parameter suffixes to full paths and reads all secure values.
 * Returns a typed object with the same keys as the input spec.
 *
 * @template TSpec - Type of the parameter specification object
 * @param scope - CDK construct scope
 * @param basePath - Base path for all parameters (e.g., "/super-deals/dev/users-ms/private")
 * @param params - Object mapping keys to parameter path suffixes
 * @returns Object with same keys as params, encrypted values from SSM
 *
 * @example
 * // Read multiple encrypted parameters
 * const secrets = readSecureBindings(this, "/super-deals/dev/users-ms/private", {
 *   apiKey: "external/apiKey",
 *   dbPassword: "database/password",
 *   jwtSecret: "auth/jwtSecret"
 * });
 * // Returns: {
 * //   apiKey: "<encrypted value from /super-deals/dev/users-ms/private/external/apiKey>",
 * //   dbPassword: "<encrypted value from /super-deals/dev/users-ms/private/database/password>",
 * //   jwtSecret: "<encrypted value from /super-deals/dev/users-ms/private/auth/jwtSecret>"
 * // }
 *
 * @remarks
 * - All values remain encrypted in CloudFormation templates
 * - Values are resolved at Lambda runtime
 * - Type-safe: return type matches input spec
 * - All parameters must be SecureString type in SSM
 *
 * @see {@link readSecureParam} for reading single encrypted parameters
 * @see {@link readBindings} for standard parameters
 */
export function readSecureBindings<TSpec extends Record<string, string>>(
  scope: Construct,
  basePath: string,
  params: TSpec
): { [K in keyof TSpec]: string } {
  const out = {} as { [K in keyof TSpec]: string };
  for (const key in params) {
    const suffix = params[key];
    out[key] = readSecureParam(scope, `${basePath}/${suffix}`);
  }
  return out;
}
