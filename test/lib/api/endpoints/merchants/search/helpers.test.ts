/**
 * Unit Tests for GET /merchants/search Helpers
 *
 * Tests business logic and helper functions in isolation.
 *
 * Test Coverage:
 * - Input parsing and validation
 * - Environment variable validation
 * - Query execution (mocked)
 * - Response formatting
 * - Error handling
 *
 * @see lib/api/endpoints/merchants/search/helpers.ts - Implementation
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  parseAndValidateQueryParams,
  getRequiredEnv,
  queryMerchants,
  prepareSuccessResponse,
  prepareErrorResponse,
  logEventReceived,
  logQuerySuccess,
} from "#lib/api/endpoints/merchants/search/helpers";
import { PrimaryCategory } from "#src/types/merchant";

// Mock DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock console methods
const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

describe("GET /merchants/search - Helpers", () => {
  beforeEach(() => {
    ddbMock.reset();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    process.env.MERCHANTS_TABLE_NAME = "test-merchants-table";
  });

  afterEach(() => {
    delete process.env.MERCHANTS_TABLE_NAME;
  });

  describe("parseAndValidateQueryParams", () => {
    it("should parse valid category parameter", () => {
      const event = {
        queryStringParameters: {
          category: PrimaryCategory.REPAIR,
        },
      } as Partial<APIGatewayProxyEvent>;

      const result = parseAndValidateQueryParams(event as APIGatewayProxyEvent);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.category).toBe(PrimaryCategory.REPAIR);
      }
    });

    it("should accept all valid category values", () => {
      const validCategories = [
        PrimaryCategory.REPAIR,
        PrimaryCategory.REFILL,
        PrimaryCategory.RECYCLING,
        PrimaryCategory.DONATE,
      ];

      validCategories.forEach((category) => {
        const event = {
          queryStringParameters: { category },
        } as Partial<APIGatewayProxyEvent>;

        const result = parseAndValidateQueryParams(
          event as APIGatewayProxyEvent
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.category).toBe(category);
        }
      });
    });

    it("should return error for missing category parameter", () => {
      const event = {
        queryStringParameters: null,
      } as Partial<APIGatewayProxyEvent>;

      const result = parseAndValidateQueryParams(event as APIGatewayProxyEvent);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.statusCode).toBe(400);
        const body = JSON.parse(result.response.body);
        expect(body.error).toBeDefined();
      }
    });

    it("should return error for invalid category value", () => {
      const event = {
        queryStringParameters: {
          category: "InvalidCategory",
        },
      } as Partial<APIGatewayProxyEvent>;

      const result = parseAndValidateQueryParams(event as APIGatewayProxyEvent);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.statusCode).toBe(400);
        const body = JSON.parse(result.response.body);
        expect(body.error).toContain("Invalid query parameters");
      }
    });

    it("should return error for empty category string", () => {
      const event = {
        queryStringParameters: {
          category: "",
        },
      } as Partial<APIGatewayProxyEvent>;

      const result = parseAndValidateQueryParams(event as APIGatewayProxyEvent);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.statusCode).toBe(400);
      }
    });
  });

  describe("getRequiredEnv", () => {
    it("should return table name when environment variable is set", () => {
      process.env.MERCHANTS_TABLE_NAME = "test-table";

      const result = getRequiredEnv();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tableName).toBe("test-table");
      }
    });

    it("should return error when MERCHANTS_TABLE_NAME is not set", () => {
      delete process.env.MERCHANTS_TABLE_NAME;

      const result = getRequiredEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.statusCode).toBe(500);
        const body = JSON.parse(result.response.body);
        expect(body.error).toContain("Internal server error");
      }
    });

    it("should return error when MERCHANTS_TABLE_NAME is empty string", () => {
      process.env.MERCHANTS_TABLE_NAME = "";

      const result = getRequiredEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.statusCode).toBe(500);
      }
    });
  });

  describe("queryMerchants", () => {
    it("should query merchants by category and return results", async () => {
      const mockMerchants = [
        {
          MerchantId: "merchant-1",
          GSI1PK: PrimaryCategory.REPAIR,
          LegalName: "Repair Shop 1",
          ShortDescription: "First repair shop",
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
      ];

      ddbMock.on(QueryCommand).resolves({ Items: mockMerchants });

      const result = await queryMerchants(PrimaryCategory.REPAIR);

      expect(result.merchants).toHaveLength(1);
      expect(result.count).toBe(1);
      expect(result.category).toBe(PrimaryCategory.REPAIR);
      expect(result.merchants[0].legalName).toBe("Repair Shop 1");
    });

    it("should return empty array when no merchants found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await queryMerchants(PrimaryCategory.DONATE);

      expect(result.merchants).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.category).toBe(PrimaryCategory.DONATE);
    });

    it("should handle undefined Items in DynamoDB response", async () => {
      ddbMock.on(QueryCommand).resolves({});

      const result = await queryMerchants(PrimaryCategory.REFILL);

      expect(result.merchants).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it("should propagate DynamoDB errors", async () => {
      ddbMock.on(QueryCommand).rejects(new Error("Database connection failed"));

      await expect(queryMerchants(PrimaryCategory.REPAIR)).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  describe("prepareSuccessResponse", () => {
    it("should format success response with 200 status", () => {
      const data = {
        merchants: [],
        count: 0,
        category: PrimaryCategory.REPAIR,
      };

      const response = prepareSuccessResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(response.body);
      expect(body.merchants).toEqual([]);
      expect(body.count).toBe(0);
      expect(body.category).toBe(PrimaryCategory.REPAIR);
    });

    it("should include all merchant data in response", () => {
      const mockMerchant = {
        merchantId: "merchant-1",
        legalName: "Test Shop",
        tradingName: "Test",
        shortDescription: "A test shop",
        primaryCategory: PrimaryCategory.REPAIR,
        categories: ["Repair"],
        verificationStatus: "Verified" as const,
        location: {
          address: "123 Main St",
          city: "Toronto",
          state: "ON",
          postalCode: "M5V 1A1",
          latitude: 43.6532,
          longitude: -79.3832,
        },
        contact: {
          phoneNumber: "+1-416-555-0001",
          email: "test@example.com",
        },
        rating: {
          average: 4.5,
          count: 10,
        },
        createdAt: "2024-01-15T10:30:00Z",
        updatedAt: "2024-10-28T14:22:00Z",
      };

      const data = {
        merchants: [mockMerchant],
        count: 1,
        category: PrimaryCategory.REPAIR,
      };

      const response = prepareSuccessResponse(data);
      const body = JSON.parse(response.body);

      expect(body.merchants[0]).toEqual(mockMerchant);
    });
  });

  describe("prepareErrorResponse", () => {
    it("should format error response with 500 status", () => {
      const error = new Error("Test error");
      const response = prepareErrorResponse(error, "test-request-id");

      expect(response.statusCode).toBe(500);
      expect(response.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(response.body);
      expect(body.error).toContain("Internal server error");
    });

    it("should log error to console", () => {
      const error = new Error("Test error");
      prepareErrorResponse(error, "test-request-id");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(loggedData.level).toBe("ERROR");
      expect(loggedData.error.message).toBe("Test error");
      expect(loggedData.requestId).toBe("test-request-id");
    });

    it("should handle non-Error objects", () => {
      const error = "String error";
      const response = prepareErrorResponse(error, "test-request-id");

      expect(response.statusCode).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("logEventReceived", () => {
    it("should log request metadata", () => {
      const event = {
        httpMethod: "GET",
        path: "/merchants/search",
        queryStringParameters: { category: "Repair" },
        requestContext: {
          requestId: "test-request-id",
        },
      } as Partial<APIGatewayProxyEvent>;

      logEventReceived(event as APIGatewayProxyEvent);

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(loggedData.level).toBe("INFO");
      expect(loggedData.message).toBe("Request received");
      expect(loggedData.requestId).toBe("test-request-id");
      expect(loggedData.httpMethod).toBe("GET");
      expect(loggedData.path).toBe("/merchants/search");
    });
  });

  describe("logQuerySuccess", () => {
    it("should log query success with metrics", () => {
      logQuerySuccess("Repair", 10, "test-request-id", 150);

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(loggedData.level).toBe("INFO");
      expect(loggedData.message).toBe("Query executed successfully");
      expect(loggedData.category).toBe("Repair");
      expect(loggedData.resultCount).toBe(10);
      expect(loggedData.duration).toBe(150);
      expect(loggedData.requestId).toBe("test-request-id");
    });
  });
});
