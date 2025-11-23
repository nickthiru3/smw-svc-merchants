/**
 * CDK Template Tests for GET /merchants/.well-known/bindings Construct
 *
 * Tests CDK infrastructure for service discovery bindings endpoint.
 *
 * Test Coverage:
 * - Lambda function configuration
 * - Environment variables
 * - IAM permissions (SSM)
 * - API Gateway method integration
 *
 * @see lib/api/endpoints/merchants/.well-known/bindings/get/construct.ts - Implementation
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
import GetConstruct from "#lib/api/endpoints/merchants/.well-known/bindings/get/construct";

describe("GET /merchants/.well-known/bindings Construct", () => {
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    const app = new App();
    stack = new Stack(app, "TestStack");

    // Create minimal mock dependencies
    const mockRestApi = new RestApi(stack, "MockRestApi", {
      restApiName: "test-api",
    });

    const mockApiProps = {
      restApi: mockRestApi,
      optionsWithCors: {},
      optionsWithAuth: {},
    };

    const mockConfig = {
      envName: "test",
      region: "us-east-1",
      serviceName: "merchants-ms",
    };

    const merchantsResource = mockRestApi.root.addResource("merchants");
    const wellKnownResource = merchantsResource.addResource(".well-known");
    const bindingsResource = wellKnownResource.addResource("bindings");

    // Test ONLY this construct
    new GetConstruct(stack, "GetConstruct", {
      config: mockConfig as any,
      apiProps: mockApiProps as any,
      bindingsResource,
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
        Timeout: 60,
      });
    });

    it("should set required environment variables", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            ENV_NAME: "test",
            REGION: "us-east-1",
            SSM_PUBLIC_PATH: Match.anyValue(),
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
    it("should create IAM policy for Lambda", () => {
      // Verify that an IAM policy is created
      template.resourceCountIs("AWS::IAM::Policy", 1);
    });

    it("should grant SSM permissions", () => {
      // Verify SSM permissions exist in the policy
      const policies = template.findResources("AWS::IAM::Policy");
      const policyKeys = Object.keys(policies);
      expect(policyKeys.length).toBeGreaterThan(0);

      const policy = policies[policyKeys[0]];
      const statements = policy.Properties.PolicyDocument.Statement;

      const hasSsmPermission = statements.some((stmt: any) =>
        stmt.Action.includes("ssm:GetParametersByPath")
      );
      expect(hasSsmPermission).toBe(true);
    });
  });

  describe("API Gateway", () => {
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

    it("should set operation name", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        OperationName: "ServiceDiscovery_Bindings",
      });
    });
  });

  describe("Resource Count", () => {
    it("should create exactly one Lambda function", () => {
      template.resourceCountIs("AWS::Lambda::Function", 1);
    });

    it("should create exactly one API Gateway method", () => {
      template.resourceCountIs("AWS::ApiGateway::Method", 1);
    });
  });
});
