/**
 * Custom Message Lambda Construct
 *
 * This construct creates a Lambda function that customizes Cognito email messages
 * based on user type (merchant vs customer). It is triggered by Cognito
 * during sign-up and password reset processes. It is set on the lambdaTriggers
 * property of the UserPool construct's props.
 *
 * The Lambda modifies the event.response properties to customize the email content
 * that Cognito sends to users.
 */

import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import path from "path";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

interface ICustomSignUpMessageConstructProps {
  readonly ssmBindings: SsmBindingsConstruct;
  readonly userPool: UserPool;
}

class CustomSignUpMessageConstruct extends Construct {
  lambda: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: ICustomSignUpMessageConstructProps
  ) {
    super(scope, id);

    const { ssmBindings, userPool } = props;

    const siteUrl = ssmBindings.website.siteUrl;

    // Define the Lambda function for custom message handling
    this.lambda = new NodejsFunction(this, "NodejsFunction", {
      bundling: {
        externalModules: ["@aws-sdk"],
        forceDockerBundling: true,
      },
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.minutes(1),
      entry: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      depsLockFilePath: path.join(__dirname, "../../../../package-lock.json"),
      environment: {
        WEBSITE_URL: siteUrl,
      },
    });

    // No additional permissions needed for the Lambda function
    // Cognito will handle sending the emails using its own service

    // Grant permissions for Cognito to invoke the Lambda function
    this.lambda.addPermission("InvokePermission", {
      principal: new ServicePrincipal("cognito-idp.amazonaws.com"),
      sourceArn: userPool.userPoolArn,
    });
  }
}

export default CustomSignUpMessageConstruct;
