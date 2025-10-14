import { JsonSchema, JsonSchemaType } from "aws-cdk-lib/aws-apigateway";

const merchantApiSchema: JsonSchema = {
  title: "MerchantsAccountSignUpModel",
  type: JsonSchemaType.OBJECT,
  required: [
    "userType",
    "email",
    "password",
    "businessName",
    "registrationNumber",
    "yearOfRegistration",
    "address",
    "phone",
    "primaryContact",
    "productCategories",
  ],
  properties: {
    userType: {
      type: JsonSchemaType.STRING,
      enum: ["merchant", "customer", "admin"],
    },
    email: {
      type: JsonSchemaType.STRING,
      format: "email",
    },
    password: {
      type: JsonSchemaType.STRING,
      minLength: 8,
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z\\d]).{8,}$",
      description:
        "Password must be at least 8 characters and contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    },
    businessName: {
      type: JsonSchemaType.STRING,
      minLength: 1,
    },
    registrationNumber: {
      type: JsonSchemaType.STRING,
      minLength: 1,
    },
    yearOfRegistration: {
      type: JsonSchemaType.INTEGER,
      minimum: 1900,
      maximum: new Date().getFullYear(),
    },
    website: {
      type: JsonSchemaType.STRING,
      format: "uri",
    },
    address: {
      type: JsonSchemaType.OBJECT,
      required: ["buildingNumber", "street", "city", "state", "zip", "country"],
      properties: {
        buildingNumber: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
        street: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
        city: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
        state: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
        zip: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
        country: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
      },
    },
    phone: {
      type: JsonSchemaType.STRING,
      minLength: 1,
    },
    primaryContact: {
      type: JsonSchemaType.OBJECT,
      required: ["name", "email", "phone"],
      properties: {
        name: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
        email: {
          type: JsonSchemaType.STRING,
          format: "email",
        },
        phone: {
          type: JsonSchemaType.STRING,
          minLength: 1,
        },
      },
    },
    productCategories: {
      type: JsonSchemaType.ARRAY,
      minItems: 1,
      items: {
        type: JsonSchemaType.STRING,
        enum: [
          "Electronics",
          "Clothing",
          "Home & Kitchen",
          "Beauty & Personal Care",
          "Books",
          "Toys & Games",
          "Sports & Outdoors",
          "Automotive",
          "Health & Wellness",
          "Food & Grocery",
          "Jewelry",
          "Office Supplies",
        ],
      },
    },
  },
};

export { merchantApiSchema };
