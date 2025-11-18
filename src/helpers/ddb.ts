/**
 * DynamoDB Client Utility
 *
 * Provides configured DynamoDB Document Client for data access operations.
 *
 * Features:
 * - Singleton pattern for connection reuse
 * - Environment-aware configuration (local vs AWS)
 * - Optimized marshalling options
 *
 * Usage:
 * ```typescript
 * import { getDocumentClient } from "#src/helpers/ddb";
 *
 * const client = getDocumentClient();
 * await client.send(new GetCommand({ ... }));
 * ```
 *
 * @see docs/implementation/data-access.md - DynamoDB client utility guide
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Singleton instance of DynamoDB Document Client
 *
 * Reused across Lambda invocations for connection pooling
 */
let docClient: DynamoDBDocumentClient | null = null;

/**
 * Create DynamoDB Document Client
 *
 * Configures client for local development or AWS environment:
 * - Local: Uses DYNAMODB_ENDPOINT environment variable
 * - AWS: Uses default AWS SDK configuration
 *
 * Marshalling options:
 * - convertEmptyValues: false - Reject empty strings/sets (DynamoDB constraint)
 * - removeUndefinedValues: true - Strip undefined values from requests
 *
 * @returns Configured DynamoDB Document Client
 *
 * @private
 */
function createDynamoDBClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    // Use local DynamoDB endpoint if specified (for testing)
    ...(process.env.DYNAMODB_ENDPOINT && {
      endpoint: process.env.DYNAMODB_ENDPOINT,
    }),
  });

  // Create Document Client with marshalling options
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      // Reject empty strings and sets (DynamoDB doesn't support them)
      convertEmptyValues: false,
      // Remove undefined values from requests
      removeUndefinedValues: true,
    },
  });
}

/**
 * Get DynamoDB Document Client
 *
 * Returns singleton instance, creating it if necessary.
 * Reuses connection across Lambda invocations for better performance.
 *
 * Environment Variables:
 * - AWS_REGION: AWS region (default: us-east-1)
 * - DYNAMODB_ENDPOINT: Local DynamoDB endpoint (optional, for testing)
 *
 * @returns DynamoDB Document Client instance
 *
 * @example
 * ```typescript
 * import { getDocumentClient } from "#src/helpers/ddb";
 * import { GetCommand } from "@aws-sdk/lib-dynamodb";
 *
 * const client = getDocumentClient();
 * const result = await client.send(
 *   new GetCommand({
 *     TableName: "Merchants",
 *     Key: { MerchantId: "merchant-123" }
 *   })
 * );
 * ```
 */
export function getDocumentClient(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = createDynamoDBClient();
  }
  return docClient;
}

/**
 * Reset Document Client
 *
 * Clears singleton instance, forcing recreation on next getDocumentClient() call.
 * Useful for testing with different configurations.
 *
 * @example
 * ```typescript
 * // In test setup
 * process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";
 * resetDocumentClient();
 * const client = getDocumentClient(); // Creates new client with local endpoint
 * ```
 */
export function resetDocumentClient(): void {
  docClient = null;
}
