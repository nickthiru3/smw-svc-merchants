# Data Access Layer Implementation

**Guide**: How to implement DynamoDB data access for your entities

---

## Overview

This guide covers implementing the data access layer based on your DynamoDB data model designed in Phase 2 (Conceptual Design).

**Prerequisites:**

- ✅ Entity files created at `docs/project/specs/entities/[entity].md`
- ✅ Access patterns documented
- ✅ Primary keys and GSIs designed
- ✅ Data modeling approach chosen (Faux-SQL or Single-Table)

---

## Implementation Steps

### 1. Review Your Data Model

**Location**: `docs/project/specs/entities/[entity].md`

Your entity file should contain:

- Entity-key table (main table + GSIs)
- Access patterns with query examples
- Design decisions and rationale

**Example**: For Story 001, review `docs/project/specs/entities/merchants.md`

---

### 2. Create TypeScript Interfaces

**Location**: `src/types/[entity].ts`

Define interfaces for:

- **Domain entity** - Application-level representation
- **DynamoDB item** - Database-level representation with PK/SK/GSI attributes

**Example**:

```typescript
// src/types/merchant.ts

/**
 * Merchant domain entity
 * Application-level representation without DynamoDB indexing attributes
 */
export interface Merchant {
  merchantId: string;
  businessName: string;
  email: string;
  phone: string;
  address: Address;
  wasteCategories: string[];
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export enum MerchantStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

/**
 * Merchant DynamoDB item
 * Database-level representation with indexing attributes
 */
export interface MerchantItem {
  // Primary key
  PK: string; // MERCHANT#{merchantId}
  SK: string; // MERCHANT#{merchantId}

  // GSI1 - For querying by waste category
  GSI1PK: string; // CATEGORY#{category}
  GSI1SK: string; // MERCHANT#{merchantId}

  // GSI2 - For querying by status
  GSI2PK: string; // STATUS#{status}
  GSI2SK: string; // MERCHANT#{merchantId}

  // Entity type
  Type: "Merchant";

  // Domain attributes
  merchantId: string;
  businessName: string;
  email: string;
  phone: string;
  address: Address;
  wasteCategories: string[];
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}
```

---

### 3. Create Data Access Module

**Location**: `src/lib/data-access/[entity].ts`

Implement:

- **Transform functions** - Convert between domain and DynamoDB representations
- **CRUD operations** - Create, Read, Update, Delete
- **Query operations** - Implement access patterns

#### 3.1. Transform Functions

```typescript
// src/lib/data-access/merchants.ts
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Merchant, MerchantItem } from "#src/types/merchant";

/**
 * Transform domain entity to DynamoDB item
 */
export function toItem(merchant: Merchant): MerchantItem {
  return {
    // Primary key
    PK: `MERCHANT#${merchant.merchantId}`,
    SK: `MERCHANT#${merchant.merchantId}`,

    // GSI1 - Multiple items for each waste category
    // Note: For multiple categories, we'll create separate items
    GSI1PK: `CATEGORY#${merchant.wasteCategories[0]}`, // Primary category
    GSI1SK: `MERCHANT#${merchant.merchantId}`,

    // GSI2 - Query by status
    GSI2PK: `STATUS#${merchant.status}`,
    GSI2SK: `MERCHANT#${merchant.merchantId}`,

    // Entity type
    Type: "Merchant",

    // Domain attributes
    merchantId: merchant.merchantId,
    businessName: merchant.businessName,
    email: merchant.email,
    phone: merchant.phone,
    address: merchant.address,
    wasteCategories: merchant.wasteCategories,
    status: merchant.status,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
  };
}

/**
 * Transform DynamoDB item to domain entity
 */
export function fromItem(item: MerchantItem): Merchant {
  return {
    merchantId: item.merchantId,
    businessName: item.businessName,
    email: item.email,
    phone: item.phone,
    address: item.address,
    wasteCategories: item.wasteCategories,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
```

#### 3.2. CRUD Operations

```typescript
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { generateKSUID } from "#src/lib/utils/ksuid";

const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * Create a new merchant
 */
export async function createMerchant(
  client: DynamoDBDocumentClient,
  merchant: Omit<Merchant, "merchantId" | "createdAt" | "updatedAt">
): Promise<Merchant> {
  const now = new Date().toISOString();
  const merchantId = generateKSUID();

  const newMerchant: Merchant = {
    ...merchant,
    merchantId,
    createdAt: now,
    updatedAt: now,
  };

  const item = toItem(newMerchant);

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return newMerchant;
}

/**
 * Get merchant by ID
 */
export async function getMerchantById(
  client: DynamoDBDocumentClient,
  merchantId: string
): Promise<Merchant | null> {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `MERCHANT#${merchantId}`,
        SK: `MERCHANT#${merchantId}`,
      },
    })
  );

  return result.Item ? fromItem(result.Item as MerchantItem) : null;
}

/**
 * Update merchant
 */
export async function updateMerchant(
  client: DynamoDBDocumentClient,
  merchantId: string,
  updates: Partial<Omit<Merchant, "merchantId" | "createdAt" | "updatedAt">>
): Promise<Merchant> {
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    updateExpressions.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  });

  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = now;

  const result = await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `MERCHANT#${merchantId}`,
        SK: `MERCHANT#${merchantId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return fromItem(result.Attributes as MerchantItem);
}

/**
 * Delete merchant
 */
export async function deleteMerchant(
  client: DynamoDBDocumentClient,
  merchantId: string
): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `MERCHANT#${merchantId}`,
        SK: `MERCHANT#${merchantId}`,
      },
    })
  );
}
```

#### 3.3. Query Operations (Access Patterns)

```typescript
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Access Pattern: Get merchants by waste category
 * Uses GSI1
 */
export async function getMerchantsByCategory(
  client: DynamoDBDocumentClient,
  category: string,
  options?: {
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
  }
): Promise<{ merchants: Merchant[]; lastEvaluatedKey?: Record<string, any> }> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :category",
      ExpressionAttributeValues: {
        ":category": `CATEGORY#${category}`,
      },
      Limit: options?.limit,
      ExclusiveStartKey: options?.exclusiveStartKey,
    })
  );

  const merchants = (result.Items || []).map((item) =>
    fromItem(item as MerchantItem)
  );

  return {
    merchants,
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}

/**
 * Access Pattern: Get merchants by status
 * Uses GSI2
 */
export async function getMerchantsByStatus(
  client: DynamoDBDocumentClient,
  status: MerchantStatus
): Promise<Merchant[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :status",
      ExpressionAttributeValues: {
        ":status": `STATUS#${status}`,
      },
    })
  );

  return (result.Items || []).map((item) => fromItem(item as MerchantItem));
}
```

---

### 4. Create DynamoDB Client Utility

**Location**: `src/lib/utils/dynamodb.ts`

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Create DynamoDB Document Client
 * Configured for local development or AWS
 */
export function createDynamoDBClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(process.env.DYNAMODB_ENDPOINT && {
      endpoint: process.env.DYNAMODB_ENDPOINT,
    }),
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  });
}

// Singleton instance
let docClient: DynamoDBDocumentClient | null = null;

export function getDocumentClient(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = createDynamoDBClient();
  }
  return docClient;
}
```

---

### 5. Write Unit Tests

**Location**: `test/lib/data-access/merchants.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDynamoDBClient } from "#src/lib/utils/dynamodb";
import {
  createMerchant,
  getMerchantById,
  updateMerchant,
  deleteMerchant,
  getMerchantsByCategory,
} from "#src/lib/data-access/merchants";
import { MerchantStatus } from "#src/types/merchant";

describe("Merchant Data Access", () => {
  let client: DynamoDBDocumentClient;

  beforeAll(() => {
    // Use DynamoDB Local for testing
    process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";
    process.env.TABLE_NAME = "test-merchants-table";
    client = createDynamoDBClient();
  });

  afterAll(() => {
    // Cleanup
  });

  describe("createMerchant", () => {
    it("should create a new merchant", async () => {
      const merchantData = {
        businessName: "Green Recycling Co",
        email: "contact@greenrecycling.com",
        phone: "+1-555-0123",
        address: {
          street: "123 Eco Street",
          city: "Portland",
          state: "OR",
          zipCode: "97201",
          country: "USA",
        },
        wasteCategories: ["plastic", "metal"],
        status: MerchantStatus.ACTIVE,
      };

      const merchant = await createMerchant(client, merchantData);

      expect(merchant.merchantId).toBeDefined();
      expect(merchant.businessName).toBe(merchantData.businessName);
      expect(merchant.email).toBe(merchantData.email);
      expect(merchant.createdAt).toBeDefined();
      expect(merchant.updatedAt).toBeDefined();
    });
  });

  describe("getMerchantById", () => {
    it("should retrieve merchant by ID", async () => {
      // Create merchant first
      const created = await createMerchant(client, {
        businessName: "Test Merchant",
        email: "test@example.com",
        phone: "+1-555-0124",
        address: {
          street: "456 Test Ave",
          city: "Seattle",
          state: "WA",
          zipCode: "98101",
          country: "USA",
        },
        wasteCategories: ["paper"],
        status: MerchantStatus.ACTIVE,
      });

      const retrieved = await getMerchantById(client, created.merchantId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.merchantId).toBe(created.merchantId);
      expect(retrieved?.businessName).toBe("Test Merchant");
    });

    it("should return null for non-existent merchant", async () => {
      const result = await getMerchantById(client, "non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("getMerchantsByCategory", () => {
    it("should retrieve merchants by waste category", async () => {
      // Create merchants with plastic category
      await createMerchant(client, {
        businessName: "Plastic Recycler 1",
        email: "plastic1@example.com",
        phone: "+1-555-0125",
        address: {
          street: "789 Plastic Rd",
          city: "Denver",
          state: "CO",
          zipCode: "80201",
          country: "USA",
        },
        wasteCategories: ["plastic"],
        status: MerchantStatus.ACTIVE,
      });

      const result = await getMerchantsByCategory(client, "plastic");

      expect(result.merchants.length).toBeGreaterThan(0);
      expect(result.merchants[0].wasteCategories).toContain("plastic");
    });
  });
});
```

---

## Best Practices

### Separation of Concerns

✅ **Keep DynamoDB details isolated**

- Transform functions at the boundary
- Domain entities don't know about PK/SK/GSI
- Business logic works with domain entities only

❌ **Don't leak DynamoDB structure**

```typescript
// Bad: Business logic knows about DynamoDB keys
function processMerchant(item: any) {
  const id = item.PK.split("#")[1];
  // ...
}

// Good: Business logic works with domain entities
function processMerchant(merchant: Merchant) {
  const id = merchant.merchantId;
  // ...
}
```

### Error Handling

✅ **Handle DynamoDB errors gracefully**

```typescript
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

try {
  await createMerchant(client, merchantData);
} catch (error) {
  if (error instanceof ConditionalCheckFailedException) {
    throw new Error("Merchant already exists");
  }
  throw error;
}
```

### Performance

✅ **Use batch operations when possible**

```typescript
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

// For multiple merchants
const items = merchants.map(toItem);
await client.send(
  new BatchWriteCommand({
    RequestItems: {
      [TABLE_NAME]: items.map((item) => ({
        PutRequest: { Item: item },
      })),
    },
  })
);
```

✅ **Implement pagination for large result sets**

```typescript
export async function getAllMerchantsByCategory(
  client: DynamoDBDocumentClient,
  category: string
): Promise<Merchant[]> {
  const merchants: Merchant[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await getMerchantsByCategory(client, category, {
      limit: 100,
      exclusiveStartKey: lastEvaluatedKey,
    });

    merchants.push(...result.merchants);
    lastEvaluatedKey = result.lastEvaluatedKey;
  } while (lastEvaluatedKey);

  return merchants;
}
```

---

## Testing with DynamoDB Local

### Setup

1. **Start DynamoDB Local**:

   ```bash
   docker-compose -f docker-compose.localstack.yml up -d
   ```

2. **Create test table**:

   ```bash
   npm run test:setup
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

### Configuration

Set environment variables for testing:

```bash
export DYNAMODB_ENDPOINT=http://localhost:8000
export TABLE_NAME=test-merchants-table
export AWS_REGION=us-east-1
```

---

## Next Steps

Once data access layer is complete:

1. ✅ **[Add Lambda handlers](./adding-endpoints.md)** - Implement API endpoints
2. ✅ **[Wire to API Gateway](./using-constructs.md)** - Configure API construct
3. ✅ **[Add monitoring](./monitoring.md)** - Set up CloudWatch alarms

---

## Story 001 Notes

**Implementation decisions for Story 001**:

- Using GSI1 for waste category queries
- Merchants can have multiple waste categories
- Pagination implemented for category queries
- Status filtering via GSI2 for future admin features

**See**: [Story 001 Implementation Log](./story-001-implementation-log.md)
