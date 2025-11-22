/**
 * API Gateway JSON Schema for GET /merchants/search
 *
 * Defines request validation schema for API Gateway.
 * This is separate from Zod runtime validation (payload.schema.ts).
 *
 * API Gateway validates requests BEFORE invoking Lambda, providing:
 * - Fast-fail validation (reduces Lambda invocations)
 * - Consistent error responses
 * - Reduced Lambda costs
 *
 * Design Artifacts:
 * - OpenAPI Spec: docs/project/specs/api/resources/merchants/search.yaml
 * - Parameter Spec: docs/project/specs/api/parameters/query/category.yaml
 *
 * @see docs/implementation/adding-endpoints-part-2-api-gateway.md - API Gateway integration
 */

import { JsonSchema, JsonSchemaType } from "aws-cdk-lib/aws-apigateway";

/**
 * Query Parameters Schema for GET /merchants/search
 *
 * Validates:
 * - category: Required string, must be one of the valid enum values
 *
 * From OpenAPI spec:
 * - Valid values: "Repair", "Refill", "Recycling", "Donate"
 * - Case-sensitive
 * - Required parameter
 */
export const searchMerchantsQuerySchema: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    category: {
      type: JsonSchemaType.STRING,
      enum: ["Repair", "Refill", "Recycling", "Donate"],
      description: "Primary service category to filter by",
    },
  },
  required: ["category"],
};
