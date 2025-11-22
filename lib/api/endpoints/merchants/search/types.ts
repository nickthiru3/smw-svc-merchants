/**
 * TypeScript Types for GET /merchants/search
 *
 * Domain entities and handler-specific types for searching merchants by category.
 *
 * Design Artifacts:
 * - Actions & Queries: docs/project/specs/stories/consumers/browse-providers-by-waste-category/actions-queries.md
 * - Entity: docs/project/specs/entities/merchants.md
 *
 * @see docs/implementation/adding-endpoints-part-1-lambda-handlers.md - Handler implementation guide
 */

import type {
  Merchant,
  SearchMerchantsResult,
  PrimaryCategory,
} from "#src/types/merchant";

/**
 * Query Parameters for GET /merchants/search
 *
 * From actions-queries.md:
 * - category (string, required) - Primary category to filter by
 */
export interface ISearchMerchantsQueryParams {
  readonly category: string;
}

/**
 * Response for GET /merchants/search
 *
 * Matches SearchMerchantsResult from data access layer
 */
export interface ISearchMerchantsResponse {
  readonly merchants: Merchant[];
  readonly count: number;
  readonly category: string;
}

/**
 * Re-export domain types for convenience
 */
export type { Merchant, PrimaryCategory };
