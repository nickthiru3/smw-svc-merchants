/**
 * Zod Schemas for Runtime Validation - GET /merchants/search
 *
 * Runtime validation of request data using Zod.
 * Separate from API Gateway JSON schemas (api.schema.ts).
 *
 * Design Artifacts:
 * - Actions & Queries: Inputs section defines validation rules
 * - Story Card: Business Rules section defines constraints
 *
 * @see docs/implementation/adding-endpoints-part-1-lambda-handlers.md - Validation patterns
 */

import { z } from "zod";
import { PrimaryCategory } from "#src/types/merchant";

/**
 * Query Parameters Schema
 *
 * Validates:
 * - category: Required, must be one of the valid PrimaryCategory enum values
 *
 * From actions-queries.md:
 * - Valid values: "Repair", "Refill", "Recycling", "Donate"
 * - Case-sensitive
 */
export const queryParamsSchema = z.object({
  category: z
    .enum([
      PrimaryCategory.REPAIR,
      PrimaryCategory.REFILL,
      PrimaryCategory.RECYCLING,
      PrimaryCategory.DONATE,
    ])
    .describe("Primary category to filter merchants by"),
});

/**
 * Infer TypeScript type from schema
 */
export type TQueryParams = z.infer<typeof queryParamsSchema>;
