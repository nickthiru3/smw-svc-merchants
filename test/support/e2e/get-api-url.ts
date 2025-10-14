import fs from "fs";
import path from "path";

/**
 * Attempts to read the API base URL from a local CDK outputs file.
 *
 * Supported files (searched in this order):
 * - ./outputs.json (generated via cdk deploy --outputs-file outputs.json or localstack deploy)
 *
 * Heuristics:
 * - Finds the first string value that looks like an API Gateway invoke URL (execute-api) or generic https URL.
 */
export function getApiBaseUrlFromOutputs(): string | null {
  const candidates = [path.resolve(process.cwd(), "outputs.json")];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = fs.readFileSync(file, "utf8");
      const json = JSON.parse(raw) as Record<string, any>;

      // Search all string values recursively for an API URL
      const found: string[] = [];
      const visit = (v: any) => {
        if (typeof v === "string") {
          if (/^https?:\/\//.test(v)) {
            found.push(v);
          }
          return;
        }
        if (Array.isArray(v)) {
          v.forEach(visit);
          return;
        }
        if (v && typeof v === "object") {
          Object.values(v).forEach(visit);
        }
      };
      visit(json);

      // Prefer execute-api URLs, else first https URL
      const apiUrl =
        found.find((u) => u.includes("execute-api")) ??
        found.find((u) => /^https?:\/\//.test(u));

      if (apiUrl) {
        // Normalize by stripping any trailing slashes
        return apiUrl.replace(/\/$/, "");
      }
    } catch (e) {
      // ignore and continue
    }
  }

  return null;
}
