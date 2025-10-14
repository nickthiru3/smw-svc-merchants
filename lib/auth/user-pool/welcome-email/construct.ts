/**
 * Welcome Email Infrastructure
 *
 * Creates Lambda function and SES email templates for sending welcome emails
 * after user email confirmation (Cognito Post Confirmation trigger).
 *
 * Components:
 * - Lambda function (Post Confirmation trigger)
 * - SES email templates (merchant, customer)
 * - IAM permissions (SES send, template access)
 * - Environment variables (template names, source email, website URL)
 *
 * Flow:
 * 1. User confirms email (clicks verification link)
 * 2. Cognito triggers this Lambda
 * 3. Lambda determines user type (merchant/customer)
 * 4. Lambda sends appropriate welcome email via SES
 * 5. Email events tracked via SES configuration set
 *
 * @module lib/auth/user-pool/welcome-email/construct
 */

import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import EmailTemplatesConstruct from "./email-templates/construct";
import MonitorConstruct from "#lib/monitor/construct";
import path from "path";
import type { IConfig } from "#config/default";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

/**
 * Props for WelcomeEmailConstruct
 *
 * @property userPool - Cognito User Pool to attach trigger to
 * @property ssmBindings - SSM bindings for source email and website URL
 * @property monitor - Monitoring construct for SES configuration set
 * @property config - Application configuration
 */
interface IWelcomeEmailConstructProps {
  readonly userPool: UserPool;
  readonly ssmBindings: SsmBindingsConstruct;
  readonly monitor: MonitorConstruct;
  readonly config: IConfig;
}

/**
 * Welcome Email Construct
 *
 * Creates Lambda function for Cognito Post Confirmation trigger that sends
 * welcome emails to newly confirmed users via Amazon SES.
 *
 * Features:
 * - User type detection (merchant/customer)
 * - Template-based emails (SES templates)
 * - Email event tracking (via SES configuration set)
 * - Error handling (doesn't block user confirmation)
 *
 * IAM Permissions:
 * - SES: SendEmail, SendTemplatedEmail, SendRawEmail
 * - SES: GetTemplate (for template validation)
 * - Lambda: InvokeFunction (for Cognito trigger)
 *
 * @example
 * // Create welcome email construct
 * const welcomeEmail = new WelcomeEmailConstruct(this, 'WelcomeEmail', {
 *   userPool: userPool.pool,
 *   ssmBindings: ssmBindings,
 *   monitor: monitor,
 *   config: appConfig
 * });
 *
 * // Attach to User Pool
 * userPool.pool.addTrigger(
 *   UserPoolOperation.POST_CONFIRMATION,
 *   welcomeEmail.lambda
 * );
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
 */
class WelcomeEmailConstruct extends Construct {
  /**
   * Lambda function for Post Confirmation trigger
   *
   * Public property to allow User Pool to attach as trigger.
   */
  lambda: NodejsFunction;

  /**
   * Creates the welcome email construct
   *
   * Creates:
   * 1. SES email templates (merchant, customer)
   * 2. Lambda function with environment variables
   * 3. IAM permissions for SES
   * 4. Cognito invocation permission
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(
    scope: Construct,
    id: string,
    props: IWelcomeEmailConstructProps
  ) {
    super(scope, id);

    const { userPool, ssmBindings, monitor, config } = props;

    const envName = config.envName;
    const sourceEmail = ssmBindings.website.sourceEmail;
    const websiteUrl = ssmBindings.website.siteUrl;
    const sesConfigurationSetName = monitor.ses.configurationSetName;

    // Create SES email templates for merchant and customer welcome emails
    const emailTemplates = new EmailTemplatesConstruct(
      this,
      "EmailTemplatesConstruct",
      {
        envName,
      }
    );

    const merchantEmailTemplateName = emailTemplates.merchant.templateName;
    // Customer template not yet implemented
    // const customerEmailTemplateName = emailTemplates.customer.templateName;

    // Create Lambda function for Post Confirmation trigger
    this.lambda = new NodejsFunction(this, "Lambda", {
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      entry: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      depsLockFilePath: path.join(__dirname, "../../../../package-lock.json"),
      environment: {
        // SES template names for different user types
        MERCHANT_EMAIL_TEMPLATE_NAME: merchantEmailTemplateName,
        // CUSTOMER_EMAIL_TEMPLATE_NAME: customerEmailTemplateName, // Not yet implemented
        // Email configuration
        SOURCE_EMAIL: sourceEmail,
        WEBSITE_URL: websiteUrl,
        CONFIGURATION_SET_NAME: sesConfigurationSetName,
      },
    });

    // Grant Lambda permission to send emails via SES
    this.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendTemplatedEmail",
          "ses:SendRawEmail",
        ],
        resources: ["*"], // SES doesn't support resource-level permissions for send actions
      })
    );

    // Grant Lambda permission to read SES templates (for validation)
    this.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [
          // Allow access to all templates in the region
          // Specific templates:
          // - arn:aws:ses:us-east-1:346761569124:template/${merchantEmailTemplateName}
          // - arn:aws:ses:us-east-1:346761569124:template/${customerEmailTemplateName}
          "arn:aws:ses:us-east-1:346761569124:template/*",
        ],
        actions: ["ses:GetTemplate"],
      })
    );

    // Grant Cognito permission to invoke this Lambda
    if (userPool) {
      this.lambda.addPermission("CognitoInvocation", {
        principal: new ServicePrincipal("cognito-idp.amazonaws.com"),
        action: "lambda:InvokeFunction",
        sourceArn: userPool.userPoolArn,
      });
    }
  }
}

export default WelcomeEmailConstruct;
