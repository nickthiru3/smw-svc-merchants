import fs from "fs";
import path from "path";

/**
 * Loads optional E2E configuration from ./.e2e/e2e.config.json
 * Shape:
 * {
 *   "defaultProfile": "merchant"
 * }
 */
export function getDefaultProfile(): string | undefined {
  const file = path.resolve(process.cwd(), ".e2e", "e2e.config.json");
  try {
    if (!fs.existsSync(file)) return undefined;
    const raw = fs.readFileSync(file, "utf8");
    const json = JSON.parse(raw) as { defaultProfile?: string };
    return json.defaultProfile;
  } catch {
    return undefined;
  }
}
