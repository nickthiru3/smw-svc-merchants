const htmlPart = `
  <mjml>
    <mj-head>
      <mj-title>Welcome to Super Deals - Start Saving Today!</mj-title>
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
            Hello {{customerName}},
          </mj-text>
          <mj-text>
            Congratulations! Your email has been verified and your Super Deals account is now active. We're excited to have you join our community of savvy shoppers.
          </mj-text>
          <mj-text font-weight="bold">
            Start Exploring Amazing Deals
          </mj-text>
          <mj-text>
            Super Deals brings you exclusive offers from top merchants across various categories. From dining and entertainment to retail and services, we've got incredible savings waiting for you.
          </mj-text>
          <mj-text>
            Here's what you can do now:
          </mj-text>
          <mj-text>
            <ul>
              <li>Browse the latest deals in your area</li>
              <li>Save your favorite offers for later</li>
              <li>Purchase and redeem deals instantly</li>
              <li>Set up deal alerts for categories you love</li>
            </ul>
          </mj-text>
          <mj-button background-color="#2196F3" color="white" href="{{dealsUrl}}" border-radius="4px" font-weight="bold" inner-padding="15px 30px" align="center">
            Explore Deals Now
          </mj-button>
          <mj-text>
            We regularly add new deals from our trusted merchant partners. Check back often to discover new savings opportunities or set up notifications to stay informed about deals in your favorite categories.
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Support Section -->
      <mj-section background-color="#ffffff" padding="0 20px 20px">
        <mj-column>
          <mj-divider border-color="#f0f0f0" padding="10px 0" />
          <mj-text>
            Need help? Contact our customer support team at {{supportEmail}}.
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
  templateName: "CustomerWelcome",
  subjectPart: "Welcome to Super Deals - Start Saving Today!",
  textPart:
    "Congratulations! Your email has been verified and your Super Deals account is now active. We're excited to have you join our community of savvy shoppers. Start exploring amazing deals from our trusted merchant partners today!",
  htmlPart: htmlPart,
  parsingOptions: {
    beautify: true,
  },
};

export default template;
