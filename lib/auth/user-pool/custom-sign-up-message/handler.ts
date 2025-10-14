/**
 * Cognito Custom Message Lambda Trigger
 *
 * This Lambda function customizes the email verification message based on user type.
 * It's triggered when Cognito sends verification emails, forgot password emails, etc.
 *
 * It modifies the event.response properties to customize the email content
 * that Cognito sends to users.
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
 */

export const handler = async (event: any) => {
  console.log("Custom Message event:", JSON.stringify(event, null, 2));

  // Only customize messages for sign-up
  if (event.triggerSource !== "CustomMessage_SignUp") {
    console.log(
      `Not customizing message for trigger source: ${event.triggerSource}`
    );
    return event;
  }

  // Get the user attributes
  const userAttributes = event.request.userAttributes || {};
  const username = userAttributes.email || "";

  // Determine user type (merchant or customer)
  const userType = userAttributes["custom:userType"] || "";
  const isMerchant = userType === "merchant";

  // Get the app URL from environment variables
  const websiteUrl = process.env.WEBSITE_URL;

  // Get the verification code
  const code = event.request.codeParameter;

  // Business name for merchants
  const businessName = userAttributes.name || "Merchant";

  // Current year for copyright
  const year = new Date().getFullYear();

  // Create a confirmation URL - only passing the username, not the code
  const confirmationUrl = `${websiteUrl}/accounts/confirm-sign-up?username=${encodeURIComponent(
    username
  )}`;

  try {
    // Create a custom email message based on user type
    let emailSubject = "";
    let emailMessage = "";

    if (isMerchant) {
      emailSubject = "Verify your merchant account for Super Deals";
      emailMessage = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3B5998; color: white; padding: 10px; text-align: center; }
            .content { padding: 20px; }
            .code { font-size: 24px; font-weight: bold; color: #3B5998; }
            .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Super Deals!</h1>
            </div>
            <div class="content">
              <p>Hello ${businessName},</p>
              <p>Thank you for registering as a merchant on Super Deals. To complete your registration, please verify your email address using the verification code below:</p>
              <p class="code">${code}</p>
              <p>You can also click the button below to go to the verification page:</p>
              <p style="text-align: center;"><a href="${confirmationUrl}" style="display: inline-block; background-color: #3B5998; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a></p>
              <p>If you did not request this verification, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${year} Super Deals. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      emailSubject = "Verify your Super Deals account";
      emailMessage = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2196F3; color: white; padding: 10px; text-align: center; }
            .content { padding: 20px; }
            .code { font-size: 24px; font-weight: bold; color: #2196F3; }
            .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Super Deals!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for registering on Super Deals. To complete your registration, please verify your email address using the verification code below:</p>
              <p class="code">${code}</p>
              <p>You can also click the button below to go to the verification page:</p>
              <p style="text-align: center;"><a href="${confirmationUrl}" style="display: inline-block; background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a></p>
              <p>If you did not request this verification, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${year} Super Deals. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Set the custom message in the response
    event.response.emailSubject = emailSubject;
    event.response.emailMessage = emailMessage;

    console.log("Custom email message created successfully");
  } catch (error) {
    console.error("Error in custom message handler:", error);
    // In case of error, return the original event to allow default message
  }

  // Return the modified event to Cognito
  return event;
};
