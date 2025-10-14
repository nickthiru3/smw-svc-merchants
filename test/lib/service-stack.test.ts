jest.mock("aws-cdk-lib/aws-lambda-nodejs", () => {
  const actual = jest.requireActual("aws-cdk-lib/aws-lambda-nodejs");
  const lambda = jest.requireActual("aws-cdk-lib/aws-lambda");

  class MockNodejsFunction extends lambda.Function {
    constructor(scope: any, id: string, props: any = {}) {
      const { bundling, entry, depsLockFilePath, minify, sourceMaps, ...rest } =
        props ?? {};

      super(scope, id, {
        ...rest,
        code:
          rest?.code ??
          lambda.Code.fromInline("exports.handler = async () => {}"),
        handler: rest?.handler ?? "index.handler",
        runtime: rest?.runtime ?? lambda.Runtime.NODEJS_20_X,
      });
    }
  }

  return {
    ...actual,
    NodejsFunction: MockNodejsFunction,
  };
});

import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { ServiceStack } from "#lib/service-stack";
import type { IConfig } from "#config/default";

describe("ServiceStack (infrastructure)", () => {
  let app: cdk.App;
  let stack: ServiceStack;

  const envName = "dev";
  const account = "123456789012";
  const region = "us-east-1";
  const serviceName = "users";

  const config: IConfig = {
    envName,
    accountId: account,
    region,
    service: {
      name: serviceName,
      displayName: serviceName,
    },
    resources: {
      tablePrefix: serviceName,
      bucketPrefix: serviceName,
      functionPrefix: serviceName,
      apiPrefix: serviceName,
    },
    // Keep optional sections minimal for synth
    features: { permissionsEnabled: false },
  } as IConfig;

  beforeEach(() => {
    app = new cdk.App();
    stack = new ServiceStack(app, `${envName}-${serviceName}-ServiceStack`, {
      env: { account, region },
      config,
    });
  });

  test("configures monitor Lambda with SLACK_WEBHOOK_URL env using SSM SecureString dynamic reference", () => {
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", Match.objectLike({
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          // Expect a CloudFormation dynamic reference to SSM SecureString
          SLACK_WEBHOOK_URL: Match.stringLikeRegexp("ssm-secure:.*monitor/slack/webhookUrl"),
        }),
      }),
    }));
  });

  test("synthesizes an API Gateway RestApi with custom Stage and access logs", () => {
    const template = Template.fromStack(stack);

    // RestApi exists
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);

    // Deployment + Stage exist
    template.resourceCountIs("AWS::ApiGateway::Deployment", 1);
    template.hasResourceProperties("AWS::ApiGateway::Stage", {
      StageName: envName,
      MethodSettings: Match.arrayWith([
        Match.objectLike({
          HttpMethod: "*",
          ResourcePath: "/*",
          LoggingLevel: "INFO",
          MetricsEnabled: true,
          DataTraceEnabled: true,
          ThrottlingBurstLimit: 10,
          ThrottlingRateLimit: 5,
        }),
      ]),
    });

    // Access logs LogGroup with expected name and retention
    template.hasResourceProperties("AWS::Logs::LogGroup", Match.objectLike({
      LogGroupName: `/apigateway/${serviceName}/${envName}/access`,
      RetentionInDays: 30,
    }));
  });

  test("configures validation GatewayResponse, RequestValidator and Model for POST /users", () => {
    const template = Template.fromStack(stack);

    // GatewayResponse for BAD_REQUEST_BODY
    template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
      ResponseType: "BAD_REQUEST_BODY",
      ResponseParameters: Match.objectLike({
        "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
        "gatewayresponse.header.Access-Control-Allow-Headers": "'*'",
      }),
      StatusCode: "400",
    });

    // RequestValidator validates body
    template.hasResourceProperties("AWS::ApiGateway::RequestValidator", {
      ValidateRequestBody: true,
    });

    // Request Model exists for application/json
    template.hasResourceProperties("AWS::ApiGateway::Model", {
      ContentType: "application/json",
    });
  });

  test("exposes POST /users method with request model (no authorizer for sign-up)", () => {
    const template = Template.fromStack(stack);

    // Method for POST exists with request models but no authorizer (public endpoint)
    template.hasResourceProperties("AWS::ApiGateway::Method", Match.objectLike({
      HttpMethod: "POST",
      AuthorizationType: "NONE", // Sign-up is public
      RequestValidatorId: Match.anyValue(),
      RequestModels: Match.objectLike({
        "application/json": Match.anyValue(),
      }),
      Integration: Match.objectLike({
        Type: "AWS_PROXY",
      }),
    }));
  });

  test("exposes GET /.well-known/bindings method (public, no auth)", () => {
    const template = Template.fromStack(stack);

    // Should have a GET method for bindings endpoint
    const methods = template.findResources("AWS::ApiGateway::Method", {
      Properties: {
        HttpMethod: "GET",
        AuthorizationType: "NONE",
      },
    });

    expect(Object.keys(methods).length).toBeGreaterThanOrEqual(1);
  });

  test("creates Lambda for CreateUser with Cognito and DynamoDB env vars", () => {
    const template = Template.fromStack(stack);

    // Lambda function with required environment variables
    template.hasResourceProperties("AWS::Lambda::Function", Match.objectLike({
      Runtime: "nodejs20.x",
      MemorySize: 512,
      Timeout: 60,
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          USER_POOL_ID: Match.anyValue(),
          USER_POOL_CLIENT_ID: Match.anyValue(),
          TABLE_NAME: Match.anyValue(),
        }),
      }),
    }));
  });

  test("creates IAM policies for Lambda to access Cognito and DynamoDB", () => {
    const template = Template.fromStack(stack);

    // Policy allowing Cognito SignUp operation
    template.hasResourceProperties("AWS::IAM::Policy", Match.objectLike({
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "cognito-idp:SignUp",
            Effect: "Allow",
          }),
        ]),
      }),
    }));

    // Policy allowing Cognito AdminAddUserToGroup operation
    template.hasResourceProperties("AWS::IAM::Policy", Match.objectLike({
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "cognito-idp:AdminAddUserToGroup",
            Effect: "Allow",
          }),
        ]),
      }),
    }));

    // Policy allowing DynamoDB PutItem
    template.hasResourceProperties("AWS::IAM::Policy", Match.objectLike({
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "dynamodb:PutItem",
            Effect: "Allow",
          }),
        ]),
      }),
    }));
  });

  test("creates Cognito User Pool with custom attributes and groups", () => {
    const template = Template.fromStack(stack);

    // User Pool exists
    template.resourceCountIs("AWS::Cognito::UserPool", 1);

    // User Pool has custom userType attribute
    template.hasResourceProperties("AWS::Cognito::UserPool", Match.objectLike({
      Schema: Match.arrayWith([
        Match.objectLike({
          Name: "userType",
          AttributeDataType: "String",
          Mutable: false,
        }),
      ]),
    }));

    // User Pool Client exists
    template.resourceCountIs("AWS::Cognito::UserPoolClient", 1);

    // User groups exist (merchant, customer, admin)
    template.resourceCountIs("AWS::Cognito::UserPoolGroup", 3);
    template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
      GroupName: "merchant",
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
      GroupName: "customer",
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
      GroupName: "admin",
    });
  });

  test("configures Cognito triggers for custom messages and post-confirmation", () => {
    const template = Template.fromStack(stack);

    // User Pool should have Lambda triggers configured
    template.hasResourceProperties("AWS::Cognito::UserPool", Match.objectLike({
      LambdaConfig: Match.objectLike({
        CustomMessage: Match.anyValue(),
        PostConfirmation: Match.anyValue(),
      }),
    }));

    // Lambda functions for triggers should exist
    const lambdas = template.findResources("AWS::Lambda::Function");
    const lambdaKeys = Object.keys(lambdas);

    // Should have custom message and post-confirmation lambdas
    expect(lambdaKeys.length).toBeGreaterThanOrEqual(4); // At least: CreateUser, CustomMessage, PostConfirmation, Bindings
  });

  test("creates SES email template for merchant welcome email", () => {
    const template = Template.fromStack(stack);

    // SES email template should exist (currently only merchant template is created)
    template.resourceCountIs("AWS::SES::Template", 1);
  });

  test("creates DynamoDB table with PK/SK, GSI1 and PITR", () => {
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", Match.objectLike({
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: "PK", KeyType: "HASH" }),
        Match.objectLike({ AttributeName: "SK", KeyType: "RANGE" }),
      ]),
      AttributeDefinitions: Match.arrayWith([
        Match.objectLike({ AttributeName: "PK", AttributeType: "S" }),
        Match.objectLike({ AttributeName: "SK", AttributeType: "S" }),
      ]),
      Replicas: Match.arrayWith([
        Match.objectLike({
          PointInTimeRecoverySpecification: Match.objectLike({
            PointInTimeRecoveryEnabled: true,
          }),
        }),
      ]),
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: "GSI1",
          KeySchema: Match.arrayWith([
            Match.objectLike({ AttributeName: "GSI1PK", KeyType: "HASH" }),
            Match.objectLike({ AttributeName: "GSI1SK", KeyType: "RANGE" }),
          ]),
        }),
      ]),
    }));
  });

  test("exports API URL, User Pool, and table outputs", () => {
    const template = Template.fromStack(stack);

    const templateJson = template.toJSON();
    const outputs = Object.values(templateJson.Outputs ?? {}) as Array<{
      readonly Export?: { readonly Name?: string };
    }>;
    const exportNames = outputs
      .map((output) => output.Export?.Name)
      .filter((name): name is string => typeof name === "string");

    // Check for expected exports (names may not have service prefix)
    expect(exportNames).toEqual(
      expect.arrayContaining([
        `RestApiUrl-${serviceName}`,
        `${serviceName}-TableName`,
        `${serviceName}-TableArn`,
        "UserPoolId", // Without prefix
        "UserPoolClientId", // Without prefix
      ])
    );
  });

  test("configures SSM parameters for public bindings", () => {
    const template = Template.fromStack(stack);

    // Should have SSM parameters published
    const ssmParams = template.findResources("AWS::SSM::Parameter");
    const paramKeys = Object.keys(ssmParams);

    // Should have at least some public parameters
    expect(paramKeys.length).toBeGreaterThan(0);
  });
});
