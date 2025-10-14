/**
 * Jest setup file
 *
 * This file runs before all tests and sets up the test environment.
 * It configures environment variables needed for testing.
 */

const defaultRegion = process.env.AWS_REGION ?? "us-east-1";

// Set default environment variables for tests
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "users";
process.env.AWS_REGION = defaultRegion;
process.env.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION ?? defaultRegion;
process.env.CDK_DEFAULT_REGION = process.env.CDK_DEFAULT_REGION ?? defaultRegion;
