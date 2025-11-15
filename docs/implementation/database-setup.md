# Database Setup Guide

**Guide**: How to configure and set up DynamoDB tables using the config-driven approach

---

## Overview

This microservice supports two DynamoDB design approaches:

1. **Faux-SQL**: Multiple tables with descriptive keys (recommended for MVP/early-stage)
2. **Single-Table**: One table with generic keys (for high-performance at scale)

The approach is configured in `config/database.ts` and automatically applied by the `DatabaseConstruct` facade.

---

## Quick Start

### 1. Choose Your Approach

Edit `config/database.ts`:

```typescript
export const databaseConfig: IDatabaseConfig = {
  approach: "faux-sql", // or "single-table"
  fauxSql: {
    /* config */
  },
  singleTable: {
    /* config */
  },
};
```

### 2. Configure Tables

**For Faux-SQL** (active):

```typescript
fauxSql: {
  tables: [
    {
      tableName: "Merchants",
      partitionKey: {
        name: "MerchantId",
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        /* GSIs */
      ],
    },
  ];
}
```

**For Single-Table** (inactive):

```typescript
singleTable: {
  tableName: "CustomName"; // Optional override
}
```

### 3. Use in Code

```typescript
// ServiceStack automatically uses config
const db = new DatabaseConstruct(this, "DatabaseConstruct", { config });

// Access tables
const merchantsTable = db.tables.get("Merchants"); // Faux-SQL
const table = db.table; // Single-Table or first Faux-SQL table
```

---

## Faux-SQL Approach (Recommended for SMW)

### When to Use Faux-SQL

✅ **Use Faux-SQL when**:

- Building MVP or early-stage product
- Team prefers SQL-like patterns
- Analytics and reporting are important
- Using AI-assisted development
- Development speed > raw performance

❌ **Avoid Faux-SQL when**:

- Need <10ms query latency
- Handling >10K requests/second
- Require atomic transactions across entities

---

### When to Use Multiple Tables

**Key Principle**: One table per entity type, NOT one table per microservice.

#### Decision Framework

Use **multiple tables** when entities have:

✅ **Different lifecycles**

- Reviews are created/deleted independently of merchants
- User sessions expire while user profiles persist
- Order items can be modified after order is placed

✅ **Different access patterns**

- Reviews queried by merchant AND by user
- Sessions accessed by session ID AND user ID
- Order items queried by order AND by product

✅ **Different growth rates**

- Reviews grow unbounded (thousands per merchant)
- Merchants grow slowly (hundreds total)
- Sessions are high-churn (created/deleted constantly)

✅ **Different update frequencies**

- Operating hours updated weekly
- Merchant profiles updated monthly
- Reviews are append-only

✅ **Separate ownership**

- Different teams manage different entities
- Different feature areas (core vs reviews)
- Different security/access requirements

Use **single table** when:

✅ **Simple domain**: One primary entity (e.g., Categories microservice)
✅ **Tightly coupled**: Entities always accessed together
✅ **Similar patterns**: Same query patterns across entities
✅ **Small scale**: All entities combined < 100K items

#### Examples

**Example 1: Single Table (Simple Domain)**

```typescript
// Categories Microservice - Just one entity type
fauxSql: {
  tables: [
    {
      tableName: "Categories",
      partitionKey: {
        name: "CategoryId",
        type: AttributeType.STRING,
      },
    },
  ];
}
```

**Use `db.table`** for convenience:

```typescript
const categoriesTable = db.table;
lambda.addEnvironment("TABLE_NAME", categoriesTable.tableName);
```

**Example 2: Multiple Tables (Complex Domain)**

```typescript
// Merchants Microservice - Multiple related entities
fauxSql: {
  tables: [
    {
      tableName: "Merchants",
      partitionKey: {
        name: "MerchantId",
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        {
          indexName: "CategoryIndex",
          partitionKey: {
            name: "Category",
            type: AttributeType.STRING,
          },
        },
      ],
    },
    {
      tableName: "MerchantReviews",
      partitionKey: {
        name: "ReviewId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "MerchantId",
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        {
          indexName: "MerchantIndex",
          partitionKey: {
            name: "MerchantId",
            type: AttributeType.STRING,
          },
          sortKey: {
            name: "CreatedAt",
            type: AttributeType.STRING,
          },
        },
      ],
    },
  ];
}
```

**Use `db.tables.get()`** for explicit access:

```typescript
const merchantsTable = db.tables.get("Merchants");
const reviewsTable = db.tables.get("MerchantReviews");

merchantLambda.addEnvironment("MERCHANTS_TABLE", merchantsTable.tableName);
reviewLambda.addEnvironment("REVIEWS_TABLE", reviewsTable.tableName);
```

**Or use `db.table`** for primary entity:

```typescript
// Primary table (first in array) = Merchants
const primaryTable = db.table;
```

**Example 3: Users Microservice**

```typescript
fauxSql: {
  tables: [
    {
      tableName: "Users",
      partitionKey: {
        name: "UserId",
        type: AttributeType.STRING,
      },
    },
    {
      tableName: "UserSessions",
      partitionKey: {
        name: "SessionId",
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        {
          indexName: "UserIndex",
          partitionKey: {
            name: "UserId",
            type: AttributeType.STRING,
          },
        },
      ],
    },
  ];
}
```

**Why separate?**

- Sessions have TTL (auto-delete after expiry)
- Sessions accessed by SessionId (primary) AND UserId (GSI)
- High churn: thousands of sessions created/deleted daily
- Users are relatively static

**Example 4: Orders Microservice**

```typescript
fauxSql: {
  tables: [
    {
      tableName: "Orders",
      partitionKey: {
        name: "OrderId",
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        {
          indexName: "UserIndex",
          partitionKey: {
            name: "UserId",
            type: AttributeType.STRING,
          },
          sortKey: {
            name: "CreatedAt",
            type: AttributeType.STRING,
          },
        },
      ],
    },
    {
      tableName: "OrderItems",
      partitionKey: {
        name: "OrderId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "ItemId",
        type: AttributeType.STRING,
      },
    },
  ];
}
```

**Why separate?**

- 1:N relationship (one order, many items)
- Items can be modified independently
- Different query patterns (order summary vs item details)

#### Best Practices

1. **Start with one table**: Add more only when justified
2. **Primary entity first**: Put main entity as first table (accessible via `db.table`)
3. **Descriptive names**: Use entity names, not generic names
4. **Document relationships**: Comment why tables are separate
5. **Consider joins**: If you need joins, you might want Single-Table instead

---

### Configuration Structure

```typescript
export interface ITableDefinition {
  readonly tableName: string; // Entity name (e.g., "Merchants")
  readonly partitionKey: IKeyAttribute; // Primary key
  readonly sortKey?: IKeyAttribute; // Optional sort key
  readonly globalSecondaryIndexes?: IGsiDefinition[];
}

export interface IKeyAttribute {
  readonly name: string; // Descriptive name (e.g., "MerchantId")
  readonly type: AttributeType; // STRING, NUMBER, or BINARY
}

export interface IGsiDefinition {
  readonly indexName: string; // Generic name (e.g., "GSI1", "GSI2")
  readonly partitionKey: IKeyAttribute; // Generic name (e.g., "GSI1PK")
  readonly sortKey?: IKeyAttribute; // Generic name (e.g., "GSI1SK")
  readonly projectionType?: ProjectionType; // Defaults to ALL
}
```

### Example: Merchants Table

```typescript
{
  tableName: "Merchants",
  partitionKey: {
    name: "MerchantId",
    type: AttributeType.STRING
  },
  globalSecondaryIndexes: [
    {
      indexName: "GSI1",
      partitionKey: {
        name: "GSI1PK",
        type: AttributeType.STRING
      },
      // No sort key - client-side sorting
      projectionType: ProjectionType.ALL
    }
  ]
}
```

**Resulting Table**:

- Table Name: `svc-merchants-Merchants`
- Partition Key: `MerchantId` (STRING)
- GSI: `GSI1` on `GSI1PK` (stores category value)

### Access Patterns

**Primary Key Query**:

```typescript
const result = await ddb.get({
  TableName: "svc-merchants-Merchants",
  Key: { MerchantId: "M123" },
});
```

**GSI Query**:

```typescript
const result = await ddb.query({
  TableName: "svc-merchants-Merchants",
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :category",
  ExpressionAttributeValues: {
    ":category": "Repair",
  },
});
```

### Adding New Tables

1. **Define table in `config/database.ts`**:

```typescript
fauxSql: {
  tables: [
    {
      /* Merchants */
    },
    {
      tableName: "Reviews",
      partitionKey: {
        name: "ReviewId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "MerchantId",
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        {
          indexName: "MerchantIndex",
          partitionKey: {
            name: "MerchantId",
            type: AttributeType.STRING,
          },
          sortKey: {
            name: "CreatedAt",
            type: AttributeType.STRING,
          },
        },
      ],
    },
  ];
}
```

2. **Access in code**:

```typescript
const reviewsTable = db.tables.get("Reviews");
lambda.addEnvironment("REVIEWS_TABLE_NAME", reviewsTable.tableName);
reviewsTable.grantReadWriteData(lambda);
```

### Best Practices

1. **Descriptive Names**: Use entity-specific names (`MerchantId`, not `id`)
2. **One GSI Per Access Pattern**: Don't overload GSIs
3. **Project ALL**: Use `ProjectionType.ALL` unless table is very large
4. **Simple Queries**: Keep queries straightforward (one table, one index)
5. **Normalize Data**: Follow relational normalization principles

---

## Single-Table Approach

### When to Use

✅ **Use Single-Table when**:

- Need <10ms query latency
- Handling >10K requests/second
- Access patterns are well-defined and stable
- Team has DynamoDB expertise

❌ **Avoid Single-Table when**:

- Building MVP (too complex upfront)
- Access patterns are evolving
- Team prefers SQL-like patterns
- Analytics/reporting is critical

### Configuration Structure

```typescript
export interface ISingleTableConfig {
  readonly tableName?: string; // Optional override (defaults to service name)
}
```

### Example Configuration

```typescript
singleTable: {
  tableName: "CustomTableName"; // Optional, defaults to "svc-merchants"
}
```

**Resulting Table**:

- Table Name: `svc-merchants` (or custom name)
- Partition Key: `PK` (STRING)
- Sort Key: `SK` (STRING)
- GSI1: `GSI1PK` + `GSI1SK`

### Access Patterns

**Primary Key Query**:

```typescript
const result = await ddb.get({
  TableName: "svc-merchants",
  Key: {
    PK: "MERCHANT#M123",
    SK: "PROFILE",
  },
});
```

**GSI Query**:

```typescript
const result = await ddb.query({
  TableName: "svc-merchants",
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :pk",
  ExpressionAttributeValues: {
    ":pk": "CATEGORY#Repair",
  },
});
```

### Key Patterns

| Entity   | PK              | SK            | GSI1PK           | GSI1SK          |
| -------- | --------------- | ------------- | ---------------- | --------------- |
| Merchant | `MERCHANT#<id>` | `PROFILE`     | `CATEGORY#<cat>` | `MERCHANT#<id>` |
| Review   | `MERCHANT#<id>` | `REVIEW#<id>` | `REVIEW#<id>`    | `<timestamp>`   |

---

## Switching Approaches

### From Faux-SQL to Single-Table

1. **Update config**:

```typescript
export const databaseConfig: IDatabaseConfig = {
  approach: "single-table", // Changed
  fauxSql: {
    /* keep for reference */
  },
  singleTable: {},
};
```

2. **Migrate data** (if production):
   - Export from Faux-SQL tables
   - Transform to single-table format
   - Import to single table
   - Dual-write during migration

3. **Update Lambda handlers**:
   - Change from `db.tables.get("Merchants")` to `db.table`
   - Update query patterns (descriptive keys → generic keys)

### From Single-Table to Faux-SQL

1. **Update config**:

```typescript
export const databaseConfig: IDatabaseConfig = {
  approach: "faux-sql", // Changed
  fauxSql: {
    tables: [
      /* define tables */
    ],
  },
  singleTable: {},
};
```

2. **Migrate data** (if production):
   - Export from single table
   - Transform to normalized format
   - Import to Faux-SQL tables

3. **Update Lambda handlers**:
   - Change from `db.table` to `db.tables.get("Merchants")`
   - Update query patterns (generic keys → descriptive keys)

---

## Configuration Reference

### Complete Example (`config/database.ts`)

```typescript
import { AttributeType, ProjectionType } from "aws-cdk-lib/aws-dynamodb";

export const databaseConfig: IDatabaseConfig = {
  approach: "faux-sql",

  fauxSql: {
    tables: [
      {
        tableName: "Merchants",
        partitionKey: {
          name: "MerchantId",
          type: AttributeType.STRING,
        },
        globalSecondaryIndexes: [
          {
            indexName: "CategoryIndex",
            partitionKey: {
              name: "Category",
              type: AttributeType.STRING,
            },
            sortKey: {
              name: "MerchantId",
              type: AttributeType.STRING,
            },
            projectionType: ProjectionType.ALL,
          },
        ],
      },
      {
        tableName: "Reviews",
        partitionKey: {
          name: "ReviewId",
          type: AttributeType.STRING,
        },
        sortKey: {
          name: "MerchantId",
          type: AttributeType.STRING,
        },
        globalSecondaryIndexes: [
          {
            indexName: "MerchantIndex",
            partitionKey: {
              name: "MerchantId",
              type: AttributeType.STRING,
            },
            sortKey: {
              name: "CreatedAt",
              type: AttributeType.STRING,
            },
          },
        ],
      },
    ],
  },

  singleTable: {
    // tableName: "CustomName" // Optional override
  },
};
```

---

## Environment-Specific Overrides

Currently, database config is the same across all environments. To add environment-specific overrides:

1. **Create environment config** (`config/staging.ts`):

```typescript
export default {
  database: {
    approach: "single-table" as const, // Override for staging
    fauxSql: { tables: [] },
    singleTable: {},
  },
};
```

2. **Merge in `config/default.ts`**:

```typescript
const finalConfig = {
  ...defaultConfig,
  ...envConfig,
  database: envConfig.database || defaultConfig.database,
};
```

---

## Common Patterns

### Pattern 1: Entity with Simple Lookup

```typescript
{
  tableName: "Categories",
  partitionKey: {
    name: "CategoryId",
    type: AttributeType.STRING
  }
  // No GSIs needed for simple key-value lookup
}
```

### Pattern 2: Entity with Parent-Child Relationship

```typescript
{
  tableName: "Reviews",
  partitionKey: {
    name: "ReviewId",
    type: AttributeType.STRING
  },
  sortKey: {
    name: "MerchantId",
    type: AttributeType.STRING
  },
  globalSecondaryIndexes: [
    {
      indexName: "MerchantIndex",
      partitionKey: {
        name: "MerchantId",
        type: AttributeType.STRING
      },
      sortKey: {
        name: "CreatedAt",
        type: AttributeType.STRING
      }
    }
  ]
}
```

**Access Patterns**:

- Get review by ID: Query with `ReviewId`
- Get all reviews for merchant: Query `MerchantIndex` with `MerchantId`
- Get recent reviews: Query `MerchantIndex` with `MerchantId` + sort by `CreatedAt`

### Pattern 3: Entity with Multiple Access Patterns

```typescript
{
  tableName: "Merchants",
  partitionKey: {
    name: "MerchantId",
    type: AttributeType.STRING
  },
  globalSecondaryIndexes: [
    {
      indexName: "CategoryIndex",
      partitionKey: {
        name: "Category",
        type: AttributeType.STRING
      }
    },
    {
      indexName: "CityIndex",
      partitionKey: {
        name: "City",
        type: AttributeType.STRING
      }
    }
  ]
}
```

**Access Patterns**:

- Get merchant by ID: Query with `MerchantId`
- Browse by category: Query `CategoryIndex` with `Category`
- Browse by city: Query `CityIndex` with `City`

---

## Troubleshooting

### Error: "Table already exists"

**Cause**: Table name conflict (e.g., switching approaches without destroying old tables)

**Solution**:

1. Destroy old stack: `npx cdk destroy`
2. Or rename table in config
3. Or manually delete table in AWS Console

### Error: "Property 'database' does not exist on type 'IConfig'"

**Cause**: TypeScript hasn't picked up updated `IConfig` interface

**Solution**:

1. Restart TypeScript server in IDE
2. Run `npm run build` to recompile
3. Check `config/default.ts` has `database: IDatabaseConfig`

### Error: "Cannot read property 'get' of undefined"

**Cause**: Using `db.tables.get()` with single-table approach

**Solution**:

```typescript
// Check approach first
if (config.database.approach === "faux-sql") {
  const table = db.tables.get("Merchants");
} else {
  const table = db.table;
}
```

---

## Next Steps

1. ✅ Configure tables in `config/database.ts`
2. ⏭️ Create Lambda handlers that use the tables
3. ⏭️ Implement data access layer (DynamoDB helpers)
4. ⏭️ Test with DynamoDB Local
5. ⏭️ Deploy and verify

---

## Related Guides

- [Using CDK Constructs](./using-constructs.md) - Overview of all constructs
- [Data Access Layer](./data-access.md) - DynamoDB query helpers
- [Adding Endpoints](./adding-endpoints.md) - Lambda handlers
- [Faux-SQL Design Guide](../../docs/guides/data-modeling/faux-sql-design.md) - Detailed design patterns
- [Single-Table Design Guide](../../docs/guides/data-modeling/single-table-design.md) - Advanced patterns
