/**
 * Merchant Data Access Layer Tests
 *
 * Unit tests for merchant CRUD operations and query functions.
 * Uses mocked DynamoDB client for isolated testing.
 *
 * Test Coverage:
 * - Transform functions (toItem/fromItem)
 * - Create merchant
 * - Get merchant by ID
 * - Update merchant
 * - Delete merchant
 * - Search merchants by category
 *
 * @see src/data-access/merchants.ts - Implementation
 */

import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  createMerchant,
  getMerchantById,
  updateMerchant,
  deleteMerchant,
  searchMerchantsByCategory,
} from "#src/data-access/merchants";
import { PrimaryCategory, MerchantStatus } from "#src/types/merchant";
import type {
  CreateMerchantInput,
  UpdateMerchantInput,
} from "#src/types/merchant";

// Mock DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Test data
const mockLocation = {
  address: "123 Main St",
  city: "Toronto",
  state: "ON",
  postalCode: "M5V 1A1",
  latitude: 43.6532,
  longitude: -79.3832,
};

const mockContact = {
  phoneNumber: "+1-416-555-0123",
  email: "contact@greenrepair.com",
  websiteUrl: "https://greenrepair.com",
};

const mockServices = [
  {
    name: "Electronics Repair",
    description: "Smartphones, laptops, tablets",
  },
];

const mockOperatingHours = [
  {
    dayOfWeek: "Monday",
    openTime: "09:00",
    closeTime: "17:00",
  },
];

describe("Merchant Data Access Layer", () => {
  beforeEach(() => {
    // Reset mock before each test
    ddbMock.reset();
    // Set table name for tests
    process.env.MERCHANTS_TABLE_NAME = "test-merchants-table";
  });

  afterEach(() => {
    delete process.env.MERCHANTS_TABLE_NAME;
  });

  describe("createMerchant", () => {
    it("should create a merchant with generated ID and timestamps", async () => {
      // Mock successful PutCommand
      ddbMock.on(PutCommand).resolves({});

      const input: CreateMerchantInput = {
        legalName: "Green Repair Shop",
        tradingName: "Green Repair",
        shortDescription: "Expert electronics and appliance repair",
        primaryCategory: PrimaryCategory.REPAIR,
        categories: ["Repair", "Recycling"],
        location: mockLocation,
        contact: mockContact,
        services: mockServices,
        operatingHours: mockOperatingHours,
      };

      const merchant = await createMerchant(ddbMock as any, input);

      // Verify merchant structure
      expect(merchant.merchantId).toBeDefined();
      expect(merchant.legalName).toBe(input.legalName);
      expect(merchant.tradingName).toBe(input.tradingName);
      expect(merchant.primaryCategory).toBe(input.primaryCategory);
      expect(merchant.verificationStatus).toBe(MerchantStatus.PENDING);
      expect(merchant.rating).toEqual({ average: 0, count: 0 });
      expect(merchant.createdAt).toBeDefined();
      expect(merchant.updatedAt).toBeDefined();
      expect(merchant.createdAt).toBe(merchant.updatedAt);

      // Verify PutCommand was called
      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.TableName).toBe("test-merchants-table");
      expect(calls[0].args[0].input.ConditionExpression).toBe(
        "attribute_not_exists(MerchantId)"
      );
    });

    it("should create merchant with minimal required fields", async () => {
      ddbMock.on(PutCommand).resolves({});

      const input: CreateMerchantInput = {
        legalName: "Simple Shop",
        shortDescription: "A simple shop",
        primaryCategory: PrimaryCategory.REFILL,
        categories: ["Refill"],
        location: mockLocation,
        contact: mockContact,
      };

      const merchant = await createMerchant(ddbMock as any, input);

      expect(merchant.merchantId).toBeDefined();
      expect(merchant.tradingName).toBeUndefined();
      expect(merchant.services).toBeUndefined();
      expect(merchant.operatingHours).toBeUndefined();
    });

    it("should store category value in GSI1PK", async () => {
      ddbMock.on(PutCommand).resolves({});

      const input: CreateMerchantInput = {
        legalName: "Recycling Center",
        shortDescription: "Local recycling",
        primaryCategory: PrimaryCategory.RECYCLING,
        categories: ["Recycling"],
        location: mockLocation,
        contact: mockContact,
      };

      await createMerchant(ddbMock as any, input);

      const calls = ddbMock.commandCalls(PutCommand);
      const item = calls[0].args[0].input.Item;
      expect(item.GSI1PK).toBe(PrimaryCategory.RECYCLING);
      expect(item.PrimaryCategory).toBe(PrimaryCategory.RECYCLING);
    });
  });

  describe("getMerchantById", () => {
    it("should return merchant when found", async () => {
      const mockItem = {
        MerchantId: "merchant-123",
        GSI1PK: PrimaryCategory.REPAIR,
        LegalName: "Green Repair Shop",
        ShortDescription: "Expert repair",
        PrimaryCategory: PrimaryCategory.REPAIR,
        Categories: ["Repair"],
        VerificationStatus: MerchantStatus.VERIFIED,
        PrimaryAddress: mockLocation.address,
        City: mockLocation.city,
        State: mockLocation.state,
        PostalCode: mockLocation.postalCode,
        Latitude: mockLocation.latitude,
        Longitude: mockLocation.longitude,
        PhoneNumber: mockContact.phoneNumber,
        Email: mockContact.email,
        WebsiteUrl: mockContact.websiteUrl,
        RatingAverage: 4.5,
        RatingCount: 127,
        CreatedAt: "2024-01-15T10:30:00Z",
        UpdatedAt: "2024-10-28T14:22:00Z",
      };

      ddbMock.on(GetCommand).resolves({ Item: mockItem });

      const merchant = await getMerchantById(ddbMock as any, "merchant-123");

      expect(merchant).not.toBeNull();
      expect(merchant!.merchantId).toBe("merchant-123");
      expect(merchant!.legalName).toBe("Green Repair Shop");
      expect(merchant!.primaryCategory).toBe(PrimaryCategory.REPAIR);
      expect(merchant!.location.city).toBe("Toronto");
      expect(merchant!.contact.email).toBe("contact@greenrepair.com");
      expect(merchant!.rating.average).toBe(4.5);

      // Verify GetCommand was called correctly
      const calls = ddbMock.commandCalls(GetCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.Key).toEqual({
        MerchantId: "merchant-123",
      });
    });

    it("should return null when merchant not found", async () => {
      ddbMock.on(GetCommand).resolves({});

      const merchant = await getMerchantById(ddbMock as any, "nonexistent");

      expect(merchant).toBeNull();
    });
  });

  describe("updateMerchant", () => {
    it("should update merchant with partial data", async () => {
      const updatedItem = {
        MerchantId: "merchant-123",
        GSI1PK: PrimaryCategory.REPAIR,
        LegalName: "Green Repair Shop",
        ShortDescription: "Updated description",
        PrimaryCategory: PrimaryCategory.REPAIR,
        Categories: ["Repair"],
        VerificationStatus: MerchantStatus.VERIFIED,
        PrimaryAddress: mockLocation.address,
        City: mockLocation.city,
        State: mockLocation.state,
        PostalCode: mockLocation.postalCode,
        Latitude: mockLocation.latitude,
        Longitude: mockLocation.longitude,
        PhoneNumber: mockContact.phoneNumber,
        Email: mockContact.email,
        RatingAverage: 4.5,
        RatingCount: 127,
        CreatedAt: "2024-01-15T10:30:00Z",
        UpdatedAt: new Date().toISOString(),
      };

      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedItem });

      const input: UpdateMerchantInput = {
        merchantId: "merchant-123",
        shortDescription: "Updated description",
        verificationStatus: MerchantStatus.VERIFIED,
      };

      const merchant = await updateMerchant(ddbMock as any, input);

      expect(merchant.merchantId).toBe("merchant-123");
      expect(merchant.shortDescription).toBe("Updated description");
      expect(merchant.verificationStatus).toBe(MerchantStatus.VERIFIED);

      // Verify UpdateCommand was called
      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.Key).toEqual({
        MerchantId: "merchant-123",
      });
      expect(calls[0].args[0].input.ConditionExpression).toBe(
        "attribute_exists(MerchantId)"
      );
      expect(calls[0].args[0].input.ReturnValues).toBe("ALL_NEW");
    });

    it("should update GSI1PK when primary category changes", async () => {
      const updatedItem = {
        MerchantId: "merchant-123",
        GSI1PK: PrimaryCategory.RECYCLING,
        LegalName: "Green Shop",
        ShortDescription: "Now recycling too",
        PrimaryCategory: PrimaryCategory.RECYCLING,
        Categories: ["Recycling"],
        VerificationStatus: MerchantStatus.VERIFIED,
        PrimaryAddress: mockLocation.address,
        City: mockLocation.city,
        State: mockLocation.state,
        PostalCode: mockLocation.postalCode,
        Latitude: mockLocation.latitude,
        Longitude: mockLocation.longitude,
        PhoneNumber: mockContact.phoneNumber,
        Email: mockContact.email,
        RatingAverage: 0,
        RatingCount: 0,
        CreatedAt: "2024-01-15T10:30:00Z",
        UpdatedAt: new Date().toISOString(),
      };

      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedItem });

      const input: UpdateMerchantInput = {
        merchantId: "merchant-123",
        primaryCategory: PrimaryCategory.RECYCLING,
      };

      await updateMerchant(ddbMock as any, input);

      const calls = ddbMock.commandCalls(UpdateCommand);
      const updateExpression = calls[0].args[0].input.UpdateExpression;
      expect(updateExpression).toContain("#primaryCategory");
      expect(updateExpression).toContain("#gsi1pk");
    });

    it("should update location fields", async () => {
      const newLocation = {
        address: "456 New St",
        city: "Vancouver",
        state: "BC",
        postalCode: "V6B 1A1",
        latitude: 49.2827,
        longitude: -123.1207,
      };

      const updatedItem = {
        MerchantId: "merchant-123",
        GSI1PK: PrimaryCategory.REPAIR,
        LegalName: "Green Repair Shop",
        ShortDescription: "Expert repair",
        PrimaryCategory: PrimaryCategory.REPAIR,
        Categories: ["Repair"],
        VerificationStatus: MerchantStatus.VERIFIED,
        PrimaryAddress: newLocation.address,
        City: newLocation.city,
        State: newLocation.state,
        PostalCode: newLocation.postalCode,
        Latitude: newLocation.latitude,
        Longitude: newLocation.longitude,
        PhoneNumber: mockContact.phoneNumber,
        Email: mockContact.email,
        RatingAverage: 0,
        RatingCount: 0,
        CreatedAt: "2024-01-15T10:30:00Z",
        UpdatedAt: new Date().toISOString(),
      };

      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedItem });

      const input: UpdateMerchantInput = {
        merchantId: "merchant-123",
        location: newLocation,
      };

      const merchant = await updateMerchant(ddbMock as any, input);

      expect(merchant.location.city).toBe("Vancouver");
      expect(merchant.location.latitude).toBe(49.2827);
    });
  });

  describe("deleteMerchant", () => {
    it("should delete merchant by ID", async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await deleteMerchant(ddbMock as any, "merchant-123");

      const calls = ddbMock.commandCalls(DeleteCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.Key).toEqual({
        MerchantId: "merchant-123",
      });
      expect(calls[0].args[0].input.ConditionExpression).toBe(
        "attribute_exists(MerchantId)"
      );
    });
  });

  describe("searchMerchantsByCategory", () => {
    it("should return all merchants in category", async () => {
      const mockItems = [
        {
          MerchantId: "merchant-1",
          GSI1PK: PrimaryCategory.REPAIR,
          LegalName: "Repair Shop 1",
          ShortDescription: "First repair shop",
          PrimaryCategory: PrimaryCategory.REPAIR,
          Categories: ["Repair"],
          VerificationStatus: MerchantStatus.VERIFIED,
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
          LegalName: "Repair Shop 2",
          ShortDescription: "Second repair shop",
          PrimaryCategory: PrimaryCategory.REPAIR,
          Categories: ["Repair"],
          VerificationStatus: MerchantStatus.VERIFIED,
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

      ddbMock.on(QueryCommand).resolves({ Items: mockItems });

      const result = await searchMerchantsByCategory(
        ddbMock as any,
        PrimaryCategory.REPAIR
      );

      expect(result.merchants).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.category).toBe(PrimaryCategory.REPAIR);
      expect(result.merchants[0].legalName).toBe("Repair Shop 1");
      expect(result.merchants[1].legalName).toBe("Repair Shop 2");

      // Verify QueryCommand was called correctly
      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.TableName).toBe("test-merchants-table");
      expect(calls[0].args[0].input.IndexName).toBe("GSI1");
      expect(calls[0].args[0].input.KeyConditionExpression).toBe(
        "GSI1PK = :category"
      );
      expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({
        ":category": PrimaryCategory.REPAIR,
      });
    });

    it("should return empty array when no merchants found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await searchMerchantsByCategory(
        ddbMock as any,
        PrimaryCategory.DONATE
      );

      expect(result.merchants).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.category).toBe(PrimaryCategory.DONATE);
    });

    it("should handle undefined Items in response", async () => {
      ddbMock.on(QueryCommand).resolves({});

      const result = await searchMerchantsByCategory(
        ddbMock as any,
        PrimaryCategory.REFILL
      );

      expect(result.merchants).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });
});
