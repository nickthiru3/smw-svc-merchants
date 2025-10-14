import { sendEmail } from "#src/helpers/email";

// Mock AWS SES SDK
const mockSend = jest.fn();

jest.mock("@aws-sdk/client-ses", () => ({
  SESClient: jest.fn(),
  SendTemplatedEmailCommand: jest.fn((params) => params),
  GetTemplateCommand: jest.fn((params) => params),
}));

describe("src/helpers/email", () => {
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const consoleLogSpy = jest
    .spyOn(console, "log")
    .mockImplementation(() => {});

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // Create a mock SES client with the send method
  const mockSesClient = {
    send: mockSend,
  } as any;

  beforeEach(() => {
    mockSend.mockClear();
    jest.clearAllMocks();
  });

  test("checks if template exists before sending", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        // GetTemplateCommand response
        Template: {
          TemplateName: "TestTemplate",
          SubjectPart: "Test Subject",
        },
      })
      .mockResolvedValueOnce({
        // SendTemplatedEmailCommand response
        MessageId: "test-message-id",
      });

    await sendEmail(
      mockSesClient,
      "TestTemplate",
      "test@example.com",
      { name: "Test User" },
      "source@example.com"
    );

    expect(mockSend).toHaveBeenCalledTimes(2);
    // First call should be GetTemplateCommand
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      TemplateName: "TestTemplate",
    });
    
    consoleLogSpy.mockRestore();
  });

  test("returns 404 error when template not found", async () => {
    mockSend.mockRejectedValueOnce(new Error("Template not found"));

    const result = await sendEmail(
      mockSesClient,
      "NonExistentTemplate",
      "test@example.com",
      { name: "Test User" },
      "source@example.com"
    );

    expect(result).toMatchObject({
      statusCode: 404,
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
    });

    const body = JSON.parse((result as any).body);
    expect(body.error).toBe("Template not found");
  });

  test("sends email with correct parameters", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        Template: { TemplateName: "TestTemplate" },
      })
      .mockResolvedValueOnce({
        MessageId: "test-message-id",
      });

    await sendEmail(
      mockSesClient,
      "TestTemplate",
      "recipient@example.com",
      { name: "John Doe", code: "123456" },
      "sender@example.com"
    );

    // Second call should be SendTemplatedEmailCommand
    expect(mockSend.mock.calls[1][0]).toMatchObject({
      Source: "sender@example.com",
      Destination: {
        ToAddresses: ["recipient@example.com"],
      },
      Template: "TestTemplate",
      TemplateData: JSON.stringify({ name: "John Doe", code: "123456" }),
    });
    
    consoleLogSpy.mockRestore();
  });

  test("includes configuration set when provided", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        Template: { TemplateName: "TestTemplate" },
      })
      .mockResolvedValueOnce({
        MessageId: "test-message-id",
      });

    await sendEmail(
      mockSesClient,
      "TestTemplate",
      "test@example.com",
      { name: "Test" },
      "source@example.com",
      "test-config-set"
    );

    expect(mockSend.mock.calls[1][0]).toMatchObject({
      ConfigurationSetName: "test-config-set",
    });
    
    consoleLogSpy.mockRestore();
  });

  test("includes custom tags when provided", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        Template: { TemplateName: "TestTemplate" },
      })
      .mockResolvedValueOnce({
        MessageId: "test-message-id",
      });

    const tags = [
      { Name: "ses-event-type", Value: "welcome-email" },
      { Name: "user-type", Value: "merchant" },
    ];

    await sendEmail(
      mockSesClient,
      "TestTemplate",
      "test@example.com",
      { name: "Test" },
      "source@example.com",
      "test-config-set",
      tags
    );

    expect(mockSend.mock.calls[1][0]).toMatchObject({
      Tags: tags,
    });
    
    consoleLogSpy.mockRestore();
  });

  test("uses default tag when configuration set provided but no tags", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        Template: { TemplateName: "TestTemplate" },
      })
      .mockResolvedValueOnce({
        MessageId: "test-message-id",
      });

    await sendEmail(
      mockSesClient,
      "TestTemplate",
      "test@example.com",
      { name: "Test" },
      "source@example.com",
      "test-config-set"
    );

    expect(mockSend.mock.calls[1][0]).toMatchObject({
      Tags: [
        {
          Name: "ses-event-type",
          Value: "welcome-email",
        },
      ],
    });
    
    consoleLogSpy.mockRestore();
  });

  test("does not include tags when no configuration set", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        Template: { TemplateName: "TestTemplate" },
      })
      .mockResolvedValueOnce({
        MessageId: "test-message-id",
      });

    await sendEmail(
      mockSesClient,
      "TestTemplate",
      "test@example.com",
      { name: "Test" },
      "source@example.com"
    );

    expect(mockSend.mock.calls[1][0]).not.toHaveProperty("Tags");
    
    consoleLogSpy.mockRestore();
  });

  test("throws error when SES send fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    
    mockSend
      .mockResolvedValueOnce({
        Template: { TemplateName: "TestTemplate" },
      })
      .mockRejectedValueOnce(new Error("SES send failed"));

    await expect(
      sendEmail(
        mockSesClient,
        "TestTemplate",
        "test@example.com",
        { name: "Test" },
        "source@example.com"
      )
    ).rejects.toThrow("SES send failed");
    
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
