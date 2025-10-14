import { merchantPayloadSchema } from "#lib/api/endpoints/users/post/payload.schema";

describe("payload.schema.merchantPayloadSchema", () => {
  // Helper to create a valid base payload
  function makeValidPayload() {
    return {
      userType: "merchant" as const,
      email: "test@example.com",
      password: "Test123!@#",
      businessName: "Test Business",
      registrationNumber: "REG123456",
      yearOfRegistration: 2020,
      website: "https://example.com",
      address: {
        buildingNumber: "123",
        street: "Main St",
        city: "TestCity",
        state: "TS",
        zip: "12345",
        country: "TestCountry",
      },
      phone: "+1234567890",
      primaryContact: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
      },
      productCategories: ["Electronics"],
    };
  }

  test("accepts valid merchant payload", () => {
    const payload = makeValidPayload();
    const result = merchantPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  describe("userType validation", () => {
    test("accepts 'merchant' userType", () => {
      const payload = makeValidPayload();
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects non-merchant userType", () => {
      const payload = { ...makeValidPayload(), userType: "customer" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects missing userType", () => {
      const payload = makeValidPayload();
      delete (payload as any).userType;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("email validation", () => {
    test("accepts valid email", () => {
      const payload = { ...makeValidPayload(), email: "user@domain.com" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects invalid email format", () => {
      const payload = { ...makeValidPayload(), email: "not-an-email" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects missing email", () => {
      const payload = makeValidPayload();
      delete (payload as any).email;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("password validation", () => {
    test("accepts valid password with all requirements", () => {
      const payload = { ...makeValidPayload(), password: "ValidPass123!" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects password shorter than 8 characters", () => {
      const payload = { ...makeValidPayload(), password: "Test1!" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects password without lowercase letter", () => {
      const payload = { ...makeValidPayload(), password: "TEST123!@#" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects password without uppercase letter", () => {
      const payload = { ...makeValidPayload(), password: "test123!@#" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects password without digit", () => {
      const payload = { ...makeValidPayload(), password: "TestPass!@#" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects password without special character", () => {
      const payload = { ...makeValidPayload(), password: "TestPass123" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("businessName validation", () => {
    test("accepts non-empty businessName", () => {
      const payload = { ...makeValidPayload(), businessName: "My Business" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects empty businessName", () => {
      const payload = { ...makeValidPayload(), businessName: "" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects missing businessName", () => {
      const payload = makeValidPayload();
      delete (payload as any).businessName;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("yearOfRegistration validation", () => {
    test("accepts valid year", () => {
      const payload = { ...makeValidPayload(), yearOfRegistration: 2020 };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("accepts current year", () => {
      const currentYear = new Date().getFullYear();
      const payload = { ...makeValidPayload(), yearOfRegistration: currentYear };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects year before 1900", () => {
      const payload = { ...makeValidPayload(), yearOfRegistration: 1899 };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects year in the future", () => {
      const futureYear = new Date().getFullYear() + 1;
      const payload = { ...makeValidPayload(), yearOfRegistration: futureYear };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects non-integer year", () => {
      const payload = { ...makeValidPayload(), yearOfRegistration: 2020.5 };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("website validation", () => {
    test("accepts valid HTTPS URL", () => {
      const payload = { ...makeValidPayload(), website: "https://example.com" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("accepts valid HTTP URL", () => {
      const payload = { ...makeValidPayload(), website: "http://example.com" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("accepts URL with path", () => {
      const payload = { ...makeValidPayload(), website: "https://example.com/path" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects invalid URL", () => {
      const payload = { ...makeValidPayload(), website: "not-a-url" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("accepts missing website (optional)", () => {
      const payload = makeValidPayload();
      delete (payload as any).website;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("address validation", () => {
    test("accepts valid address", () => {
      const payload = makeValidPayload();
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects missing address", () => {
      const payload = makeValidPayload();
      delete (payload as any).address;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects address with missing buildingNumber", () => {
      const payload = makeValidPayload();
      delete (payload.address as any).buildingNumber;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects address with empty street", () => {
      const payload = makeValidPayload();
      payload.address.street = "";
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("phone validation", () => {
    test("accepts non-empty phone", () => {
      const payload = { ...makeValidPayload(), phone: "+1234567890" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects empty phone", () => {
      const payload = { ...makeValidPayload(), phone: "" };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects missing phone", () => {
      const payload = makeValidPayload();
      delete (payload as any).phone;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("primaryContact validation", () => {
    test("accepts valid primaryContact", () => {
      const payload = makeValidPayload();
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects missing primaryContact", () => {
      const payload = makeValidPayload();
      delete (payload as any).primaryContact;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects primaryContact with invalid email", () => {
      const payload = makeValidPayload();
      payload.primaryContact.email = "not-an-email";
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects primaryContact with empty name", () => {
      const payload = makeValidPayload();
      payload.primaryContact.name = "";
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("productCategories validation", () => {
    test("accepts non-empty array of categories", () => {
      const payload = {
        ...makeValidPayload(),
        productCategories: ["Electronics", "Clothing"],
      };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test("rejects empty productCategories array", () => {
      const payload = { ...makeValidPayload(), productCategories: [] };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects missing productCategories", () => {
      const payload = makeValidPayload();
      delete (payload as any).productCategories;
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    test("rejects productCategories with empty string", () => {
      const payload = { ...makeValidPayload(), productCategories: [""] };
      const result = merchantPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
