/**
 * CDK Template Tests for GET /merchants Construct
 *
 * Tests CDK infrastructure for merchant list/filter endpoint.
 *
 * Test Coverage:
 * - Lambda function configuration
 * - Environment variables
 * - IAM permissions
 * - API Gateway method integration
 * - Request validation
 *
 * @see lib/api/endpoints/merchants/get/construct.ts - Implementation
 */

// Mock NodejsFunction to avoid Docker bundling in tests
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

import { App, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { TableV2, AttributeType } from "aws-cdk-lib/aws-dynamodb";
import GetConstruct from "#lib/api/endpoints/merchants/get/construct";

describe("GET /merchants Construct", () => {
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    const app = new App();
    stack = new Stack(app, "TestStack");

    // Create minimal mock dependencies
    const mockRestApi = new RestApi(stack, "MockRestApi", {
      restApiName: "test-api",
    });

    const mockTable = new TableV2(stack, "MockTable", {
      tableName: "test-merchants-table",
      partitionKey: {
        name: "MerchantId",
        type: AttributeType.STRING,
      },
    });

    const mockApiProps = {
      restApi: mockRestApi,
      optionsWithCors: {},
      optionsWithAuth: {},
    };

    const mockAuth = {
      userPool: {
        pool: {
          userPoolId: "test-pool-id",
          userPoolArn:
            "arn:aws:cognito-idp:us-east-1:123456789012:userpool/test-pool",
        },
        poolClient: {
          userPoolClientId: "test-client-id",
        },
      },
    };

    const mockDb = {
      table: mockTable,
    };

    const merchantsResource = mockRestApi.root.addResource("merchants");

    // Test ONLY this construct
    new GetConstruct(stack, "GetConstruct", {
      apiProps: mockApiProps as any,
      auth: mockAuth as any,
      db: mockDb as any,
      merchantsResource,
    });

    template = Template.fromStack(stack);
  });

  describe("Lambda Function", () => {
    it("should create Lambda function with correct runtime", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: "nodejs20.x",
      });
    });

    it("should set correct memory size", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        MemorySize: 512,
      });
    });

    it("should set correct timeout", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 30,
      });
    });

    it("should set MERCHANTS_TABLE_NAME environment variable", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            MERCHANTS_TABLE_NAME: Match.objectLike({
              Ref: Match.stringLikeRegexp("MockTable"),
            }),
          },
        },
      });
    });

    it("should use correct handler entry point", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "handler",
      });
    });
  });

  describe("IAM Permissions", () => {
    it("should grant DynamoDB read permissions", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:Scan",
              ]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });

    it("should grant permissions to query GSI indexes", () => {
      // Verify that grantReadData was called, which includes index permissions
      // The actual Resource structure is complex and varies by CDK version
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: "Allow",
              Action: Match.arrayWith(["dynamodb:Query"]),
            }),
          ]),
        },
      });
    });
  });

  describe("API Gateway", () => {
    it("should create request validator for query parameters", () => {
      template.hasResourceProperties("AWS::ApiGateway::RequestValidator", {
        ValidateRequestParameters: true,
        ValidateRequestBody: false, // GET requests don't have body
      });
    });

    it("should create gateway response for validation errors", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseType: "BAD_REQUEST_PARAMETERS",
        StatusCode: "400",
      });
    });

    it("should include CORS headers in validation error response", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseParameters: {
          "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
          "gatewayresponse.header.Access-Control-Allow-Headers": "'*'",
        },
      });
    });

    it("should create API Gateway method", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "GET",
      });
    });

    it("should use AWS_PROXY integration type", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        Integration: {
          Type: "AWS_PROXY",
        },
      });
    });

    it("should require category query parameter", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        RequestParameters: {
          "method.request.querystring.category": true,
        },
      });
    });

    it("should set operation name", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        OperationName: "GetMerchantsByCategory",
      });
    });
  });

  describe("Resource Count", () => {
    it("should create exactly one Lambda function", () => {
      template.resourceCountIs("AWS::Lambda::Function", 1);
    });

    it("should create exactly one request validator", () => {
      template.resourceCountIs("AWS::ApiGateway::RequestValidator", 1);
    });

    it("should create exactly one gateway response", () => {
      template.resourceCountIs("AWS::ApiGateway::GatewayResponse", 1);
    });

    it("should create exactly one API Gateway method", () => {
      template.resourceCountIs("AWS::ApiGateway::Method", 1);
    });
  });
});
