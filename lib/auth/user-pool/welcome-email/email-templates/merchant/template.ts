const htmlPart = `
  <mjml>
    <mj-head>
      <mj-title>Welcome to Super Deals Merchant Platform</mj-title>
      <mj-font name="Arial" href="https://fonts.googleapis.com/css?family=Arial" />
      <mj-attributes>
        <mj-all font-family="Arial, sans-serif" />
        <mj-text font-size="16px" line-height="1.6" />
      </mj-attributes>
    </mj-head>
    <mj-body background-color="#f9f9f9">
      <!-- Header Section -->
      <mj-section background-color="#2196F3" padding="20px">
        <mj-column>
          <mj-text color="#ffffff" font-size="24px" font-weight="bold" align="center">
            Welcome to Super Deals!
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Content Section -->
      <mj-section background-color="#ffffff" padding="20px">
        <mj-column>
          <mj-text>
            Hello {{businessName}},
          </mj-text>
          <mj-text>
            Congratulations! Your email has been verified and your Super Deals merchant account is now active. We're excited to have you join our platform.
          </mj-text>
          <mj-text font-weight="bold">
            Next Steps: Document Verification
          </mj-text>
          <mj-text>
            Before you can start creating and publishing deals, you'll need to complete the document verification process. This helps us ensure the security and quality of our marketplace.
          </mj-text>
          <mj-text>
            Please log in to your merchant dashboard and navigate to the "Document Verification" section to upload the following documents:
          </mj-text>
          <mj-text>
            <ul>
              <li>Business registration certificate</li>
              <li>Tax identification documents</li>
              <li>Proof of business address</li>
              <li>Owner/manager identification</li>
            </ul>
          </mj-text>
          <mj-button background-color="#2196F3" color="white" href="{{loginUrl}}" border-radius="4px" font-weight="bold" inner-padding="15px 30px" align="center">
            Sign In to Your Account
          </mj-button>
          <mj-text>
            Our team will review your documents within 1-2 business days. Once approved, you'll have full access to create and publish deals to our growing customer base.
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Support Section -->
      <mj-section background-color="#ffffff" padding="0 20px 20px">
        <mj-column>
          <mj-divider border-color="#f0f0f0" padding="10px 0" />
          <mj-text>
            Need help? Contact our merchant support team at {{supportEmail}}.
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Footer Section -->
      <mj-section background-color="#f9f9f9" padding="20px">
        <mj-column>
          <mj-text font-size="12px" color="#666" align="center">
            &copy; {{year}} Super Deals. All rights reserved.
          </mj-text>
          <mj-text font-size="12px" color="#666" align="center">
            This is an automated message, please do not reply.
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
`;

const template = {
  templateName: "MerchantWelcome",
  subjectPart: "Welcome to Super Deals - Next Steps for Your Merchant Account",
  textPart:
    "Congratulations! Your email has been verified and your Super Deals merchant account is now active. Before you can start creating deals, please complete the document verification process by signing in to your account.",
  htmlPart: htmlPart,
  parsingOptions: {
    beautify: true,
  },
};

export default template;
