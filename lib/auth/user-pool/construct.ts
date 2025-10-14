/**
 * Cognito User Pool Infrastructure
 *
 * Creates Cognito User Pool for user authentication with:
 * - Email-based sign-up and sign-in
 * - Email verification with 6-digit code
 * - Strong password policy
 * - Custom attributes (userType: merchant/customer)
 * - Lambda triggers (custom message, post-confirmation)
 * - OAuth 2.0 support
 *
 * Configuration:
 * - Self sign-up enabled
 * - Email verification required
 * - Password: min 8 chars, uppercase, lowercase, digit, symbol
 * - Account recovery via email only
 * - Case-insensitive sign-in
 *
 * @module lib/auth/user-pool/construct
 */

import { Construct } from "constructs";
import { CfnOutput, RemovalPolicy, Duration } from "aws-cdk-lib";
import {
  UserPool,
  VerificationEmailStyle,
  AccountRecovery,
  StringAttribute,
  OAuthScope,
  UserPoolDomain,
  UserPoolOperation,
  UserPoolClient,
} from "aws-cdk-lib/aws-cognito";
import CustomSignUpMessageConstruct from "./custom-sign-up-message/construct";
import WelcomeEmailConstruct from "./welcome-email/construct";
import MonitorConstruct from "#lib/monitor/construct";
import type { IConfig } from "#config/default";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

/**
 * Props for UserPoolConstruct
 *
 * @property config - Application configuration
 * @property ssmBindings - SSM bindings for website URL
 * @property monitor - Monitoring construct for SES configuration set
 */
interface IUserPoolConstructProps {
  readonly config: IConfig;
  readonly ssmBindings: SsmBindingsConstruct;
  readonly monitor: MonitorConstruct;
}

/**
 * User Pool Construct
 *
 * Creates Cognito User Pool with email-based authentication,
 * Lambda triggers, and OAuth support.
 *
 * Features:
 * - **Email Verification**: 6-digit code sent via email
 * - **Password Policy**: Strong requirements (8+ chars, mixed case, digits, symbols)
 * - **Custom Attributes**: userType (merchant/customer)
 * - **Lambda Triggers**: Custom verification message, welcome email
 * - **OAuth 2.0**: Authorization code grant flow
 * - **Account Recovery**: Email-only recovery
 *
 * @example
 * // Create user pool
 * const userPool = new UserPoolConstruct(this, 'UserPoolConstruct', {
 *   config: appConfig,
 *   ssmBindings: ssmBindings,
 *   monitor: monitor
 * });
 *
 * // Use in API Gateway authorizer
 * const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
 *   cognitoUserPools: [userPool.pool]
 * });
 */
class UserPoolConstruct extends Construct {
  /**
   * Cognito User Pool
   *
   * Public property for:
   * - API Gateway authorizers
   * - Lambda environment variables (pool ID)
   * - User group creation
   */
  pool: UserPool;

  /**
   * Cognito User Pool Domain
   *
   * Public property for:
   * - OAuth redirect URLs
   * - Hosted UI URLs
   */
  domain: UserPoolDomain;

  /**
   * User Pool Client
   *
   * Public property for:
   * - Web/mobile app authentication
   * - Lambda environment variables (client ID)
   */
  poolClient: UserPoolClient;

  /**
   * Creates the User Pool construct
   *
   * Creates:
   * 1. User Pool with email authentication
   * 2. User Pool Domain for OAuth
   * 3. Custom Message Lambda (verification emails)
   * 4. Welcome Email Lambda (post-confirmation)
   * 5. User Pool Client (app integration)
   * 6. CloudFormation outputs
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IUserPoolConstructProps) {
    super(scope, id);

    const { config, ssmBindings, monitor } = props;

    const envName = config.envName;

    // Protect User Pool in production/staging; allow deletion in dev/local
    const shouldProtectFromDeletion = envName !== "local" && envName !== "dev";

    // Create User Pool with email authentication
    this.pool = new UserPool(this, `UserPool`, {
      // Allow users to sign up themselves
      selfSignUpEnabled: true,
      // Strong password requirements
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      // Email-based sign-in
      signInAliases: {
        email: true,
      },
      // Automatically verify email addresses
      autoVerify: {
        email: true,
      },
      // Keep original email when user updates it
      keepOriginal: {
        email: true,
      },
      // Case-insensitive email sign-in
      signInCaseSensitive: false,
      // Email verification settings (overridden by CustomMessage Lambda)
      userVerification: {
        emailSubject: "Super Deals: Email Verification",
        emailBody:
          "Thanks for signing up to our awesome app! Your verification code is {####}. This code is valid for 24 hours.",
        emailStyle: VerificationEmailStyle.CODE,
      },
      // Email-only account recovery
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: false, // Email cannot be changed after sign-up
        },
      },
      // Custom attributes
      customAttributes: {
        userType: new StringAttribute({ mutable: false }), // merchant or customer
      },
      // Retain User Pool in production/staging
      removalPolicy: shouldProtectFromDeletion
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });

    // Create User Pool Domain for OAuth flows
    this.domain = new UserPoolDomain(this, "UserPoolDomain", {
      userPool: this.pool,
      cognitoDomain: {
        domainPrefix: `super-deals-${envName}`,
      },
    });

    // Custom Message Lambda - Customizes verification email content
    const customMessage = new CustomSignUpMessageConstruct(
      this,
      "CustomMessageLambda",
      {
        ssmBindings,
        userPool: this.pool,
      }
    );

    // Welcome Email Lambda - Sends welcome email after email confirmation
    const welcomeEmail = new WelcomeEmailConstruct(this, "WelcomeEmailLambda", {
      userPool: this.pool,
      ssmBindings,
      monitor,
      config,
    });

    // Attach Lambda triggers to User Pool
    this.pool.addTrigger(
      UserPoolOperation.CUSTOM_MESSAGE,
      customMessage.lambda
    );

    this.pool.addTrigger(
      UserPoolOperation.POST_CONFIRMATION,
      welcomeEmail.lambda
    );

    // Create User Pool Client for web/mobile apps
    this.poolClient = this.pool.addClient(`UserPoolClient`, {
      // Enable username/password authentication flows
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
      },
      // Access token valid for 8 hours
      accessTokenValidity: Duration.hours(8),
      // OAuth 2.0 configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: ["http://localhost:5173"], // Local development callback
      },
      // Prevent user enumeration attacks
      preventUserExistenceErrors: true,
    });

    // Export User Pool ID for web client and other services
    new CfnOutput(this, `UserPoolId`, {
      value: this.pool.userPoolId,
      description: "Cognito user pool ID used by the web client's auth service",
      exportName: `UserPoolId`,
    });

    // Export User Pool Client ID for web client authentication
    new CfnOutput(this, `UserPoolClientId`, {
      value: this.poolClient.userPoolClientId,
      description:
        "Cognito user pool client ID used by the web client's auth service",
      exportName: `UserPoolClientId`,
    });

    // Export User Pool Domain for OAuth redirect URLs
    new CfnOutput(this, `UserPoolDomainName`, {
      value: this.domain.domainName,
      description: "Cognito domain for OAuth flows",
      exportName: `UserPoolDomainName`,
    });
  }
}

export default UserPoolConstruct;
