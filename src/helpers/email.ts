/**
 * AWS SES Email Helpers
 *
 * Provides utilities for sending templated emails via Amazon SES.
 * Supports template validation, configuration sets, and message tagging
 * for CloudWatch event tracking.
 *
 * @module helpers/email
 */

import {
  SESClient,
  SendTemplatedEmailCommand,
  GetTemplateCommand,
  SendTemplatedEmailCommandInput,
  MessageTag,
} from "@aws-sdk/client-ses";
import { apiError } from "./api";

/**
 * Checks if an SES email template exists
 *
 * Verifies that the specified template exists in SES and logs its structure
 * for debugging. Returns false if template doesn't exist or check fails,
 * allowing the caller to handle the error appropriately.
 *
 * @param sesClient - Configured SES client instance
 * @param emailTemplateName - Name of the SES template to check
 * @returns True if template exists, false otherwise
 *
 * @example
 * const sesClient = new SESClient({ region: "us-east-1" });
 * const exists = await isEmailTemplateExists(sesClient, "welcome-merchant");
 * if (!exists) {
 *   console.error("Template not found");
 * }
 *
 * @remarks
 * - Logs template structure when found for debugging
 * - Returns false on any error (template not found, permission issues, etc.)
 * - Does not throw errors, allowing graceful degradation
 *
 * @internal This is a private helper function
 */
async function isEmailTemplateExists(
  sesClient: SESClient,
  emailTemplateName: string
) {
  // Verify the template exists and log its structure
  try {
    const templateResponse = await sesClient.send(
      new GetTemplateCommand({ TemplateName: emailTemplateName })
    );
    console.log(
      "(+) Template found:",
      JSON.stringify(templateResponse.Template, null, 2)
    );
    return true;
  } catch (error: any) {
    console.error("(!) Error getting template:", error.message);
    // Continue with sending attempt even if template check fails
    return false;
  }
}

/**
 * Sends a templated email via Amazon SES
 *
 * Sends an email using a pre-configured SES template with dynamic data.
 * Supports configuration sets for tracking and message tags for CloudWatch
 * event filtering.
 *
 * @param sesClient - Configured SES client instance
 * @param emailTemplateName - Name of the SES template to use
 * @param emailAddress - Recipient email address
 * @param templateData - Data to populate template variables
 * @param sourceEmail - Sender email address (must be verified in SES)
 * @param configurationSetName - Optional SES configuration set for event tracking
 * @param tags - Optional message tags for CloudWatch event filtering
 * @returns SES send response or API error response
 *
 * @example
 * // Send welcome email to merchant
 * const sesClient = new SESClient({ region: "us-east-1" });
 * await sendEmail(
 *   sesClient,
 *   "welcome-merchant",
 *   "merchant@example.com",
 *   {
 *     businessName: "Acme Corp",
 *     loginUrl: "https://app.example.com/login",
 *     supportEmail: "support@example.com"
 *   },
 *   "noreply@example.com"
 * );
 *
 * @example
 * // Send email with configuration set and tags
 * await sendEmail(
 *   sesClient,
 *   "welcome-merchant",
 *   "merchant@example.com",
 *   { businessName: "Acme Corp" },
 *   "noreply@example.com",
 *   "email-tracking",
 *   [{ Name: "ses-event-type", Value: "welcome-email" }]
 * );
 *
 * @remarks
 * - Validates template exists before sending
 * - Returns 404 error if template not found
 * - Logs full SES parameters for debugging
 * - Automatically adds default tag if configuration set provided but no tags
 * - Throws on SES send errors (caller should handle)
 *
 * @throws {Error} SES send errors (network, permissions, invalid template data, etc.)
 *
 * @see {@link isEmailTemplateExists} for template validation
 */
export async function sendEmail(
  sesClient: SESClient,
  emailTemplateName: string,
  emailAddress: string,
  templateData: Record<string, unknown>,
  sourceEmail: string,
  configurationSetName?: string,
  tags?: MessageTag[]
) {
  const isTemplateExists = await isEmailTemplateExists(
    sesClient,
    emailTemplateName
  );

  if (!isTemplateExists) {
    console.error("(!) Template not found:", emailTemplateName);
    return apiError(404, "Template not found", emailTemplateName);
  }

  try {
    const params: SendTemplatedEmailCommandInput = {
      Source: sourceEmail,
      Destination: {
        ToAddresses: [emailAddress],
      },
      Template: emailTemplateName,
      TemplateData: JSON.stringify(templateData),
    };

    if (configurationSetName) {
      params.ConfigurationSetName = configurationSetName;

      // Add message tags if provided
      // These are required for CloudWatch event destinations with message tag dimension sources
      if (tags && tags.length > 0) {
        params.Tags = tags;
      } else {
        params.Tags = [
          {
            Name: "ses-event-type",
            Value: "welcome-email",
          },
        ];
      }
    }

    // Log the full parameters being sent to SES
    console.log(
      "(+) SendTemplatedEmailCommand params:",
      JSON.stringify(params, null, 2)
    );

    const response = await sesClient.send(
      new SendTemplatedEmailCommand(params)
    );

    console.log(
      "(+) SendEmailCommand response: " + JSON.stringify(response, null, 2)
    );

    return response;
  } catch (error: any) {
    console.error("Error in sendEmail:", error);
    throw error;
  }
}
