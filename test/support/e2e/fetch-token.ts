import fs from "fs";
import path from "path";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { saveBearerToken } from "./token-cache";

/**
 * Fetches a Cognito JWT using USER_PASSWORD_AUTH and caches it in ./.e2e/token.json
 * without using process.env in application code or bloating .env.
 *
 * Configuration file expected at ./.e2e/auth.config.json with shape:
 * {
 *   "region": "us-east-1",
 *   "clientId": "xxxxxxxx",
 *   "username": "merchant@example.com",
 *   "password": "<password>",
 *   // optional: "useIdToken": true  // default: AccessToken
 * }
 */
async function main() {
  const argv = process.argv.slice(2);
  const profileIndex = argv.indexOf("--profile");
  const profile = profileIndex >= 0 ? argv[profileIndex + 1] : undefined;

  const authFile = profile ? `auth.${profile}.json` : "auth.config.json";
  const configPath = path.resolve(process.cwd(), ".e2e", authFile);
  if (!fs.existsSync(configPath)) {
    console.error(
      `[E2E] Missing ${configPath}. Create it with { region, clientId, username, password }.`
    );
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw) as {
    region: string;
    clientId: string;
    username: string;
    password: string;
    useIdToken?: boolean;
  };

  if (!cfg.region || !cfg.clientId || !cfg.username || !cfg.password) {
    console.error(
      "[E2E] auth.config.json must include region, clientId, username, password"
    );
    process.exitCode = 1;
    return;
  }

  const client = new CognitoIdentityProviderClient({ region: cfg.region });
  const cmd = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: cfg.clientId,
    AuthParameters: {
      USERNAME: cfg.username,
      PASSWORD: cfg.password,
    },
  });

  const res = await client.send(cmd);
  const auth = res.AuthenticationResult;
  if (!auth) {
    console.error("[E2E] Failed to authenticate: no AuthenticationResult returned");
    process.exitCode = 1;
    return;
  }

  const token = cfg.useIdToken ? auth.IdToken : auth.AccessToken;
  const expiresInSec = auth.ExpiresIn ?? 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  if (!token) {
    console.error("[E2E] No token returned in AuthenticationResult");
    process.exitCode = 1;
    return;
  }

  saveBearerToken(token, expiresAt, profile);
  console.log(
    `[E2E] Token saved to .e2e/token${profile ? "." + profile : ""}.json; expiresAt: ${expiresAt}`
  );
}

main().catch((err) => {
  console.error("[E2E] Error fetching token:", err);
  process.exitCode = 1;
});
