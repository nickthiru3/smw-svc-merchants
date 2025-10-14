import { Construct } from "constructs";
import {
  LambdaIntegration,
  Model,
  RequestValidator,
  GatewayResponse,
  ResponseType,
  JsonSchema,
  IResource,
} from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import path from "path";
import AuthConstruct from "#lib/auth/construct";
import DatabaseConstruct from "#lib/db/construct";
import type { IApiProps } from "#lib/api/construct";
import { merchantApiSchema } from "./api.schema";

interface IPostConstructProps {
  readonly apiProps: IApiProps;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
  readonly usersResource: IResource;
}

/**
 * POST /users Endpoint Construct
 *
 * Creates infrastructure for user sign-up endpoint with:
 * - API Gateway request validation (JSON schema)
 * - Lambda function for user registration
 * - Cognito User Pool integration
 * - DynamoDB user data storage
 * - IAM permissions for least-privilege access
 *
 * Architecture:
 * - Layer 1 (Constructor): Orchestrates setup in logical sequence
 * - Layer 2 (Helper Methods): Handles specific responsibilities
 * - Layer 3 (AWS Resources): Creates CDK constructs
 */
class PostConstruct extends Construct {
  merchantModel: Model;
  requestValidator: RequestValidator;
  validationErrorResponse: GatewayResponse;
  lambda: NodejsFunction;

  /**
   * Creates the POST /users endpoint construct
   *
   * Orchestrates:
   * 1. Request validation setup (schema model, validator, error response)
   * 2. Lambda function creation with environment variables and IAM policies
   * 3. API Gateway method integration
   *
   * @param scope - CDK construct scope
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IPostConstructProps) {
    super(scope, id);

    const { apiProps, auth, db, usersResource } = props;

    this.createModelsForRequestValidation(apiProps, merchantApiSchema);
    this.createRequestValidator(apiProps);
    this.addCustomGatewayResponseForValidationErrors(apiProps);
    this.createLambdaFunction(auth, db);
    this.addApiMethodWithLambdaIntegrationAndRequestValidation(usersResource);
  }

  /**
   * Creates JSON schema validation models for request body validation
   *
   * Currently creates:
   * - Merchant sign-up model (validates merchant-specific fields)
   *
   * Future: Customer sign-up model (when customer registration is implemented)
   *
   * The model is used by API Gateway to validate incoming requests before
   * invoking the Lambda function, providing fast-fail validation at the
   * gateway level.
   *
   * @param apiProps - API Gateway properties including RestApi reference
   * @param schema - JSON schema defining valid request structure
   */
  createModelsForRequestValidation(apiProps: IApiProps, schema: JsonSchema) {
    this.merchantModel = new Model(this, `MerchantModel`, {
      restApi: apiProps.restApi,
      contentType: "application/json",
      schema,
    });

    // this.customerModel = new Model(this, `CustomerModel`, {
    //   restApi: http.restApi,
    //   contentType: "application/json",
    //   schema: customerSchema,
    // });
  }

  /**
   * Creates request validator for body validation
   *
   * Configures API Gateway to validate request bodies against the JSON schema
   * model before invoking the Lambda function. This provides:
   * - Fast-fail validation (reduces Lambda invocations)
   * - Consistent error responses
   * - Reduced Lambda costs
   *
   * Note: Only validates request body, not query parameters or headers.
   *
   * @param apiProps - API Gateway properties including RestApi reference
   */
  createRequestValidator(apiProps: IApiProps) {
    this.requestValidator = new RequestValidator(this, `RequestValidator`, {
      restApi: apiProps.restApi,
      validateRequestBody: true,
      validateRequestParameters: false,
    });
  }

  /**
   * Adds custom gateway response for validation errors
   *
   * Configures API Gateway to return a structured error response when
   * request body validation fails. This provides:
   * - Consistent error format across all validation failures
   * - CORS headers for browser compatibility
   * - Detailed error information for debugging
   *
   * Response format:
   * ```json
   * {
   *   "error": "Validation error",
   *   "message": "<validation error message>",
   *   "details": "<detailed validation errors>",
   *   "stage": "<API stage>",
   *   "resourcePath": "<resource path>"
   * }
   * ```
   *
   * @param apiProps - API Gateway properties including RestApi reference
   */
  addCustomGatewayResponseForValidationErrors(apiProps: IApiProps) {
    const VALIDATION_ERROR_TEMPLATE = `{
        "error": "Validation error",
        "message": $context.error.messageString,
        "details": $context.error.validationErrorString,
        "stage": "$context.stage",
        "resourcePath": "$context.resourcePath"
      }`;

    this.validationErrorResponse = new GatewayResponse(
      this,
      "ValidationErrorResponse",
      {
        restApi: apiProps.restApi,
        type: ResponseType.BAD_REQUEST_BODY,
        statusCode: "400",
        responseHeaders: {
          "Access-Control-Allow-Origin": "'*'",
          "Access-Control-Allow-Headers": "'*'",
        },
        templates: {
          "application/json": VALIDATION_ERROR_TEMPLATE,
        },
      }
    );
  }

  /**
   * Creates Lambda function for user sign-up with Cognito and DynamoDB integration
   *
   * Configuration:
   * - Runtime: Node.js 20.x
   * - Memory: 512 MB
   * - Timeout: 1 minute
   * - Bundling: Docker-based with AWS SDK excluded (provided by Lambda runtime)
   *
   * Environment Variables (set at runtime):
   * - USER_POOL_ID: Cognito User Pool ID for user registration
   * - USER_POOL_CLIENT_ID: Cognito User Pool Client ID for authentication
   * - TABLE_NAME: DynamoDB table name for storing user data
   *
   * IAM Permissions (least-privilege):
   * 1. cognito-idp:SignUp (all resources)
   *    - Required for user registration in Cognito
   *    - Scoped to all resources as User Pool ID is dynamic
   *
   * 2. cognito-idp:AdminAddUserToGroup (specific User Pool)
   *    - Required to add user to merchant/customer group
   *    - Scoped to specific User Pool ARN for security
   *
   * 3. dynamodb:PutItem (specific table)
   *    - Required to store user profile data
   *    - Scoped to specific table ARN for security
   *
   * @param auth - Authentication construct providing User Pool references
   * @param db - Database construct providing table references
   */
  createLambdaFunction(auth: AuthConstruct, db: DatabaseConstruct) {
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
      depsLockFilePath: path.join(
        __dirname,
        "../../../../../package-lock.json"
      ),
      environment: {
        USER_POOL_ID: auth.userPool.pool.userPoolId,
        USER_POOL_CLIENT_ID: auth.userPool.poolClient.userPoolClientId,
        TABLE_NAME: db.table.tableName,
      },
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["cognito-idp:SignUp"],
          resources: ["*"],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["cognito-idp:AdminAddUserToGroup"],
          resources: [auth.userPool.pool.userPoolArn],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["dynamodb:PutItem"],
          resources: [db.table.tableArn],
        }),
      ],
    });
  }

  /**
   * Adds POST method to /users resource with Lambda integration and validation
   *
   * Configures:
   * - HTTP Method: POST
   * - Integration: AWS_PROXY (Lambda proxy integration)
   * - Request Validation: Enabled (validates against merchant model)
   * - Authorization: None (public endpoint for sign-up)
   *
   * Request Flow:
   * 1. API Gateway receives POST /users request
   * 2. Validates request body against merchant JSON schema
   * 3. If valid, invokes Lambda function
   * 4. If invalid, returns 400 with validation error details
   *
   * Note: Currently only merchant model is active. Customer model will be
   * added when customer registration is implemented.
   *
   * @param usersResource - API Gateway resource representing /users endpoint
   */
  addApiMethodWithLambdaIntegrationAndRequestValidation(
    usersResource: IResource
  ) {
    usersResource.addMethod("POST", new LambdaIntegration(this.lambda), {
      operationName: "UserSignUp",
      requestValidator: this.requestValidator,
      requestModels: {
        "application/json": this.merchantModel,
        // "application/json": this.customerModel,
      },
    });
  }
}

export default PostConstruct;
