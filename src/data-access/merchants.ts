/**
 * Merchant Data Access Layer
 *
 * Implements CRUD operations and access patterns for the Merchant entity.
 *
 * Design Artifacts:
 * - Entity file: docs/project/specs/entities/merchants.md
 * - Actions & Queries: docs/project/specs/stories/consumers/browse-providers-by-waste-category/actions-queries.md
 *
 * Access Patterns:
 * 1. Get merchant by ID (Main table, GetItem)
 * 2. Search merchants by category (GSI1, Query)
 *
 * @see docs/implementation/data-access.md - Data access layer guide
 * @see docs/project/specs/entities/merchants.md - Entity specification
 */

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import type {
  Merchant,
  MerchantItem,
  CreateMerchantInput,
  UpdateMerchantInput,
  SearchMerchantsResult,
  PrimaryCategory,
} from "#src/types/merchant";
import { MerchantStatus } from "#src/types/merchant";

/**
 * Get table name from environment
 *
 * Table name is injected by CDK as environment variable.
 * Function ensures environment variable is read at runtime, not module load time.
 *
 * @returns Table name from environment or default
 */
function getTableName(): string {
  return process.env.MERCHANTS_TABLE_NAME || "svc-merchants-Merchants";
}

/**
 * Transform domain entity to DynamoDB item
 *
 * Converts application-level Merchant to database-level MerchantItem.
 * Maps camelCase to PascalCase and adds DynamoDB keys.
 *
 * @param merchant - Domain entity
 * @returns DynamoDB item with keys
 *
 * @private
 */
function toItem(merchant: Merchant): MerchantItem {
  return {
    // Primary key
    MerchantId: merchant.merchantId,

    // GSI1 attributes (for category queries)
    GSI1PK: merchant.primaryCategory, // Store category value in generic GSI attribute

    // Core Identity
    LegalName: merchant.legalName,
    TradingName: merchant.tradingName,
    ShortDescription: merchant.shortDescription,
    PrimaryCategory: merchant.primaryCategory,
    VerificationStatus: merchant.verificationStatus,

    // Location
    PrimaryAddress: merchant.location.address,
    City: merchant.location.city,
    State: merchant.location.state,
    PostalCode: merchant.location.postalCode,
    Latitude: merchant.location.latitude,
    Longitude: merchant.location.longitude,

    // Contact
    PhoneNumber: merchant.contact.phoneNumber,
    Email: merchant.contact.email,
    WebsiteUrl: merchant.contact.websiteUrl,

    // Search Metadata
    Categories: merchant.categories,
    Services: merchant.services,

    // Metrics (Denormalized)
    RatingAverage: merchant.rating.average,
    RatingCount: merchant.rating.count,

    // Operational
    OperatingHours: merchant.operatingHours,

    // Timestamps
    CreatedAt: merchant.createdAt,
    UpdatedAt: merchant.updatedAt,
  };
}

/**
 * Transform DynamoDB item to domain entity
 *
 * Converts database-level MerchantItem to application-level Merchant.
 * Maps PascalCase to camelCase and removes DynamoDB keys.
 *
 * @param item - DynamoDB item
 * @returns Domain entity
 *
 * @private
 */
function fromItem(item: MerchantItem): Merchant {
  return {
    merchantId: item.MerchantId,
    legalName: item.LegalName,
    tradingName: item.TradingName,
    shortDescription: item.ShortDescription,
    primaryCategory: item.PrimaryCategory,
    categories: item.Categories,
    verificationStatus: item.VerificationStatus,
    location: {
      address: item.PrimaryAddress,
      city: item.City,
      state: item.State,
      postalCode: item.PostalCode,
      latitude: item.Latitude,
      longitude: item.Longitude,
    },
    contact: {
      phoneNumber: item.PhoneNumber,
      email: item.Email,
      websiteUrl: item.WebsiteUrl,
    },
    services: item.Services,
    rating: {
      average: item.RatingAverage,
      count: item.RatingCount,
    },
    operatingHours: item.OperatingHours,
    createdAt: item.CreatedAt,
    updatedAt: item.UpdatedAt,
  };
}

/**
 * Create Merchant
 *
 * Creates a new merchant with auto-generated ID and timestamps.
 *
 * @param client - DynamoDB Document Client
 * @param input - Merchant creation data
 * @returns Created merchant
 *
 * @throws Error if merchant creation fails
 *
 * @example
 * ```typescript
 * const merchant = await createMerchant(client, {
 *   legalName: "Green Repair Shop",
 *   primaryCategory: PrimaryCategory.REPAIR,
 *   location: { ... },
 *   contact: { ... },
 *   // ...
 * });
 * ```
 */
export async function createMerchant(
  client: DynamoDBDocumentClient,
  input: CreateMerchantInput
): Promise<Merchant> {
  const now = new Date().toISOString();
  const merchantId = randomUUID();

  const merchant: Merchant = {
    merchantId,
    legalName: input.legalName,
    tradingName: input.tradingName,
    shortDescription: input.shortDescription,
    primaryCategory: input.primaryCategory,
    categories: input.categories,
    verificationStatus: MerchantStatus.PENDING, // Default status
    location: input.location,
    contact: input.contact,
    services: input.services,
    rating: {
      average: 0,
      count: 0,
    },
    operatingHours: input.operatingHours,
    createdAt: now,
    updatedAt: now,
  };

  await client.send(
    new PutCommand({
      TableName: getTableName(),
      Item: toItem(merchant),
      // Prevent overwriting existing merchant
      ConditionExpression: "attribute_not_exists(MerchantId)",
    })
  );

  return merchant;
}

/**
 * Get Merchant by ID
 *
 * Retrieves a merchant by its unique ID.
 * Uses primary key for direct lookup (GetItem).
 *
 * Access Pattern: Get merchant by ID
 * Table/Index: Main table
 *
 * @param client - DynamoDB Document Client
 * @param merchantId - Merchant ID
 * @returns Merchant if found, null otherwise
 *
 * @example
 * ```typescript
 * const merchant = await getMerchantById(client, "merchant-123");
 * if (merchant) {
 *   console.log(merchant.legalName);
 * }
 * ```
 */
export async function getMerchantById(
  client: DynamoDBDocumentClient,
  merchantId: string
): Promise<Merchant | null> {
  const result = await client.send(
    new GetCommand({
      TableName: getTableName(),
      Key: {
        MerchantId: merchantId,
      },
    })
  );

  return result.Item ? fromItem(result.Item as MerchantItem) : null;
}

/**
 * Update Merchant
 *
 * Updates an existing merchant with partial data.
 * Only provided fields are updated.
 *
 * @param client - DynamoDB Document Client
 * @param input - Merchant update data
 * @returns Updated merchant
 *
 * @throws Error if merchant not found or update fails
 *
 * @example
 * ```typescript
 * const updated = await updateMerchant(client, {
 *   merchantId: "merchant-123",
 *   shortDescription: "Updated description",
 *   verificationStatus: MerchantStatus.VERIFIED,
 * });
 * ```
 */
export async function updateMerchant(
  client: DynamoDBDocumentClient,
  input: UpdateMerchantInput
): Promise<Merchant> {
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Always update timestamp
  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "UpdatedAt";
  expressionAttributeValues[":updatedAt"] = now;

  // Add optional fields
  if (input.legalName !== undefined) {
    updateExpressions.push("#legalName = :legalName");
    expressionAttributeNames["#legalName"] = "LegalName";
    expressionAttributeValues[":legalName"] = input.legalName;
  }

  if (input.tradingName !== undefined) {
    updateExpressions.push("#tradingName = :tradingName");
    expressionAttributeNames["#tradingName"] = "TradingName";
    expressionAttributeValues[":tradingName"] = input.tradingName;
  }

  if (input.shortDescription !== undefined) {
    updateExpressions.push("#shortDescription = :shortDescription");
    expressionAttributeNames["#shortDescription"] = "ShortDescription";
    expressionAttributeValues[":shortDescription"] = input.shortDescription;
  }

  if (input.primaryCategory !== undefined) {
    updateExpressions.push("#primaryCategory = :primaryCategory");
    expressionAttributeNames["#primaryCategory"] = "PrimaryCategory";
    expressionAttributeValues[":primaryCategory"] = input.primaryCategory;

    // Update GSI1PK when primary category changes
    updateExpressions.push("#gsi1pk = :gsi1pk");
    expressionAttributeNames["#gsi1pk"] = "GSI1PK";
    expressionAttributeValues[":gsi1pk"] = input.primaryCategory;
  }

  if (input.categories !== undefined) {
    updateExpressions.push("#categories = :categories");
    expressionAttributeNames["#categories"] = "Categories";
    expressionAttributeValues[":categories"] = input.categories;
  }

  if (input.verificationStatus !== undefined) {
    updateExpressions.push("#verificationStatus = :verificationStatus");
    expressionAttributeNames["#verificationStatus"] = "VerificationStatus";
    expressionAttributeValues[":verificationStatus"] = input.verificationStatus;
  }

  if (input.location !== undefined) {
    updateExpressions.push("#primaryAddress = :primaryAddress");
    updateExpressions.push("#city = :city");
    updateExpressions.push("#state = :state");
    updateExpressions.push("#postalCode = :postalCode");
    updateExpressions.push("#latitude = :latitude");
    updateExpressions.push("#longitude = :longitude");

    expressionAttributeNames["#primaryAddress"] = "PrimaryAddress";
    expressionAttributeNames["#city"] = "City";
    expressionAttributeNames["#state"] = "State";
    expressionAttributeNames["#postalCode"] = "PostalCode";
    expressionAttributeNames["#latitude"] = "Latitude";
    expressionAttributeNames["#longitude"] = "Longitude";

    expressionAttributeValues[":primaryAddress"] = input.location.address;
    expressionAttributeValues[":city"] = input.location.city;
    expressionAttributeValues[":state"] = input.location.state;
    expressionAttributeValues[":postalCode"] = input.location.postalCode;
    expressionAttributeValues[":latitude"] = input.location.latitude;
    expressionAttributeValues[":longitude"] = input.location.longitude;
  }

  if (input.contact !== undefined) {
    updateExpressions.push("#phoneNumber = :phoneNumber");
    updateExpressions.push("#email = :email");

    expressionAttributeNames["#phoneNumber"] = "PhoneNumber";
    expressionAttributeNames["#email"] = "Email";

    expressionAttributeValues[":phoneNumber"] = input.contact.phoneNumber;
    expressionAttributeValues[":email"] = input.contact.email;

    if (input.contact.websiteUrl !== undefined) {
      updateExpressions.push("#websiteUrl = :websiteUrl");
      expressionAttributeNames["#websiteUrl"] = "WebsiteUrl";
      expressionAttributeValues[":websiteUrl"] = input.contact.websiteUrl;
    }
  }

  if (input.services !== undefined) {
    updateExpressions.push("#services = :services");
    expressionAttributeNames["#services"] = "Services";
    expressionAttributeValues[":services"] = input.services;
  }

  if (input.rating !== undefined) {
    updateExpressions.push("#ratingAverage = :ratingAverage");
    updateExpressions.push("#ratingCount = :ratingCount");

    expressionAttributeNames["#ratingAverage"] = "RatingAverage";
    expressionAttributeNames["#ratingCount"] = "RatingCount";

    expressionAttributeValues[":ratingAverage"] = input.rating.average;
    expressionAttributeValues[":ratingCount"] = input.rating.count;
  }

  if (input.operatingHours !== undefined) {
    updateExpressions.push("#operatingHours = :operatingHours");
    expressionAttributeNames["#operatingHours"] = "OperatingHours";
    expressionAttributeValues[":operatingHours"] = input.operatingHours;
  }

  const result = await client.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: {
        MerchantId: input.merchantId,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      // Ensure merchant exists
      ConditionExpression: "attribute_exists(MerchantId)",
      ReturnValues: "ALL_NEW",
    })
  );

  return fromItem(result.Attributes as MerchantItem);
}

/**
 * Delete Merchant
 *
 * Deletes a merchant by ID.
 * Note: Consider implementing soft delete in production.
 *
 * @param client - DynamoDB Document Client
 * @param merchantId - Merchant ID
 *
 * @throws Error if merchant not found or delete fails
 *
 * @example
 * ```typescript
 * await deleteMerchant(client, "merchant-123");
 * ```
 */
export async function deleteMerchant(
  client: DynamoDBDocumentClient,
  merchantId: string
): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: {
        MerchantId: merchantId,
      },
      // Ensure merchant exists before deleting
      ConditionExpression: "attribute_exists(MerchantId)",
    })
  );
}

/**
 * Search Merchants by Category
 *
 * Retrieves all merchants in a specified category.
 * Uses GSI1 for efficient querying.
 *
 * Access Pattern: Search merchants by category
 * Table/Index: GSI1
 * Query: GSI1PK = category
 *
 * Note: Returns ALL merchants in category. Client performs distance filtering.
 *
 * @param client - DynamoDB Document Client
 * @param category - Primary category to search
 * @returns Search result with merchants array
 *
 * @see docs/project/specs/stories/consumers/browse-providers-by-waste-category/actions-queries.md
 *
 * @example
 * ```typescript
 * const result = await searchMerchantsByCategory(client, PrimaryCategory.REPAIR);
 * console.log(`Found ${result.count} repair shops`);
 * // Client filters by distance using lat/lng
 * ```
 */
export async function searchMerchantsByCategory(
  client: DynamoDBDocumentClient,
  category: PrimaryCategory
): Promise<SearchMerchantsResult> {
  const result = await client.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :category",
      ExpressionAttributeValues: {
        ":category": category,
      },
    })
  );

  const merchants = (result.Items || []).map((item) =>
    fromItem(item as MerchantItem)
  );

  return {
    merchants,
    count: merchants.length,
    category,
  };
}
