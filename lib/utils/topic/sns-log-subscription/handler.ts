import { SNSEvent } from "aws-lambda";

export const handler = async (
  event: SNSEvent
): Promise<{ statusCode: number; body: string }> => {
  try {
    // Extract messages from SNS event
    const records = event.Records || [];

    for (const record of records) {
      if (record.Sns) {
        // Log the SNS message
        console.log(
          JSON.stringify({
            message: record.Sns.Message,
            subject: record.Sns.Subject,
            timestamp: record.Sns.Timestamp,
            topicArn: record.Sns.TopicArn,
            messageId: record.Sns.MessageId,
          })
        );
      }
    }

    return { statusCode: 200, body: "Messages logged successfully" };
  } catch (error) {
    console.error("Error processing SNS message:", error);
    return { statusCode: 500, body: "Error processing message" };
  }
};
