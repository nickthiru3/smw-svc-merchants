/**
 * Merchant Entity Types
 *
 * Domain and DynamoDB representations for the Merchant entity.
 *
 * Design Artifacts:
 * - Entity file: docs/project/specs/entities/merchants.md
 * - Actions & Queries: docs/project/specs/stories/consumers/browse-providers-by-waste-category/actions-queries.md
 *
 * @see docs/project/specs/entities/merchants.md - Entity specification
 */

/**
 * Merchant Status
 *
 * Verification status for merchant listings
 */
export enum MerchantStatus {
  PENDING = "Pending",
  VERIFIED = "Verified",
  REJECTED = "Rejected",
}

/**
 * Primary Category
 *
 * Main service category for merchant classification
 */
export enum PrimaryCategory {
  REPAIR = "Repair",
  REFILL = "Refill",
  RECYCLING = "Recycling",
  DONATE = "Donate",
}

/**
 * Location
 *
 * Physical address and GPS coordinates for merchant location
 */
export interface Location {
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Contact Information
 *
 * Contact details for merchant
 */
export interface Contact {
  readonly phoneNumber: string;
  readonly email: string;
  readonly websiteUrl?: string;
}

/**
 * Service
 *
 * Individual service offered by merchant
 * Bounded list: max 10 items
 */
export interface Service {
  readonly name: string;
  readonly description: string;
}

/**
 * Rating
 *
 * Denormalized rating metrics
 */
export interface Rating {
  readonly average: number; // 0-5
  readonly count: number;
}

/**
 * Operating Hours
 *
 * Weekly schedule for merchant operations
 * Bounded list: max 7 items (one per day)
 */
export interface OperatingHours {
  readonly dayOfWeek: string; // Monday, Tuesday, etc.
  readonly openTime: string; // HH:MM format
  readonly closeTime: string; // HH:MM format
}

/**
 * Merchant (Domain Entity)
 *
 * Application-level representation of a merchant.
 * Used in business logic and API responses.
 *
 * Does NOT contain DynamoDB-specific attributes (PK, SK, GSI).
 *
 * @see docs/project/specs/entities/merchants.md - Entity specification
 */
export interface Merchant {
  readonly merchantId: string;
  readonly legalName: string;
  readonly tradingName?: string;
  readonly shortDescription: string;
  readonly primaryCategory: PrimaryCategory;
  readonly categories: string[]; // Max 4 items
  readonly verificationStatus: MerchantStatus;
  readonly location: Location;
  readonly contact: Contact;
  readonly services?: Service[]; // Max 10 items
  readonly rating: Rating;
  readonly operatingHours?: OperatingHours[]; // Max 7 items
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
}

/**
 * MerchantItem (DynamoDB Item)
 *
 * Database-level representation with DynamoDB keys.
 * Used in data access layer for DynamoDB operations.
 *
 * Includes:
 * - Primary key: MerchantId
 * - GSI1PK: For category queries (stores PrimaryCategory value)
 *
 * @see docs/project/specs/entities/merchants.md - Main Table Structure
 * @see docs/project/specs/entities/merchants.md - Global Secondary Indexes
 */
export interface MerchantItem {
  // Primary Key
  readonly MerchantId: string;

  // GSI1 Attributes (for category queries)
  readonly GSI1PK: string; // Stores PrimaryCategory value

  // Core Identity
  readonly LegalName: string;
  readonly TradingName?: string;
  readonly ShortDescription: string;
  readonly PrimaryCategory: PrimaryCategory;
  readonly VerificationStatus: MerchantStatus;

  // Location
  readonly PrimaryAddress: string;
  readonly City: string;
  readonly State: string;
  readonly PostalCode: string;
  readonly Latitude: number;
  readonly Longitude: number;

  // Contact
  readonly PhoneNumber: string;
  readonly Email: string;
  readonly WebsiteUrl?: string;

  // Search Metadata
  readonly Categories: string[]; // Max 4 items
  readonly Services?: Service[]; // Max 10 items

  // Metrics (Denormalized)
  readonly RatingAverage: number; // 0-5
  readonly RatingCount: number;

  // Operational
  readonly OperatingHours?: OperatingHours[]; // Max 7 items

  // Timestamps
  readonly CreatedAt: string; // ISO 8601
  readonly UpdatedAt: string; // ISO 8601
}

/**
 * CreateMerchantInput
 *
 * Input for creating a new merchant
 * MerchantId will be generated
 */
export interface CreateMerchantInput {
  readonly legalName: string;
  readonly tradingName?: string;
  readonly shortDescription: string;
  readonly primaryCategory: PrimaryCategory;
  readonly categories: string[];
  readonly location: Location;
  readonly contact: Contact;
  readonly services?: Service[];
  readonly operatingHours?: OperatingHours[];
}

/**
 * UpdateMerchantInput
 *
 * Input for updating an existing merchant
 * All fields optional except merchantId
 */
export interface UpdateMerchantInput {
  readonly merchantId: string;
  readonly legalName?: string;
  readonly tradingName?: string;
  readonly shortDescription?: string;
  readonly primaryCategory?: PrimaryCategory;
  readonly categories?: string[];
  readonly verificationStatus?: MerchantStatus;
  readonly location?: Location;
  readonly contact?: Contact;
  readonly services?: Service[];
  readonly rating?: Rating;
  readonly operatingHours?: OperatingHours[];
}

/**
 * GetMerchantsResult
 *
 * Result from getting/filtering merchants by category
 * Matches API response structure from actions-queries.md
 */
export interface GetMerchantsResult {
  readonly merchants: Merchant[];
  readonly count: number;
  readonly category: string;
}
