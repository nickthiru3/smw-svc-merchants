/**
 * Integration Tests for GET /merchants/search Handler
 *
 * Tests the complete handler flow with mocked AWS services.
 *
 * Test Coverage:
 * - Successful query execution
 * - Validation errors (400)
 * - Configuration errors (500)
 * - Database errors (500)
 * - Request/response formatting
 *
 * @see lib/api/endpoints/merchants/search/handler.ts - Implementation
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "#lib/api/endpoints/merchants/search/handler";
import { PrimaryCategory } from "#src/types/merchant";

// Mock DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock console methods
const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

// Helper to create mock API Gateway event
function createMockEvent(
  queryStringParameters: Record<string, string> | null
): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/merchants/search",
    queryStringParameters,
    headers: {},
    multiValueHeaders: {},
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: "test-request-id",
      accountId: "123456789012",
      apiId: "test-api-id",
      protocol: "HTTP/1.1",
      httpMethod: "GET",
      path: "/merchants/search",
      stage: "test",
      requestTime: "01/Jan/2024:00:00:00 +0000",
      requestTimeEpoch: 1704067200000,
      identity: {
        sourceIp: "127.0.0.1",
        userAgent: "test-agent",
      } as any,
      domainName: "test.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "test",
    } as any,
    body: null,
    isBase64Encoded: false,
    resource: "/merchants/search",
  } as APIGatewayProxyEvent;
}

// Mock Lambda context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test",
  logStreamName: "2024/01/01/[$LATEST]test",
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe("GET /merchants/search Handler", () => {
  beforeEach(() => {
    ddbMock.reset();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    process.env.MERCHANTS_TABLE_NAME = "test-merchants-table";
  });

  afterEach(() => {
    delete process.env.MERCHANTS_TABLE_NAME;
  });

  describe("Successful Queries", () => {
    it("should return merchants for valid category", async () => {
      const mockMerchants = [
        {
          MerchantId: "merchant-1",
          GSI1PK: PrimaryCategory.REPAIR,
          LegalName: "Green Repair Shop",
          ShortDescription: "Expert electronics repair",
          PrimaryCategory: PrimaryCategory.REPAIR,
          Categories: ["Repair"],
          VerificationStatus: "Verified",
          PrimaryAddress: "123 Main St",
          City: "Toronto",
          State: "ON",
          PostalCode: "M5V 1A1",
          Latitude: 43.6532,
          Longitude: -79.3832,
          PhoneNumber: "+1-416-555-0001",
          Email: "shop1@example.com",
          RatingAverage: 4.5,
          RatingCount: 50,
          CreatedAt: "2024-01-15T10:30:00Z",
          UpdatedAt: "2024-10-28T14:22:00Z",
        },
        {
          MerchantId: "merchant-2",
          GSI1PK: PrimaryCategory.REPAIR,
          LegalName: "Fix-It Shop",
          ShortDescription: "Appliance repair specialists",
          PrimaryCategory: PrimaryCategory.REPAIR,
          Categories: ["Repair"],
          VerificationStatus: "Verified",
          PrimaryAddress: "456 Oak Ave",
          City: "Toronto",
          State: "ON",
          PostalCode: "M4B 2C3",
          Latitude: 43.68,
          Longitude: -79.35,
          PhoneNumber: "+1-416-555-0002",
          Email: "shop2@example.com",
          RatingAverage: 4.2,
          RatingCount: 30,
          CreatedAt: "2024-02-20T11:00:00Z",
          UpdatedAt: "2024-10-28T15:00:00Z",
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: mockMerchants });

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(response.body);
      expect(body.merchants).toHaveLength(2);
      expect(body.count).toBe(2);
      expect(body.category).toBe(PrimaryCategory.REPAIR);
      expect(body.merchants[0].legalName).toBe("Green Repair Shop");
      expect(body.merchants[1].legalName).toBe("Fix-It Shop");

      // Verify logging
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should return empty array when no merchants found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent({ category: PrimaryCategory.DONATE });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.merchants).toHaveLength(0);
      expect(body.count).toBe(0);
      expect(body.category).toBe(PrimaryCategory.DONATE);
    });

    it("should handle all valid category values", async () => {
      const validCategories = [
        PrimaryCategory.REPAIR,
        PrimaryCategory.REFILL,
        PrimaryCategory.RECYCLING,
        PrimaryCategory.DONATE,
      ];

      for (const category of validCategories) {
        ddbMock.on(QueryCommand).resolves({ Items: [] });

        const event = createMockEvent({ category });
        const response = await handler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.category).toBe(category);
      }
    });
  });

  describe("Validation Errors (400)", () => {
    it("should return 400 for missing category parameter", async () => {
      const event = createMockEvent(null);
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error).toContain("Invalid query parameters");
    });

    it("should return 400 for invalid category value", async () => {
      const event = createMockEvent({ category: "InvalidCategory" });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it("should return 400 for empty category string", async () => {
      const event = createMockEvent({ category: "" });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(400);
    });

    it("should not call DynamoDB for validation errors", async () => {
      const event = createMockEvent({ category: "InvalidCategory" });
      await handler(event, mockContext);

      // Verify DynamoDB was not called
      expect(ddbMock.commandCalls(QueryCommand).length).toBe(0);
    });
  });

  describe("Configuration Errors (500)", () => {
    it("should return 500 when MERCHANTS_TABLE_NAME is not set", async () => {
      delete process.env.MERCHANTS_TABLE_NAME;

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toContain("Internal server error");
    });

    it("should not call DynamoDB for configuration errors", async () => {
      delete process.env.MERCHANTS_TABLE_NAME;

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      await handler(event, mockContext);

      // Verify DynamoDB was not called
      expect(ddbMock.commandCalls(QueryCommand).length).toBe(0);
    });
  });

  describe("Database Errors (500)", () => {
    it("should return 500 for DynamoDB errors", async () => {
      ddbMock.on(QueryCommand).rejects(new Error("Database connection failed"));

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toContain("Internal server error");

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle DynamoDB timeout errors", async () => {
      ddbMock.on(QueryCommand).rejects(new Error("Request timeout"));

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(500);
    });

    it("should handle DynamoDB throttling errors", async () => {
      ddbMock
        .on(QueryCommand)
        .rejects(new Error("ProvisionedThroughputExceededException"));

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(500);
    });
  });

  describe("Request/Response Format", () => {
    it("should include correct Content-Type header", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(response.headers["Content-Type"]).toBe("application/json");
    });

    it("should return valid JSON in response body", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it("should include all required response fields", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      const response = await handler(event, mockContext);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("merchants");
      expect(body).toHaveProperty("count");
      expect(body).toHaveProperty("category");
    });
  });

  describe("Logging", () => {
    it("should log request received", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      await handler(event, mockContext);

      expect(consoleLogSpy).toHaveBeenCalled();
      const firstLog = consoleLogSpy.mock.calls[0][0] as string;
      const logData = JSON.parse(firstLog);
      expect(logData.message).toBe("Request received");
    });

    it("should log query success with metrics", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      await handler(event, mockContext);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // Request + Success
      const successLog = consoleLogSpy.mock.calls[1][0] as string;
      const logData = JSON.parse(successLog);
      expect(logData.message).toBe("Query executed successfully");
      expect(logData).toHaveProperty("duration");
    });

    it("should log errors with context", async () => {
      ddbMock.on(QueryCommand).rejects(new Error("Test error"));

      const event = createMockEvent({ category: PrimaryCategory.REPAIR });
      await handler(event, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][0] as string;
      const logData = JSON.parse(errorLog);
      expect(logData.level).toBe("ERROR");
      expect(logData.error.message).toBe("Test error");
    });
  });
});
