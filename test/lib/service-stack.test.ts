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

import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { ServiceStack } from "#lib/service-stack";
import config from "#config/default";

/**
 * ServiceStack Infrastructure Tests
 *
 * Tests CDK template synthesis for the Merchants microservice.
 * Validates DynamoDB table configuration for Story 001: Browse Providers by Waste Category.
 *
 * Uses the actual application config from config/default.ts to ensure tests
 * validate the real configuration that will be deployed.
 *
 * Story 001 Requirements:
 * - Merchants table with MerchantId partition key
 * - GSI1 for category-based queries (GSI1PK = PrimaryCategory)
 * - Point-in-time recovery enabled
 * - Environment-based deletion protection
 *
 * @see docs/project/specs/stories/consumers/browse-providers-by-waste-category
 * @see docs/project/specs/entities/merchants.md
 */
describe("ServiceStack (infrastructure)", () => {
  let app: cdk.App;
  let stack: ServiceStack;

  // Use actual config values
  const envName = config.envName;
  const account = config.accountId;
  const region = config.region;
  const serviceName = config.service.name;

  beforeEach(() => {
    app = new cdk.App();
    stack = new ServiceStack(app, `${envName}-${serviceName}-ServiceStack`, {
      env: { account, region },
      config, // Use actual config object
    });
  });

  /**
   * Configuration Validation
   *
   * Validates that the application config is correctly set up for Story 001.
   */
  describe("Configuration", () => {
    test("uses Faux-SQL database approach", () => {
      expect(config.database.approach).toBe("faux-sql");
    });

    test("defines Merchants table in config", () => {
      const merchantsTable = config.database.fauxSql.tables.find(
        (table) => table.tableName === "Merchants"
      );

      expect(merchantsTable).toBeDefined();
      expect(merchantsTable?.partitionKey.name).toBe("MerchantId");
    });

    test("configures GSI1 for category queries in config", () => {
      const merchantsTable = config.database.fauxSql.tables.find(
        (table) => table.tableName === "Merchants"
      );

      const gsi1 = merchantsTable?.globalSecondaryIndexes?.find(
        (gsi) => gsi.indexName === "GSI1"
      );

      expect(gsi1).toBeDefined();
      expect(gsi1?.partitionKey.name).toBe("GSI1PK");
    });
  });

  /**
   * Database Tests - Story 001: Browse Providers by Waste Category
   *
   * Tests DynamoDB table configuration for the Merchants entity using Faux-SQL approach.
   *
   * Requirements:
   * - Merchants table with descriptive partition key (MerchantId)
   * - GSI1 for category queries (GSI1PK = PrimaryCategory)
   * - Point-in-time recovery enabled
   * - Environment-based deletion protection
   * - CloudFormation outputs for table name and ARN
   */
  describe("Database - Merchants Table (Faux-SQL)", () => {
    test("creates Merchants table with MerchantId partition key", () => {
      const template = Template.fromStack(stack);

      // Merchants table should exist
      template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);

      // Table should have MerchantId as partition key (no sort key)
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        KeySchema: [{ AttributeName: "MerchantId", KeyType: "HASH" }],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: "MerchantId", AttributeType: "S" },
        ]),
      });
    });

    test("configures GSI1 for category-based queries", () => {
      const template = Template.fromStack(stack);

      // GSI1 should exist with GSI1PK partition key (no sort key)
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        GlobalSecondaryIndexes: [
          Match.objectLike({
            IndexName: "GSI1",
            KeySchema: [{ AttributeName: "GSI1PK", KeyType: "HASH" }],
            Projection: {
              ProjectionType: "ALL",
            },
          }),
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: "GSI1PK", AttributeType: "S" },
        ]),
      });
    });

    test("enables point-in-time recovery for data protection", () => {
      const template = Template.fromStack(stack);

      // PITR should be enabled
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        Replicas: Match.arrayWith([
          Match.objectLike({
            PointInTimeRecoverySpecification: {
              PointInTimeRecoveryEnabled: true,
            },
          }),
        ]),
      });
    });

    test("disables deletion protection for dev environment", () => {
      const template = Template.fromStack(stack);

      // Dev environment should NOT have deletion protection
      // (allows easy cleanup during development)
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        Replicas: Match.arrayWith([
          Match.objectLike({
            DeletionProtectionEnabled: false,
          }),
        ]),
      });
    });

    test("exports Merchants table name for Lambda environment variables", () => {
      const template = Template.fromStack(stack);

      const templateJson = template.toJSON();
      const outputs = Object.values(templateJson.Outputs ?? {}) as Array<{
        readonly Export?: { readonly Name?: string };
        readonly Value?: any;
      }>;

      // Find Merchants table name export
      const merchantsTableExport = outputs.find(
        (output) => output.Export?.Name === `${serviceName}-Merchants-TableName`
      );

      expect(merchantsTableExport).toBeDefined();
      // Value is a CloudFormation reference, just verify it exists
      expect(merchantsTableExport?.Value).toBeDefined();
    });

    test("exports Merchants table ARN for IAM policies", () => {
      const template = Template.fromStack(stack);

      const templateJson = template.toJSON();
      const outputs = Object.values(templateJson.Outputs ?? {}) as Array<{
        readonly Export?: { readonly Name?: string };
      }>;

      // Find Merchants table ARN export
      const merchantsTableArnExport = outputs.find(
        (output) => output.Export?.Name === `${serviceName}-Merchants-TableArn`
      );

      expect(merchantsTableArnExport).toBeDefined();
    });

    test("uses correct table naming convention", () => {
      const template = Template.fromStack(stack);

      // Table name should follow pattern: {serviceName}-{tableName}
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        TableName: `${serviceName}-Merchants`,
      });
    });
  });

  /**
   * Database Approach Validation
   *
   * Ensures the correct database approach (Faux-SQL) is being used.
   */
  describe("Database Approach", () => {
    test("uses Faux-SQL approach with descriptive key names", () => {
      const template = Template.fromStack(stack);

      // Should have descriptive keys (MerchantId, GSI1PK)
      // NOT generic keys (PK, SK, GSI1PK, GSI1SK)
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: "MerchantId", AttributeType: "S" },
          { AttributeName: "GSI1PK", AttributeType: "S" },
        ]),
      });

      // Should NOT have generic PK/SK keys
      const templateJson = template.toJSON();
      const tables = Object.values(templateJson.Resources ?? {}).filter(
        (resource: any) => resource.Type === "AWS::DynamoDB::GlobalTable"
      );

      tables.forEach((table: any) => {
        const attrNames = table.Properties.AttributeDefinitions.map(
          (attr: any) => attr.AttributeName
        );
        expect(attrNames).not.toContain("PK");
        expect(attrNames).not.toContain("SK");
      });
    });

    test("creates exactly one table for Merchants entity", () => {
      const template = Template.fromStack(stack);

      // Faux-SQL approach: one table per entity
      // Story 001 only requires Merchants table
      template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
    });
  });
});
