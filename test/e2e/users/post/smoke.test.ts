import request from "supertest";
import { getApiBaseUrlFromOutputs } from "#test/support/e2e/get-api-url.js";

// Prefer outputs.json; allow explicit override via TEST_API_URL only if provided (for emergencies)
const resolvedApiUrl = getApiBaseUrlFromOutputs() || process.env.TEST_API_URL;

const preconditionsOk = Boolean(resolvedApiUrl);
const maybeDescribe = preconditionsOk ? describe : describe.skip;

maybeDescribe("E2E: POST /users (merchant sign-up)", () => {
  const client = request(resolvedApiUrl!);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Note: This endpoint is public (no auth required for sign-up)

  test("returns 201 with userId on valid merchant payload", async () => {
    const timestamp = Date.now();
    const body = {
      userType: "merchant",
      email: `e2e-merchant-${timestamp}@example.com`,
      password: "E2eTest123!@#",
      businessName: `E2E Test Business ${timestamp}`,
      registrationNumber: `E2E-REG-${timestamp}`,
      yearOfRegistration: 2020,
      website: "https://e2e-test.example.com",
      address: {
        buildingNumber: "123",
        street: "E2E Test Street",
        city: "TestCity",
        state: "TS",
        zip: "12345",
        country: "TestCountry",
      },
      phone: "+1234567890",
      primaryContact: {
        name: "E2E Test Contact",
        email: `e2e-contact-${timestamp}@example.com`,
        phone: "+1234567890",
      },
      productCategories: ["Electronics"],
    };

    const res = await client.post("/users").set(headers).send(body);
    expect([200, 201]).toContain(res.status); // allow either status
    expect(res.body).toHaveProperty("userId");
    expect(typeof res.body.userId).toBe("string");
    expect(res.body).toHaveProperty("userType", "merchant");
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("registered");
  }, 20000);

  test("returns 400 on invalid payload (missing businessName)", async () => {
    const timestamp = Date.now();
    const bad = {
      userType: "merchant",
      email: `e2e-bad-${timestamp}@example.com`,
      password: "E2eTest123!@#",
      // businessName missing
      registrationNumber: `E2E-REG-${timestamp}`,
      yearOfRegistration: 2020,
      address: {
        buildingNumber: "123",
        street: "E2E Test Street",
        city: "TestCity",
        state: "TS",
        zip: "12345",
        country: "TestCountry",
      },
      phone: "+1234567890",
      primaryContact: {
        name: "E2E Test Contact",
        email: `e2e-contact-${timestamp}@example.com`,
        phone: "+1234567890",
      },
      productCategories: ["Electronics"],
    } as any;

    const res = await client.post("/users").set(headers).send(bad);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  }, 15000);

  test("returns 400 on invalid email format", async () => {
    const timestamp = Date.now();
    const bad = {
      userType: "merchant",
      email: "not-an-email", // invalid email
      password: "E2eTest123!@#",
      businessName: `E2E Test Business ${timestamp}`,
      registrationNumber: `E2E-REG-${timestamp}`,
      yearOfRegistration: 2020,
      address: {
        buildingNumber: "123",
        street: "E2E Test Street",
        city: "TestCity",
        state: "TS",
        zip: "12345",
        country: "TestCountry",
      },
      phone: "+1234567890",
      primaryContact: {
        name: "E2E Test Contact",
        email: `e2e-contact-${timestamp}@example.com`,
        phone: "+1234567890",
      },
      productCategories: ["Electronics"],
    };

    const res = await client.post("/users").set(headers).send(bad);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  }, 15000);

  test("returns 409 when user already exists", async () => {
    const timestamp = Date.now();
    const body = {
      userType: "merchant",
      email: `e2e-duplicate-${timestamp}@example.com`,
      password: "E2eTest123!@#",
      businessName: `E2E Test Business ${timestamp}`,
      registrationNumber: `E2E-REG-${timestamp}`,
      yearOfRegistration: 2020,
      address: {
        buildingNumber: "123",
        street: "E2E Test Street",
        city: "TestCity",
        state: "TS",
        zip: "12345",
        country: "TestCountry",
      },
      phone: "+1234567890",
      primaryContact: {
        name: "E2E Test Contact",
        email: `e2e-contact-${timestamp}@example.com`,
        phone: "+1234567890",
      },
      productCategories: ["Electronics"],
    };

    // First request should succeed
    const res1 = await client.post("/users").set(headers).send(body);
    expect([200, 201]).toContain(res1.status);

    // Second request with same email should fail with 409
    const res2 = await client.post("/users").set(headers).send(body);
    expect(res2.status).toBe(409);
    expect(res2.body).toHaveProperty("error");
    expect(res2.body.error).toContain("already exists");
  }, 30000);
});

maybeDescribe("E2E: GET /.well-known/bindings", () => {
  const client = request(resolvedApiUrl!);

  test("returns 200 with service bindings", async () => {
    const res = await client.get("/.well-known/bindings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("service");
    expect(res.body).toHaveProperty("env");
    expect(res.body).toHaveProperty("region");
  }, 15000);
});

if (!resolvedApiUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    "[E2E] Skipping E2E tests: missing API URL. Ensure outputs.json is present (generated via `cdk deploy --outputs-file outputs.json`)."
  );
}
