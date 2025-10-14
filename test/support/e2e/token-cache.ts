import fs from "fs";
import path from "path";

/**
 * Minimal bearer token cache for E2E tests.
 *
 * Source of truth is a project-root file at ./.e2e/token.json with shape:
 * {
 *   "token": "<JWT>",
 *   "expiresAt": "2025-01-02T03:04:05.000Z"
 * }
 *
 * Rationale:
 * - Keeps secrets out of .env and avoids scattering process.env usage in code.
 * - Lets you supply the token via an external acquisition process (e.g., Cognito auth flow).
 * - E2E tests simply read the file; if missing/expired, tests are skipped with guidance.
 */
export function getBearerTokenIfAvailable(profile?: string): string | null {
  const suffix = profile ? `.${profile}` : "";
  const file = path.resolve(process.cwd(), ".e2e", `token${suffix}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw) as { token?: string; expiresAt?: string };
    if (!data?.token) return null;
    if (data.expiresAt) {
      const now = Date.now();
      const exp = Date.parse(data.expiresAt);
      if (Number.isFinite(exp) && exp - now <= 60_000) {
        // Consider token expired (or about to) within 60s safety window
        return null;
      }
    }
    return data.token;
  } catch {
    return null;
  }
}

/**
 * Optional helper to persist a token.
 * Not used automatically by tests (to avoid unwanted writes); provided for convenience.
 */
export function saveBearerToken(token: string, expiresAt?: string, profile?: string): void {
  const dir = path.resolve(process.cwd(), ".e2e");
  const suffix = profile ? `.${profile}` : "";
  const file = path.join(dir, `token${suffix}.json`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const payload = { token, ...(expiresAt ? { expiresAt } : {}) };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { encoding: "utf8" });
}
