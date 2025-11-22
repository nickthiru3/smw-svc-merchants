/**
 * GitHub Configuration
 *
 * GitHub repository and CodeStar connection configuration for CI/CD.
 * Only required for non-local environments.
 *
 * @module config/github
 */

import { z } from "zod";
import type { IGitHubConfig } from "./types";

/**
 * Zod schema for GitHub configuration validation
 */
const GitHubConfigSchema = z.object({
  repo: z.string().min(1, "GitHub repository is required"),
  branch: z.string().min(1, "GitHub branch is required"),
  codestarConnectionId: z.string().min(1, "CodeStar connection ID is required"),
});

/**
 * Get CodeStar connection ID with fallback hierarchy:
 * 1. Environment variable (for local development)
 * 2. Parameter Store lookup (for deployed environments)
 * 3. Error (no fallback to prevent deployment with placeholder)
 *
 * @param envName - Environment name (local, dev, staging, production)
 * @returns CodeStar connection ID or SSM parameter reference
 */
function getCodeStarConnectionId(envName: string): string {
  // First try environment variable (local development override)
  if (process.env.CODESTAR_CONNECTION_ID) {
    return process.env.CODESTAR_CONNECTION_ID;
  }

  // For deployed environments, use Parameter Store lookup
  // This returns a token that will be resolved during deployment
  return `{{resolve:ssm:/platform/${envName}/github/codestar-connection-id}}`;
}

/**
 * Create GitHub configuration for the given environment
 *
 * @param envName - Environment name (local, dev, staging, production)
 * @returns GitHub configuration or undefined for local environment
 */
export function createGitHubConfig(envName: string): IGitHubConfig | undefined {
  // Local environment doesn't need GitHub config
  if (envName === "local") {
    return undefined;
  }

  // Non-local environments require GitHub config
  const repo = process.env.GITHUB_REPO;
  if (!repo) {
    throw new Error(
      "GitHub repository is required. Set GITHUB_REPO environment variable."
    );
  }

  const rawConfig = {
    repo,
    branch: process.env.GITHUB_BRANCH || "release",
    codestarConnectionId: getCodeStarConnectionId(envName),
  };

  // Validate GitHub config
  const result = GitHubConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new Error(
      `Invalid GitHub configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  return result.data;
}
