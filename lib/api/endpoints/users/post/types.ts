// Types and interfaces for Users POST handler (merchant-first)

export type TUserType = "merchant" | "customer" | "admin";

export type TAllowedGroupKey = TUserType;

// Inferred from zod schema; re-exported type lives here for handler imports
export interface IUserProfile {
  PK: string;
  SK: string;
  userId: string;
  userType: TUserType;
  email: string;
  createdAt: string;
  updatedAt: string;
  GSI1PK: string;
  GSI1SK: string;
  businessName?: string;
  registrationNumber?: string;
  yearOfRegistration?: number;
  businessType?: string;
  website?: string;
  phone?: string;
  address?: unknown;
  primaryContact?: unknown;
  productCategories?: unknown;
}

export type TResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: import("#src/helpers/api").TApiResponse };

export interface IMerchantContext {
  env: { userPoolId: string; userPoolClientId: string; tableName: string };
  input: TNormalizedUserData;
  userAttributes?: import("@aws-sdk/client-cognito-identity-provider").AttributeType[];
  signUpResponse?: import("@aws-sdk/client-cognito-identity-provider").SignUpCommandOutput;
  userId?: string;
  userProfile?: IUserProfile;
  response?: import("#src/helpers/api").TApiResponse;
}

export type TMerchantStep = (
  ctx: IMerchantContext
) => Promise<IMerchantContext>;

// These types are defined in payload.zod.ts, but exported here for central access.
export type TMerchantPayloadSchema =
  import("./payload.schema").TMerchantPayloadSchema;
export type TNormalizedUserData = TMerchantPayloadSchema;
