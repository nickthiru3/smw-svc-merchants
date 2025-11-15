/**
 * DynamoDB Faux-SQL Construct
 *
 * Creates DynamoDB tables using the Faux-SQL design approach:
 * - Separate table per entity type (vs single-table design)
 * - Descriptive key names (MerchantId, Category) vs generic (PK, SK)
 * - Simple GSIs (one per access pattern) vs overloaded GSIs
 * - Normalized data structure (SQL-like)
 *
 * Trade-offs:
 * - Higher latency (50-100ms vs 10ms for single-table)
 * - More expensive at scale (multiple tables)
 * - Simpler to understand and maintain
 * - Better for analytics and AI-assisted development
 * - Faster development iteration
 *
 * Architecture:
 * ```
 * DatabaseConstruct
 * ├── Creates multiple DynamoDB tables from config
 * ├── Each table has descriptive partition/sort keys
 * ├── Simple GSIs for specific access patterns
 * ├── Environment-based deletion protection
 * ├── Point-in-time recovery enabled
 * └── CloudFormation outputs for each table
 * ```
 *
 * @see docs/guides/data-modeling/faux-sql-design.md
 */

import { Construct } from "constructs";
import {
  TableV2,
  AttributeType,
  ProjectionType,
  type Attribute,
  type GlobalSecondaryIndexPropsV2,
} from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import type { IConfig } from "#config/default";

/**
 * Props for DdbFauxSqlConstruct
 *
 * @property config - Application configuration (includes database.fauxSql.tables)
 */
export interface IDdbFauxSqlConstructProps {
  readonly config: IConfig;
}

/**
 * Table definition for Faux-SQL approach
 *
 * @property tableName - Logical table name (e.g., "Merchants", "Reviews")
 * @property partitionKey - Primary partition key with descriptive name
 * @property sortKey - Optional sort key with descriptive name
 * @property globalSecondaryIndexes - Optional GSIs for alternate access patterns
 *
 * @example
 * ```typescript
 * {
 *   tableName: "Merchants",
 *   partitionKey: { name: "MerchantId", type: AttributeType.STRING },
 *   globalSecondaryIndexes: [{
 *     indexName: "CategoryIndex",
 *     partitionKey: { name: "Category", type: AttributeType.STRING },
 *     sortKey: { name: "MerchantId", type: AttributeType.STRING }
 *   }]
 * }
 * ```
 */
export interface ITableDefinition {
  readonly tableName: string;
  readonly partitionKey: IKeyAttribute;
  readonly sortKey?: IKeyAttribute;
  readonly globalSecondaryIndexes?: IGsiDefinition[];
}

/**
 * Key attribute definition
 *
 * @property name - Descriptive attribute name (e.g., "MerchantId", "Category")
 * @property type - DynamoDB attribute type (STRING, NUMBER, BINARY)
 */
export interface IKeyAttribute {
  readonly name: string;
  readonly type: AttributeType;
}

/**
 * Global Secondary Index definition
 *
 * @property indexName - Descriptive index name (e.g., "CategoryIndex")
 * @property partitionKey - GSI partition key
 * @property sortKey - Optional GSI sort key
 * @property projectionType - Projection type (default: ALL)
 *
 * @example
 * ```typescript
 * {
 *   indexName: "CategoryIndex",
 *   partitionKey: { name: "Category", type: AttributeType.STRING },
 *   sortKey: { name: "MerchantId", type: AttributeType.STRING },
 *   projectionType: ProjectionType.ALL
 * }
 * ```
 */
export interface IGsiDefinition {
  readonly indexName: string;
  readonly partitionKey: IKeyAttribute;
  readonly sortKey?: IKeyAttribute;
  readonly projectionType?: ProjectionType;
}

/**
 * DynamoDB Faux-SQL Construct
 *
 * Creates multiple DynamoDB tables with descriptive key names following
 * the Faux-SQL design pattern. Each table represents a single entity type
 * with simple, purpose-specific GSIs.
 *
 * Features:
 * - Multiple tables (one per entity)
 * - Descriptive keys (MerchantId vs PK)
 * - Simple GSIs (one per access pattern)
 * - Environment-based protection
 * - Point-in-time recovery
 * - CloudFormation outputs
 *
 * @example
 * ```typescript
 * const db = new DdbFauxSqlConstruct(this, "DdbFauxSql", {
 *   config,
 *   tables: [
 *     {
 *       tableName: "Merchants",
 *       partitionKey: { name: "MerchantId", type: AttributeType.STRING },
 *       globalSecondaryIndexes: [{
 *         indexName: "CategoryIndex",
 *         partitionKey: { name: "Category", type: AttributeType.STRING }
 *       }]
 *     }
 *   ]
 * });
 *
 * // Access tables
 * const merchantsTable = db.tables.get("Merchants");
 * ```
 */
class DdbFauxSqlConstruct extends Construct {
  /**
   * Map of table names to TableV2 instances
   *
   * Public property to allow other constructs to:
   * - Pass table names to Lambda environment variables
   * - Grant IAM permissions
   * - Create table streams
   *
   * @example
   * ```typescript
   * const merchantsTable = db.tables.get("Merchants");
   * lambda.addEnvironment("MERCHANTS_TABLE_NAME", merchantsTable.tableName);
   * merchantsTable.grantReadWriteData(lambda);
   * ```
   */
  public readonly tables: Map<string, TableV2>;

  /**
   * Primary table reference for backward compatibility
   *
   * Returns the first table in the tables map. This property exists
   * for backward compatibility with code expecting a single table.
   *
   * For multi-table access, use the `tables` Map instead.
   *
   * @deprecated Use `tables.get(tableName)` for explicit table access
   */
  public readonly table: TableV2;

  /**
   * Creates the DynamoDB Faux-SQL construct
   *
   * Orchestrates:
   * 1. Determine environment-based protection settings
   * 2. Create each table with descriptive keys
   * 3. Add GSIs for alternate access patterns
   * 4. Export CloudFormation outputs for cross-stack references
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IDdbFauxSqlConstructProps) {
    super(scope, id);

    const { config } = props;
    const tableDefinitions = config.database.fauxSql.tables;

    const envName = config.envName;
    const serviceName = config.service.name;

    // Protect data in production/staging; allow easy cleanup in dev/local
    const shouldProtectFromDeletion = envName !== "local" && envName !== "dev";

    // Initialize tables map
    this.tables = new Map<string, TableV2>();

    // Create each table
    for (const tableDef of tableDefinitions) {
      const table = this.createTable(
        tableDef,
        serviceName,
        shouldProtectFromDeletion
      );

      this.tables.set(tableDef.tableName, table);

      // Export table name and ARN for cross-stack references
      this.exportTableOutputs(table, tableDef.tableName, serviceName);
    }

    // Set primary table reference for backward compatibility (first table)
    const firstTable = this.tables.values().next().value;
    if (!firstTable) {
      throw new Error(
        "DatabaseConstruct requires at least one table definition"
      );
    }
    this.table = firstTable;
  }

  /**
   * Creates a DynamoDB table with Faux-SQL design
   *
   * Configuration:
   * - Descriptive partition key (e.g., MerchantId)
   * - Optional descriptive sort key
   * - Simple GSIs (one per access pattern)
   * - Point-in-time recovery enabled
   * - Environment-based deletion protection
   *
   * @param tableDef - Table definition with keys and GSIs
   * @param serviceName - Service name for table naming
   * @param shouldProtectFromDeletion - Whether to enable deletion protection
   * @returns Created TableV2 instance
   *
   * @private
   */
  private createTable(
    tableDef: ITableDefinition,
    serviceName: string,
    shouldProtectFromDeletion: boolean
  ): TableV2 {
    // Convert key attributes to CDK Attribute format
    const partitionKey: Attribute = {
      name: tableDef.partitionKey.name,
      type: tableDef.partitionKey.type,
    };

    const sortKey: Attribute | undefined = tableDef.sortKey
      ? {
          name: tableDef.sortKey.name,
          type: tableDef.sortKey.type,
        }
      : undefined;

    // Convert GSI definitions to CDK format
    const globalSecondaryIndexes: GlobalSecondaryIndexPropsV2[] | undefined =
      tableDef.globalSecondaryIndexes?.map((gsiDef) => ({
        indexName: gsiDef.indexName,
        partitionKey: {
          name: gsiDef.partitionKey.name,
          type: gsiDef.partitionKey.type,
        },
        sortKey: gsiDef.sortKey
          ? {
              name: gsiDef.sortKey.name,
              type: gsiDef.sortKey.type,
            }
          : undefined,
        projectionType: gsiDef.projectionType || ProjectionType.ALL,
      }));

    // Create DynamoDB table with Faux-SQL design pattern
    const table = new TableV2(this, `${tableDef.tableName}Table`, {
      tableName: `${serviceName}-${tableDef.tableName}`,
      partitionKey,
      sortKey,
      globalSecondaryIndexes,
      // Prevent accidental deletion in production/staging
      deletionProtection: shouldProtectFromDeletion,
      // Enable point-in-time recovery for all environments
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      // Retain table in production/staging, destroy in dev/local
      removalPolicy: shouldProtectFromDeletion
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });

    return table;
  }

  /**
   * Exports CloudFormation outputs for a table
   *
   * Exports:
   * - Table name (for Lambda environment variables)
   * - Table ARN (for IAM policy references)
   *
   * Export names follow pattern: `{serviceName}-{tableName}-{property}`
   *
   * @param table - TableV2 instance
   * @param tableName - Logical table name
   * @param serviceName - Service name for export naming
   *
   * @example
   * ```typescript
   * // Exports:
   * // - svc-merchants-Merchants-TableName
   * // - svc-merchants-Merchants-TableArn
   * ```
   *
   * @private
   */
  private exportTableOutputs(
    table: TableV2,
    tableName: string,
    serviceName: string
  ): void {
    // Export table name for cross-stack references and outputs.json
    new CfnOutput(this, `${tableName}TableName`, {
      value: table.tableName,
      description: `${tableName} DynamoDB table name`,
      exportName: `${serviceName}-${tableName}-TableName`,
    });

    // Export table ARN for IAM policy references
    new CfnOutput(this, `${tableName}TableArn`, {
      value: table.tableArn,
      description: `${tableName} DynamoDB table ARN`,
      exportName: `${serviceName}-${tableName}-TableArn`,
    });
  }
}

export default DdbFauxSqlConstruct;
