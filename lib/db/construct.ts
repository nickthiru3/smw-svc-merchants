/**
 * Database Construct (Facade)
 *
 * Entry point for database infrastructure. Instantiates either:
 * - DdbFauxSqlConstruct (multiple tables, descriptive keys)
 * - DdbSingleTableConstruct (single table, generic PK/SK keys)
 *
 * Approach is determined by config.database.approach.
 *
 * @module lib/db/construct
 */

import { Construct } from "constructs";
import type { IConfig } from "#config/default";
import DdbFauxSqlConstruct from "./faux-sql/construct";
import DdbSingleTableConstruct from "./single-table/construct";
import type { TableV2 } from "aws-cdk-lib/aws-dynamodb";

interface IDatabaseConstructProps {
  readonly config: IConfig;
}

/**
 * Database Construct
 *
 * Facade that instantiates the appropriate DynamoDB construct based on
 * config.database.approach ("faux-sql" or "single-table").
 *
 * Table configurations are defined in config/database.ts.
 */
class DatabaseConstruct extends Construct {
  /**
   * Primary table reference
   *
   * For Faux-SQL: Returns first table in tables map
   * For Single-Table: Returns the single table
   */
  public readonly table: TableV2;

  /**
   * Map of tables (Faux-SQL only)
   *
   * For Single-Table: undefined
   */
  public readonly tables?: Map<string, TableV2>;

  constructor(scope: Construct, id: string, props: IDatabaseConstructProps) {
    super(scope, id);

    const { config } = props;
    const { approach } = config.database;

    if (approach === "faux-sql") {
      // Faux-SQL Approach: Multiple tables with descriptive keys
      const db = new DdbFauxSqlConstruct(this, "DdbFauxSql", {
        config,
      });

      this.table = db.table;
      this.tables = db.tables;
    } else {
      // Single-Table Approach: One table with generic keys
      const db = new DdbSingleTableConstruct(this, "DdbSingleTable", {
        config,
      });

      this.table = db.table;
      this.tables = undefined;
    }
  }
}

export default DatabaseConstruct;
