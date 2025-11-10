# Merchants Microservice

AWS CDK TypeScript microservice for managing merchant data and operations.

**Service**: `svc-merchants`  
**Stack**: Serverless (API Gateway + Lambda + DynamoDB)  
**Data Modeling**: Faux-SQL DynamoDB design

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

## Project Structure

### CDK Application Flow

```
bin/app.ts (Entry Point)
├── Loads environment variables (.env)
├── Imports config from config/default.ts
├── Creates CDK App
├── Determines environment (dev vs staging/production)
└── Instantiates ServiceStack
    └── Passes: env, config, description, tags
```

**Key Insights**:

- **Environment-driven deployment**: Dev deploys directly, other envs use CI/CD pipeline
- **Configuration as single source of truth**: All settings flow from `config/default.ts`
- **Helper functions**: `makeEnv()`, `makeTags()`, `makeDescription()` standardize stack creation

### Configuration System (`config/default.ts`)

**Features**:

- **Zod validation**: Runtime config validation with clear error messages
- **Environment-specific overrides**: local, localstack, staging, production
- **Feature flags**: `features.permissionsEnabled`
- **Resource naming**: Prefixes for tables, buckets, functions, APIs
- **LocalStack support**: Custom endpoints for local development
- **SSM Parameter Store integration**: Dynamic config resolution

**Key Config Properties**:

```typescript
{
  envName: string; // Environment name
  accountId: string; // AWS account
  region: string; // AWS region
  service: {
    name: string; // e.g., "svc-merchants"
    displayName: string; // e.g., "Merchants Microservice"
  }
  resources: {
    tablePrefix: string; // DynamoDB table naming
    bucketPrefix: string; // S3 bucket naming
    functionPrefix: string; // Lambda function naming
    apiPrefix: string; // API Gateway naming
  }
  features: {
    permissionsEnabled: boolean; // OAuth scopes toggle
  }
}
```

### Service Stack Architecture (`lib/service-stack.ts`)

**Construct Orchestration** (Dependency Order):

```
ServiceStack
├── 1. SsmBindingsConstruct     (reads external configs)
├── 2. MonitorConstruct         (CloudWatch, SNS)
├── 3. DatabaseConstruct        (DynamoDB table)
├── 4. AuthConstruct            (Cognito User Pool, Identity Pool)
├── 5. IamConstruct             (IAM roles for users)
├── 6. PermissionsConstruct     (OAuth scopes - optional)
├── 7. ApiConstruct             (API Gateway + Lambda)
└── 8. SsmPublicationsConstruct (publishes service configs)
```

**Key Observations**:

- **Construct-based architecture**: Each construct is self-contained and reusable
- **Explicit dependencies**: Constructs passed as props to dependent constructs
- **Feature flags**: Permissions construct conditionally instantiated
- **Service discovery**: SSM publications enable cross-service communication

### Available Constructs

| Construct                    | Location                | Purpose                                |
| ---------------------------- | ----------------------- | -------------------------------------- |
| **SsmBindingsConstruct**     | `lib/ssm-bindings/`     | Read external service configs from SSM |
| **MonitorConstruct**         | `lib/monitor/`          | CloudWatch alarms, SNS topics          |
| **DatabaseConstruct**        | `lib/db/`               | DynamoDB table                         |
| **AuthConstruct**            | `lib/auth/`             | Cognito User Pool, Identity Pool       |
| **IamConstruct**             | `lib/iam/`              | IAM roles for authenticated users      |
| **PermissionsConstruct**     | `lib/permissions/`      | OAuth scopes (optional)                |
| **ApiConstruct**             | `lib/api/`              | API Gateway + Lambda endpoints         |
| **EventsConstruct**          | `lib/events/`           | SNS/EventBridge (future)               |
| **SsmPublicationsConstruct** | `lib/ssm-publications/` | Publish service configs                |

### API Endpoint Structure

**Pattern**: Nested construct hierarchy for endpoints

```
lib/api/
├── construct.ts                    # Main API Gateway setup
├── stage/construct.ts              # Deployment stages
├── authorization/construct.ts      # Cognito authorizer
└── endpoints/
    ├── construct.ts                # Endpoints orchestrator
    ├── users/                      # /users resource
    │   ├── construct.ts            # Resource setup
    │   └── post/                   # POST /users
    │       ├── construct.ts        # CDK infrastructure
    │       ├── handler.ts          # Lambda handler
    │       ├── helpers.ts          # Business logic
    │       ├── types.ts            # TypeScript types
    │       ├── api.schema.ts       # API Gateway validation schema
    │       └── payload.schema.ts   # Request/response schemas
    └── bindings/                   # /.well-known/bindings
        └── ...
```

**Endpoint Implementation Layers**:

1. **Resource Construct** (`users/construct.ts`): Creates API Gateway resource
2. **Method Construct** (`post/construct.ts`): Creates Lambda, validation, integration
3. **Handler** (`post/handler.ts`): Lambda entry point
4. **Helpers** (`post/helpers.ts`): Business logic, Cognito, DynamoDB operations
5. **Schemas** (`*.schema.ts`): Request/response validation

**Key Pattern**:

- Each HTTP method (GET, POST, PUT, DELETE) in its own directory
- Construct handles CDK infrastructure (Lambda, API Gateway, IAM)
- Handler is thin entry point
- Helpers contain business logic
- Schemas define validation rules

## Guides

- See the central guides index: [docs/guides/README.md](../docs/guides/README.md)
- Implementation guides: [docs/implementation/README.md](./docs/implementation/README.md)

## Secrets & Bindings

- We standardize secrets via SSM SecureString dynamic references, avoiding plaintext in templates.
- Slack webhook binding key is `slackWebhookUrl` at `monitor/slack/webhookUrl` under the private path for the `platform` producer.
- CDK injects `SLACK_WEBHOOK_URL` into monitoring Lambdas using a value like `{{resolve:ssm-secure:/super-deals/{ENV_NAME}/platform/private/monitor/slack/webhookUrl}}`, resolved via `SecretValue.ssmSecure()`.
- If you need to pin a specific SecureString version for a rollout, supply the version explicitly when calling `SecretValue.ssmSecure(parameterName, version)` in a custom construct.
