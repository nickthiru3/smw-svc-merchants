# Database Configuration Guide

Guide for configuring DynamoDB tables and database approach.

**File**: `config/database.ts`

**Related**: [Database Setup Guide](../database-setup.md)

---

## Overview

Database configuration defines:

- **Approach**: Faux-SQL or Single-Table design
- **Tables**: Table definitions with keys and GSIs
- **Settings**: Billing mode, point-in-time recovery, deletion protection

---

## Configuration Structure

```typescript
export interface IDatabaseConfig {
  approach: "faux-sql" | "single-table";
  fauxSql: IFauxSqlConfig;
  singleTable: ISingleTableConfig;
}
```

---

## Faux-SQL Approach

### Table Definition

```typescript
fauxSql: {
  tables: [
    {
      tableName: "Merchants",
      partitionKey: { name: "MerchantId", type: "S" },
      sortKey: undefined,
      gsis: [
        {
          indexName: "GSI1",
          partitionKey: { name: "GSI1PK", type: "S" },
          sortKey: { name: "GSI1SK", type: "S" },
        },
      ],
      billingMode: "PAY_PER_REQUEST",
      pointInTimeRecovery: true,
      deletionProtection: envName !== "local",
    },
  ],
}
```

### Key Characteristics

- ✅ Descriptive key names (`MerchantId`, not `PK`)
- ✅ One table per entity
- ✅ GSIs for access patterns
- ✅ SQL-like mental model

---

## Single-Table Approach

### Table Definition

```typescript
singleTable: {
  tableName: "AppData",
  partitionKey: { name: "PK", type: "S" },
  sortKey: { name: "SK", type: "S" },
  gsis: [
    {
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: "S" },
      sortKey: { name: "GSI1SK", type: "S" },
    },
  ],
  billingMode: "PAY_PER_REQUEST",
  pointInTimeRecovery: true,
  deletionProtection: envName !== "local",
}
```

### Key Characteristics

- ✅ Generic key names (`PK`, `SK`)
- ✅ All entities in one table
- ✅ Composite keys with prefixes
- ✅ Advanced access patterns

---

## Environment Variables

### `DB_APPROACH`

**Purpose**: Choose database approach

**Values**: `"faux-sql"` | `"single-table"`

**Default**: `"faux-sql"`

**Example**: `DB_APPROACH=faux-sql`

---

## Usage

### In CDK Constructs

```typescript
import config from "#config/default";

const approach = config.database.approach;

if (approach === "faux-sql") {
  // Create Faux-SQL tables
  config.database.fauxSql.tables.forEach((tableConfig) => {
    new Table(this, tableConfig.tableName, {
      partitionKey: tableConfig.partitionKey,
      // ...
    });
  });
} else {
  // Create Single-Table
  new Table(this, config.database.singleTable.tableName, {
    partitionKey: config.database.singleTable.partitionKey,
    sortKey: config.database.singleTable.sortKey,
    // ...
  });
}
```

---

## Adding New Tables

### Step 1: Define Table in Config

```typescript
// config/database.ts
fauxSql: {
  tables: [
    // Existing tables...
    {
      tableName: "Orders",
      partitionKey: { name: "OrderId", type: "S" },
      sortKey: { name: "CreatedAt", type: "S" },
      gsis: [
        {
          indexName: "GSI1",
          partitionKey: { name: "MerchantId", type: "S" },
          sortKey: { name: "CreatedAt", type: "S" },
        },
      ],
      billingMode: "PAY_PER_REQUEST",
      pointInTimeRecovery: true,
      deletionProtection: envName !== "local",
    },
  ],
}
```

### Step 2: Update CDK Construct

```typescript
// lib/db/faux-sql/construct.ts
config.database.fauxSql.tables.forEach((tableConfig) => {
  const table = new Table(this, tableConfig.tableName, {
    tableName: `${config.resources.tablePrefix}-${tableConfig.tableName}`,
    partitionKey: tableConfig.partitionKey,
    sortKey: tableConfig.sortKey,
    // ...
  });

  // Store table reference
  this.tables.set(tableConfig.tableName, table);
});
```

### Step 3: Access in Code

```typescript
// In endpoint construct
const ordersTable = db.tables.get("Orders");
if (!ordersTable) {
  throw new Error("Orders table not found");
}

ordersTable.grantReadWriteData(handler);
```

---

## Best Practices

### 1. Choose the Right Approach

**Use Faux-SQL when**:

- ✅ Simple access patterns (get by ID, query by attribute)
- ✅ SQL-like mental model preferred
- ✅ Team familiar with relational databases
- ✅ Clear entity boundaries

**Use Single-Table when**:

- ✅ Complex access patterns (multiple entity types in one query)
- ✅ Need to minimize costs (fewer tables)
- ✅ Team experienced with DynamoDB
- ✅ High-scale requirements

### 2. Use Descriptive Key Names (Faux-SQL)

✅ **Good**:

```typescript
partitionKey: { name: "MerchantId", type: "S" }
```

❌ **Bad**:

```typescript
partitionKey: { name: "PK", type: "S" } // Too generic!
```

### 3. Enable Point-in-Time Recovery

```typescript
pointInTimeRecovery: true; // Always enable for production
```

### 4. Protect Production Tables

```typescript
deletionProtection: envName !== "local"; // Prevent accidental deletion
```

### 5. Use PAY_PER_REQUEST for Variable Workloads

```typescript
billingMode: "PAY_PER_REQUEST"; // No capacity planning needed
```

---

## Troubleshooting

### Error: "Table not found"

**Cause**: Table not defined in config or not deployed.

**Solution**:

1. Check `config/database.ts` for table definition
2. Redeploy with `npm run cdk:deploy`

### Error: "Attribute not defined"

**Cause**: Trying to use attribute in key that's not defined.

**Solution**: Add attribute to `AttributeDefinitions`:

```typescript
attributes: [
  { name: "MerchantId", type: "S" },
  { name: "GSI1PK", type: "S" }, // Add missing attribute
];
```

### Table Already Exists Error

**Cause**: Table name conflict or previous deployment failed.

**Solution**:

1. Check AWS Console for existing table
2. Delete manually if needed
3. Redeploy

---

## Related Guides

- [Database Setup Guide](../database-setup.md) - Comprehensive database guide
- [Data Access Layer](../data-access.md) - DynamoDB operations
- [Configuration Management README](./README.md)
