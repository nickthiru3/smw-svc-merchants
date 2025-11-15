/**
 * Database Configuration
 *
 * Defines DynamoDB table schemas for both Faux-SQL and Single-Table approaches.
 * Only one approach is active at a time, determined by the `approach` field.
 *
 * Faux-SQL Approach:
 * - Multiple tables (one per entity type)
 * - Descriptive key names (MerchantId, Category, etc.)
 * - Simple GSIs (one per access pattern)
 *
 * Single-Table Approach:
 * - One table for all entities
 * - Generic key names (PK, SK, GSI1PK, GSI1SK)
 * - Overloaded GSIs for multiple access patterns
 *
 * @module config/database
 */

import { AttributeType, ProjectionType } from "aws-cdk-lib/aws-dynamodb";

/**
 * Database approach selection
 */
export type DatabaseApproach = "faux-sql" | "single-table";

/**
 * Key attribute definition
 */
export interface IKeyAttribute {
  readonly name: string;
  readonly type: AttributeType;
}

/**
 * Global Secondary Index definition
 */
export interface IGsiDefinition {
  readonly indexName: string;
  readonly partitionKey: IKeyAttribute;
  readonly sortKey?: IKeyAttribute;
  readonly projectionType?: ProjectionType;
}

/**
 * Table definition for Faux-SQL approach
 */
export interface ITableDefinition {
  readonly tableName: string;
  readonly partitionKey: IKeyAttribute;
  readonly sortKey?: IKeyAttribute;
  readonly globalSecondaryIndexes?: IGsiDefinition[];
}

/**
 * Faux-SQL database configuration
 */
export interface IFauxSqlConfig {
  readonly tables: ITableDefinition[];
}

/**
 * Single-Table database configuration
 */
export interface ISingleTableConfig {
  readonly tableName?: string; // Optional override, defaults to service name
}

/**
 * Database configuration
 */
export interface IDatabaseConfig {
  readonly approach: DatabaseApproach;
  readonly fauxSql: IFauxSqlConfig;
  readonly singleTable: ISingleTableConfig;
}

/**
 * Database configuration for SMW Merchants microservice
 *
 * Current approach: Faux-SQL (multiple tables with descriptive keys)
 *
 * Tables:
 * - Merchants: Store merchant profile data
 *   - PK: MerchantId
 *   - GSI: CategoryIndex (Category + MerchantId) for browsing by category
 *
 * Future tables (as needed):
 * - Reviews: Merchant reviews and ratings
 * - Categories: Waste management categories
 * - Services: Merchant service offerings
 */
export const databaseConfig: IDatabaseConfig = {
  // Active approach: faux-sql or single-table
  approach: "faux-sql",

  // Faux-SQL configuration (active)
  fauxSql: {
    tables: [
      {
        tableName: "Merchants",
        partitionKey: {
          name: "MerchantId",
          type: AttributeType.STRING,
        },
        globalSecondaryIndexes: [
          {
            indexName: "GSI1",
            partitionKey: {
              name: "GSI1PK",
              type: AttributeType.STRING,
            },
            // No sort key - client-side sorting by distance
            projectionType: ProjectionType.ALL,
          },
        ],
      },
      // Add more tables here as needed:
      // {
      //   tableName: "Reviews",
      //   partitionKey: {
      //     name: "ReviewId",
      //     type: AttributeType.STRING,
      //   },
      //   sortKey: {
      //     name: "MerchantId",
      //     type: AttributeType.STRING,
      //   },
      //   globalSecondaryIndexes: [
      //     {
      //       indexName: "MerchantIndex",
      //       partitionKey: {
      //         name: "MerchantId",
      //         type: AttributeType.STRING,
      //       },
      //       sortKey: {
      //         name: "CreatedAt",
      //         type: AttributeType.STRING,
      //       },
      //     },
      //   ],
      // },
    ],
  },

  // Single-Table configuration (inactive, available for switching)
  singleTable: {
    // tableName: "CustomTableName", // Optional override
  },
};
