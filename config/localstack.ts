import type { IConfig } from "./default";

/**
 * LocalStack development environment configuration
 *
 * This configuration is used when running the application against LocalStack
 * for local development and testing. All AWS services are emulated locally.
 */
export const localstackConfig: Partial<IConfig> = {
  envName: "localstack",
  region: "us-east-1",

  // GitHub/CodeStar configuration (not used in LocalStack)
  github: {
    repo: "nickthiru/super-deals-deals-ms",
    branch: "master",
    // CodeStar connection not needed for LocalStack
    codestarConnectionId: "not-applicable-localstack",
  },

  // AWS configuration for LocalStack
  aws: {
    region: "us-east-1",
    // LocalStack uses dummy credentials
    profile: "localstack",
  },

  // LocalStack endpoints
  endpoints: {
    // All AWS services point to LocalStack gateway
    dynamodb: "http://localhost:4566",
    s3: "http://localhost:4566",
    lambda: "http://localhost:4566",
    apigateway: "http://localhost:4566",
    sns: "http://localhost:4566",
    sqs: "http://localhost:4566",
    cloudwatch: "http://localhost:4566",
    logs: "http://localhost:4566",
    iam: "http://localhost:4566",
    sts: "http://localhost:4566",
    cloudformation: "http://localhost:4566",
  },

  // Resource naming (no account separation needed in LocalStack)
  resources: {
    // Simple naming since everything runs locally
    tablePrefix: "localstack-deals",
    bucketPrefix: "localstack-deals",
    functionPrefix: "localstack-deals",
    apiPrefix: "localstack-deals",
  },

  // Development-specific settings
  development: {
    // Enable verbose logging for debugging
    enableDebugLogs: true,
    // Faster Lambda cold starts in LocalStack
    lambdaTimeout: 30,
    // Local development features
    enableHotReload: true,
    // Skip some validations for faster development
    skipValidations: true,
  },
};

export default localstackConfig;
