# Architecture Overview

**Service**: Merchants Microservice

---

## Stack Architecture

The Merchants microservice uses a construct-based architecture where each construct encapsulates a specific piece of infrastructure.

### High-Level Diagram

```
ServiceStack
├── SsmBindingsConstruct (reads external service configs)
├── MonitorConstruct (CloudWatch alarms, SNS topics)
├── DatabaseConstruct (DynamoDB table)
├── AuthConstruct (Cognito User Pool, Identity Pool, Groups)
├── IamConstruct (IAM roles for authenticated users)
├── PermissionsConstruct (OAuth scopes, resource server) [optional]
├── ApiConstruct (API Gateway, Lambda endpoints)
└── SsmPublicationsConstruct (publishes service configs to SSM)
```

### Dependency Flow

1. **SSM Bindings** (no dependencies) - Reads configurations from other services
2. **Monitor** (depends on SSM Bindings) - Sets up CloudWatch alarms and SNS topics
3. **Database** (no dependencies) - Creates DynamoDB table
4. **Auth** (depends on SSM Bindings, Monitor) - Creates Cognito resources
5. **IAM** (depends on Auth) - Creates IAM roles for authenticated users
6. **Permissions** (depends on IAM, Auth) [optional] - Sets up OAuth scopes
7. **API** (depends on Auth, Database, Permissions) - Creates API Gateway and Lambda functions
8. **SSM Publications** (depends on Auth, IAM) - Publishes service configs for other services

---

## Constructs

### Core Infrastructure

#### DatabaseConstruct (`lib/db/construct.ts`)

- Creates DynamoDB table for merchant data
- Configures GSIs for access patterns
- Sets up point-in-time recovery
- Configures billing mode (on-demand or provisioned)

**Key Resources**:

- DynamoDB Table: `{env}-merchants-table`
- GSI1: For waste category queries
- GSI2: For status queries

#### ApiConstruct (`lib/api/construct.ts`)

- Creates API Gateway REST API
- Defines Lambda functions for endpoints
- Configures Cognito authorizer
- Sets up CORS and throttling

**Key Resources**:

- API Gateway: `{env}-merchants-api`
- Lambda Functions: One per endpoint
- API Gateway Authorizer: Cognito-based

#### AuthConstruct (`lib/auth/construct.ts`)

- Creates Cognito User Pool
- Creates Cognito Identity Pool
- Defines user groups (merchants, consumers, admins)
- Configures password policies and MFA

**Key Resources**:

- User Pool: `{env}-merchants-user-pool`
- Identity Pool: `{env}-merchants-identity-pool`
- User Groups: merchants, consumers, admins

### Supporting Infrastructure

#### MonitorConstruct (`lib/monitor/construct.ts`)

- Creates CloudWatch alarms for Lambda errors
- Creates CloudWatch alarms for API Gateway errors
- Creates SNS topic for alarm notifications
- Configures email subscriptions

**Key Resources**:

- SNS Topic: `{env}-merchants-alarms`
- CloudWatch Alarms: Lambda errors, API errors, DynamoDB throttling

#### IamConstruct (`lib/iam/construct.ts`)

- Creates IAM roles for authenticated users
- Defines policies for DynamoDB access
- Configures assume role policies

**Key Resources**:

- IAM Role: `{env}-merchants-authenticated-role`

#### PermissionsConstruct (`lib/permissions/construct.ts`) [Optional]

- Creates OAuth resource server
- Defines OAuth scopes
- Configures scope-based authorization

**Key Resources**:

- Resource Server: `{env}-merchants-resource-server`
- OAuth Scopes: read:merchants, write:merchants

### Service Discovery

#### SsmBindingsConstruct (`lib/ssm-bindings/construct.ts`)

- Reads SSM parameters from other services
- Provides typed access to external configurations
- Handles parameter not found errors

**Example**:

```typescript
const userPoolId = ssmBindings.getUserPoolId("users");
const ordersApiUrl = ssmBindings.getApiUrl("orders");
```

#### SsmPublicationsConstruct (`lib/ssm-publications/construct.ts`)

- Publishes service configurations to SSM
- Makes service resources discoverable by other services
- Follows SSM parameter naming conventions

**Published Parameters**:

- `/super-deals/{env}/merchants/public/api/url` - API Gateway URL
- `/super-deals/{env}/merchants/public/auth/userPoolId` - Cognito User Pool ID
- `/super-deals/{env}/merchants/public/auth/identityPoolId` - Cognito Identity Pool ID

---

## Configuration Management

### Environment Configuration

Configuration is managed per environment in `config/{env}.ts`:

```typescript
export interface IConfig {
  envName: string;
  serviceName: string;
  region: string;

  dynamodb: {
    billingMode: "PAY_PER_REQUEST" | "PROVISIONED";
    pointInTimeRecovery: boolean;
  };

  api: {
    throttle: {
      rateLimit: number;
      burstLimit: number;
    };
  };

  monitoring: {
    alarmEmail: string;
  };
}
```

### SSM Parameter Conventions

See [SSM Bindings Pattern](../../../../docs/guides/patterns/ssm-bindings.md) for details.

**Parameter Naming**:

- Public: `/super-deals/{env}/{service}/public/{category}/{key}`
- Private: `/super-deals/{env}/{service}/private/{category}/{key}`

---

## Data Flow

### Request Flow

```
User → API Gateway → Lambda Handler → DynamoDB
                ↓
         Cognito Authorizer
```

1. **User** makes HTTP request to API Gateway
2. **API Gateway** validates request against Cognito authorizer
3. **Lambda Handler** processes request
   - Validates input
   - Queries DynamoDB
   - Formats response
4. **Response** returned to user

### Authentication Flow

```
User → Cognito → JWT Token → API Gateway → Lambda
```

1. **User** authenticates with Cognito
2. **Cognito** returns JWT token
3. **User** includes token in API requests
4. **API Gateway** validates token with Cognito
5. **Lambda** receives validated user context

---

## Deployment

### CDK Deployment

```bash
# Deploy to dev
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

### Stack Outputs

After deployment, stack outputs are written to `outputs.json`:

```json
{
  "dev-merchants-ms-ServiceStack": {
    "ApiUrl": "https://abc123.execute-api.us-east-1.amazonaws.com/prod",
    "UserPoolId": "us-east-1_ABC123",
    "IdentityPoolId": "us-east-1:abc-123-def-456",
    "TableName": "dev-merchants-table"
  }
}
```

---

## Monitoring & Observability

### CloudWatch Logs

Lambda function logs are sent to CloudWatch Logs:

- Log Group: `/aws/lambda/{env}-merchants-ms-{FunctionName}`
- Retention: 7 days (configurable)

### CloudWatch Metrics

Key metrics to monitor:

- **Lambda**: Invocations, Errors, Duration, Throttles
- **API Gateway**: Count, 4XXError, 5XXError, Latency
- **DynamoDB**: ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits, UserErrors

### CloudWatch Alarms

Alarms are configured for:

- Lambda errors > 5 in 1 minute
- API Gateway 5xx errors > 10 in 5 minutes
- DynamoDB throttling events

---

## Security

### IAM Least Privilege

- Lambda functions have minimal IAM permissions
- DynamoDB access is scoped to specific tables
- Cognito authorizer validates JWT tokens

### Secrets Management

- Secrets stored in SSM Parameter Store (SecureString)
- No hardcoded credentials in code
- Environment variables for non-sensitive config

### Input Validation

- All inputs validated at handler entry
- Schema validation for request bodies
- Query parameter validation

---

## Testing

### Unit Tests

- Test individual functions in `src/lib/`
- Mock AWS SDK calls
- Fast execution (<5s)

### Integration Tests

- Test with DynamoDB Local
- Test Lambda handlers end-to-end
- Verify data persistence

### CDK Tests

- Snapshot tests for constructs
- Fine-grained assertions for resources

---

## References

- **Implementation Guides**: `docs/implementation/`
- **Central Guides**: `docs/guides/`
- **CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **DynamoDB Best Practices**: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html
