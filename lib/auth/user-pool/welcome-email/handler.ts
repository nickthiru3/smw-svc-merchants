/**
 * Cognito Post Confirmation Lambda Trigger
 *
 * This Lambda function is triggered after a user confirms their account (verifies their email).
 * Sends a welcome email to merchants and customers with account-specific information.
 *
 * Flow:
 * 1. User signs up and receives verification email
 * 2. User clicks verification link
 * 3. Cognito confirms account
 * 4. **This Lambda is triggered** (PostConfirmation_ConfirmSignUp)
 * 5. Lambda sends welcome email based on user type
 * 6. Returns event to continue Cognito flow
 *
 * Environment Variables (set by CDK):
 * - MERCHANT_EMAIL_TEMPLATE_NAME: SES template name for merchant welcome emails
 * - CUSTOMER_EMAIL_TEMPLATE_NAME: SES template name for customer welcome emails
 * - CONFIGURATION_SET_NAME: SES configuration set for event tracking
 * - WEBSITE_URL: Base URL for login/deals links
 * - SOURCE_EMAIL: Sender email address (must be verified in SES)
 *
 * @module auth/user-pool/welcome-email/handler
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
 */

import { SESClient } from "@aws-sdk/client-ses";
import { sendEmail } from "#src/helpers/email";

// Configure SES client
const sesClient = new SESClient({ region: "us-east-1" });

/**
 * Cognito Post Confirmation trigger handler
 *
 * Sends welcome emails to newly confirmed users based on their user type.
 * Handles both merchant and customer accounts with different email templates.
 *
 * @param event - Cognito Post Confirmation trigger event
 * @returns Original event object (required by Cognito to continue flow)
 *
 * @example
 * // Event structure (simplified)
 * {
 *   triggerSource: "PostConfirmation_ConfirmSignUp",
 *   request: {
 *     userAttributes: {
 *       email: "merchant@example.com",
 *       "custom:userType": "merchant",
 *       name: "Acme Corp"
 *     }
 *   }
 * }
 *
 * @remarks
 * Trigger Sources Processed:
 * - PostConfirmation_ConfirmSignUp: User confirmed email after sign-up
 *
 * Trigger Sources Ignored:
 * - PostConfirmation_ConfirmForgotPassword: User confirmed forgot password
 * - All other trigger sources
 *
 * User Types Supported:
 * - merchant: Sends merchant welcome email with business onboarding info
 * - customer: Sends customer welcome email with deals browsing info
 *
 * Error Handling:
 * - Errors are logged but not thrown
 * - User confirmation continues even if email fails
 * - This prevents email issues from blocking user sign-up
 *
 * CloudWatch Monitoring:
 * - Email events tagged with "ses-event-type: welcome-email"
 * - Enables filtering and alerting on welcome email delivery
 *
 * @see {@link sendEmail} for email sending implementation
 */
export const handler = async (event: any) => {
  console.log("Post Confirmation event:", JSON.stringify(event, null, 2));

  // Only process post confirmation events for sign-up
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    console.log(
      `Not processing event from trigger source: ${event.triggerSource}`
    );
    return event;
  }

  try {
    // Get the user attributes
    const userAttributes = event.request.userAttributes || {};
    const email = userAttributes.email;
    const userType = userAttributes["custom:userType"] || "";
    const name = userAttributes.name || "";
    const businessName =
      userType === "merchant" ? name || "Merchant" : name || "Customer";

    console.log(`Processing welcome email for user type: ${userType}`);

    // Skip if user type is not recognized
    if (userType !== "merchant" && userType !== "customer") {
      console.log(`Skipping welcome email for unknown user type: ${userType}`);
      return event;
    }

    console.log(`Sending welcome email to ${userType}: ${email}`);

    // Get the email template name based on user type
    let emailTemplateName;
    if (userType === "merchant") {
      emailTemplateName = process.env.MERCHANT_EMAIL_TEMPLATE_NAME;
      console.log("Using merchant email template:", emailTemplateName);
    } else {
      emailTemplateName = process.env.CUSTOMER_EMAIL_TEMPLATE_NAME;
      console.log("Using customer email template:", emailTemplateName);
    }

    if (!emailTemplateName) {
      console.error(`No email template found for user type: ${userType}`);
      return event;
    }

    // Get the configuration set name from environment variables
    const configurationSetName = process.env.CONFIGURATION_SET_NAME;
    if (configurationSetName) {
      console.log("Using configuration set:", configurationSetName);
    }

    // Prepare template data based on user type
    const websiteUrl = process.env.WEBSITE_URL;
    const loginUrl = `${websiteUrl}/accounts/sign-in`;
    const supportEmail = "support@super-deals.com";
    const currentYear = new Date().getFullYear();

    let templateData;
    if (userType === "merchant") {
      templateData = {
        businessName: businessName,
        loginUrl: loginUrl,
        supportEmail: supportEmail,
        currentYear: currentYear,
        year: currentYear, // Alternative variable name used in some templates
      };
    } else {
      // Customer template data
      templateData = {
        customerName: businessName, // Using the name as customerName for customers
        loginUrl: loginUrl,
        supportEmail: supportEmail,
        currentYear: currentYear,
        year: currentYear,
        dealsUrl: `${websiteUrl}/deals`,
      };
    }

    console.log("Template data:", JSON.stringify(templateData, null, 2));

    // Send the welcome email using the email service
    const sourceEmail = process.env.SOURCE_EMAIL || "superdeals616@gmail.com";

    // Create tags for CloudWatch event destination
    // These tags must match the dimension configuration in the SES monitoring construct
    const emailTags = [
      {
        Name: "ses-event-type", // Must match the dimension name in CloudWatch destination
        Value: "welcome-email",
      },
    ];

    const result = await sendEmail(
      sesClient,
      emailTemplateName,
      email,
      templateData,
      sourceEmail,
      configurationSetName,
      emailTags // Pass the tags for CloudWatch event logging
    );

    console.log("Welcome email sent successfully:", result);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw the error, as we don't want to block the user confirmation
    // Just log it and continue the flow
  }

  // Return the event object to continue the user confirmation flow
  return event;
};
