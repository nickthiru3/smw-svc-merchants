/**
 * GET /merchants/search Endpoint Construct
 *
 * Creates infrastructure for merchant search endpoint with:
 * - API Gateway request validation (query parameters)
 * - Lambda function for merchant search
 * - DynamoDB query integration
 * - IAM permissions for least-privilege access
 *
 * Architecture:
 * - Layer 1 (Constructor): Orchestrates setup in logical sequence
 * - Layer 2 (Helper Methods): Handles specific responsibilities
 * - Layer 3 (AWS Resources): Creates CDK constructs
 *
 * Design Artifacts:
 * - OpenAPI Spec: docs/project/specs/api/resources/merchants/search.yaml
 * - Actions & Queries: Query 1: Search Merchants by Category
 *
 * @see docs/implementation/adding-endpoints-part-2-api-gateway.md - CDK patterns
 */

import { Construct } from "constructs";
import {
  LambdaIntegration,
  Model,
  RequestValidator,
  GatewayResponse,
  ResponseType,
  IResource,
} from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";
import path from "path";
import AuthConstruct from "#lib/auth/construct";
import DatabaseConstruct from "#lib/db/construct";
import type { IApiProps } from "#lib/api/construct";
import { searchMerchantsQuerySchema } from "./api.schema";

interface IConstructProps {
  readonly apiProps: IApiProps;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
  readonly merchantsResource: IResource;
}

/**
 * GET /merchants/search Endpoint Construct
 *
 * Implements merchant search by category endpoint.
 * This is a read-only operation that queries DynamoDB GSI1.
 */
class SearchConstruct extends Construct {
  queryParamsModel: Model;
  requestValidator: RequestValidator;
  validationErrorResponse: GatewayResponse;
  lambda: NodejsFunction;

  /**
   * Creates the GET /merchants/search endpoint construct
   *
   * Orchestrates:
   * 1. Request validation setup (query parameter validator, error response)
   * 2. Lambda function creation with environment variables and IAM policies
   * 3. API Gateway method integration
   *
   * @param scope - CDK construct scope
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IConstructProps) {
    super(scope, id);

    const { apiProps, auth, db, merchantsResource } = props;

    // Note: auth is passed but not used in this construct because this is a
    // public endpoint (no authentication required). The auth parameter is
    // included in the interface for consistency with other endpoint constructs
    // and to make it easy to add authentication later if requirements change.

    this.createModelsForRequestValidation(apiProps);
    this.createRequestValidator(apiProps);
    this.addCustomGatewayResponseForValidationErrors(apiProps);
    this.createLambdaFunction(db);
    this.addApiMethodWithLambdaIntegrationAndRequestValidation(
      merchantsResource
    );
  }

  /**
   * Creates JSON schema validation model for query parameters
   *
   * The model is used by API Gateway to validate query parameters before
   * invoking the Lambda function, providing fast-fail validation at the
   * gateway level.
   *
   * Note: For GET requests with query parameters, we create a model to define
   * the schema, even though the actual validation happens via requestParameters
   * in the addMethod call. This provides documentation and type safety.
   *
   * @param apiProps - API Gateway properties including RestApi reference
   */
  createModelsForRequestValidation(apiProps: IApiProps) {
    this.queryParamsModel = new Model(this, `QueryParamsModel`, {
      restApi: apiProps.restApi,
      contentType: "application/json",
      schema: searchMerchantsQuerySchema,
    });
  }

  /**
   * Creates request validator for query parameter validation
   *
   * Configures API Gateway to validate query parameters before invoking
   * the Lambda function. This provides:
   * - Fast-fail validation (reduces Lambda invocations)
   * - Consistent error responses
   * - Reduced Lambda costs
   *
   * Note: Validates query parameters, not request body (GET request).
   *
   * @param apiProps - API Gateway properties including RestApi reference
   */
  createRequestValidator(apiProps: IApiProps) {
    this.requestValidator = new RequestValidator(this, `RequestValidator`, {
      restApi: apiProps.restApi,
      validateRequestBody: false, // GET requests don't have body
      validateRequestParameters: true, // Validate query parameters
    });
  }

  /**
   * Adds custom gateway response for validation errors
   *
   * Configures API Gateway to return a structured error response when
   * query parameter validation fails. This provides:
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
        type: ResponseType.BAD_REQUEST_PARAMETERS,
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
   * Creates Lambda function for merchant search with DynamoDB integration
   *
   * Configuration:
   * - Runtime: Node.js 20.x
   * - Memory: 512 MB
   * - Timeout: 30 seconds (read operation, should be fast)
   * - Bundling: Docker-based with AWS SDK excluded (provided by Lambda runtime)
   *
   * Environment Variables (set at runtime):
   * - MERCHANTS_TABLE_NAME: DynamoDB table name for querying merchants
   *
   * IAM Permissions (least-privilege):
   * - dynamodb:Query (specific table and GSI1)
   *   - Required to query merchants by category using GSI1
   *   - Scoped to specific table ARN and GSI1 for security
   *
   * @param db - Database construct providing table references
   */
  createLambdaFunction(db: DatabaseConstruct) {
    this.lambda = new NodejsFunction(this, "NodejsFunction", {
      bundling: {
        externalModules: ["@aws-sdk"],
        // Disable Docker bundling in test environment
        forceDockerBundling: process.env.NODE_ENV !== "test",
      },
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      entry: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      depsLockFilePath: path.join(
        __dirname,
        "../../../../../package-lock.json"
      ),
      environment: {
        MERCHANTS_TABLE_NAME: db.table.tableName,
      },
    });

    // Grant read permissions to DynamoDB table
    // This grants: Query, Scan, GetItem, BatchGetItem on table and indexes
    db.table.grantReadData(this.lambda);
  }

  /**
   * Adds GET method to /merchants/search resource with Lambda integration and validation
   *
   * Configures:
   * - HTTP Method: GET
   * - Integration: AWS_PROXY (Lambda proxy integration)
   * - Request Validation: Enabled (validates query parameters)
   * - Authorization: None (public endpoint for browsing merchants)
   *
   * Request Flow:
   * 1. API Gateway receives GET /merchants/search?category=Repair request
   * 2. Validates query parameters (category required, must be valid enum)
   * 3. If valid, invokes Lambda function
   * 4. If invalid, returns 400 with validation error details
   *
   * Query Parameters:
   * - category (required): One of "Repair", "Refill", "Recycling", "Donate"
   *
   * @param merchantsResource - API Gateway resource representing /merchants endpoint
   */
  addApiMethodWithLambdaIntegrationAndRequestValidation(
    merchantsResource: IResource
  ) {
    // Create /search sub-resource under /merchants
    const searchResource = merchantsResource.addResource("search");

    // Add GET method with query parameter validation
    searchResource.addMethod("GET", new LambdaIntegration(this.lambda), {
      operationName: "SearchMerchantsByCategory",
      requestValidator: this.requestValidator,
      requestParameters: {
        "method.request.querystring.category": true, // Required parameter
      },
    });
  }
}

export default SearchConstruct;
