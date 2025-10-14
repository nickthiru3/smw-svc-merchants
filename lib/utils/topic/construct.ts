import { Construct } from "constructs";
import { Topic } from "aws-cdk-lib/aws-sns";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { CfnOutput } from "aws-cdk-lib";
import SnsToCloudWatchLogsSubscription from "./sns-log-subscription/construct";
import type { IConfig } from "#config/default";

interface ITopicConstructProps {
  readonly config: IConfig;
  readonly topicName: string;
}

class TopicConstruct extends Construct {
  topicName: string;

  constructor(scope: Construct, id: string, props: ITopicConstructProps) {
    super(scope, id);

    const { config, topicName } = props;

    const envName = config.envName;
    const serviceName = config.service.name;

    this.topicName = `${serviceName}/${envName}/${topicName}`;

    const topic = new Topic(this, "Topic", {
      topicName: this.topicName,
      displayName: this.topicName,
    });

    const sub = new SnsToCloudWatchLogsSubscription(this, "LogSubscription", {
      logGroupName: `sns/${this.topicName}`,
      retention: RetentionDays.ONE_MONTH,
      envName,
    });

    topic.addSubscription(sub);

    new CfnOutput(this, "TopicArn", {
      value: topic.topicArn,
      description: `ARN of the SNS topic for ${this.topicName}`,
      exportName: `${this.topicName}Arn`,
    });
  }
}

export default TopicConstruct;
