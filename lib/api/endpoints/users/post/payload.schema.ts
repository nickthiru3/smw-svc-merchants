import { z } from "zod";

// Lightweight validators to avoid deprecated zod string helpers
const isValidEmail = (v: string) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(v);
const isValidUrl = (v: string) => {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

// Zod schema mirroring API Gateway model for merchant sign-up
export const merchantPayloadSchema = z.object({
  userType: z.literal("merchant"),
  email: z.string().refine(isValidEmail, { message: "Invalid email address" }),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/),
  businessName: z.string().min(1),
  registrationNumber: z.string().min(1),
  yearOfRegistration: z.number().int().gte(1900).lte(new Date().getFullYear()),
  website: z
    .string()
    .refine(isValidUrl, { message: "Invalid URL" })
    .optional(),
  address: z.object({
    buildingNumber: z.string().min(1),
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
  }),
  phone: z.string().min(1),
  primaryContact: z.object({
    name: z.string().min(1),
    email: z
      .string()
      .refine(isValidEmail, { message: "Invalid email address" }),
    phone: z.string().min(1),
  }),
  productCategories: z.array(z.string().min(1)).min(1),
});

export type TMerchantPayloadSchema = z.infer<typeof merchantPayloadSchema>;
