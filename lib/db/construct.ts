/**
 * Database Infrastructure
 *
 * Creates DynamoDB table for storing user profile data with:
 * - Single table design pattern
 * - Global Secondary Index (GSI1) for alternate access patterns
 * - Point-in-time recovery enabled
 * - Environment-based deletion protection
 *
 * Table Schema:
 * - PK (Partition Key): Primary entity identifier
 * - SK (Sort Key): Entity type or relationship
 * - GSI1PK: Alternate partition key for GSI1
 * - GSI1SK: Alternate sort key for GSI1
 *
 * @module lib/db/construct
 */

import { RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  TableV2,
  AttributeType,
  ProjectionType,
} from "aws-cdk-lib/aws-dynamodb";
import type { IConfig } from "#config/default";

/**
 * Props for DatabaseConstruct
 *
 * @property config - Application configuration object
 */
export interface IDatabaseConstructProps {
  readonly config: IConfig;
}

/**
 * Database Construct
 *
 * Creates DynamoDB table for user profile data storage.
 * Uses single table design pattern with one GSI for flexible access patterns.
 *
 * Table Configuration:
 * - Billing: On-demand (pay per request)
 * - PITR: Enabled (point-in-time recovery)
 * - Deletion Protection: Enabled for staging/production
 * - Removal Policy: RETAIN for staging/production, DESTROY for dev/local
 *
 * Access Patterns:
 * - Primary: Query by PK and SK
 * - GSI1: Query by GSI1PK and GSI1SK
 *
 * @example
 * // Create database construct
 * const db = new DatabaseConstruct(this, 'DatabaseConstruct', {
 *   config: appConfig
 * });
 *
 * // Use table in Lambda
 * new NodejsFunction(this, 'Function', {
 *   environment: {
 *     TABLE_NAME: db.table.tableName
 *   }
 * });
 *
 * // Grant permissions
 * db.table.grantReadWriteData(lambdaFunction);
 */
class DatabaseConstruct extends Construct {
  /**
   * DynamoDB table for user data
   *
   * Public property to allow other constructs to:
   * - Pass table name to Lambda environment variables
   * - Grant IAM permissions
   * - Create table streams
   */
  public readonly table: TableV2;

  /**
   * Creates the database construct
   *
   * Creates DynamoDB table with:
   * - Single table design (PK, SK)
   * - One Global Secondary Index (GSI1)
   * - Point-in-time recovery
   * - Environment-based protection settings
   * - CloudFormation outputs for table name and ARN
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IDatabaseConstructProps) {
    super(scope, id);

    const { config } = props;

    const envName = config.envName;
    const serviceName = config.service.name;

    // Protect data in production/staging; allow easy cleanup in dev/local
    const shouldProtectFromDeletion = envName !== "local" && envName !== "dev";

    // Create DynamoDB table with single table design pattern
    this.table = new TableV2(this, "Table", {
      // Primary key: PK (partition) + SK (sort)
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: AttributeType.STRING,
      },
      // Global Secondary Index for alternate access patterns
      globalSecondaryIndexes: [
        {
          indexName: "GSI1",
          partitionKey: {
            name: "GSI1PK",
            type: AttributeType.STRING,
          },
          sortKey: {
            name: "GSI1SK",
            type: AttributeType.STRING,
          },
          projectionType: ProjectionType.ALL,
        },
      ],
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

    const tableName = this.table.tableName;
    const tableArn = this.table.tableArn;

    // Export table name for cross-stack references and outputs.json
    new CfnOutput(this, "TableName", {
      value: tableName,
      description: "DynamoDB table name",
      exportName: `${serviceName}-TableName`,
    });

    // Export table ARN for IAM policy references
    new CfnOutput(this, "TableArn", {
      value: tableArn,
      description: "DynamoDB table ARN",
      exportName: `${serviceName}-TableArn`,
    });
  }
}

export default DatabaseConstruct;
