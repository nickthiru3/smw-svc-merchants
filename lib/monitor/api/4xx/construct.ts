import { Construct } from "constructs";
import { Alarm, Metric, Unit } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Topic } from "aws-cdk-lib/aws-sns";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import path from "path";
import type { IConfig } from "#config/default";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

interface IAlarm4xxConstructProps {
  readonly config: IConfig;
  readonly ssmBindings: SsmBindingsConstruct;
}

class Alarm4xxConstruct extends Construct {
  alarm4xx: Alarm;

  constructor(scope: Construct, id: string, props: IAlarm4xxConstructProps) {
    super(scope, id);

    const { config, ssmBindings } = props;

    const serviceName = config.service.name;

    const lambda = new NodejsFunction(this, "Lambda", {
      bundling: {
        externalModules: ["@aws-sdk"],
        forceDockerBundling: true,
      },
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.minutes(1),
      entry: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      depsLockFilePath: path.join(__dirname, "../../../../package-lock.json"),
      environment: {
        SLACK_WEBHOOK_URL: ssmBindings.monitor.slackWebhookUrl,
      },
    });

    const topic = new Topic(this, "Topic", {
      displayName: "Api4xxAlarmTopic",
      topicName: `${serviceName}-Api4xxAlarmTopic`,
    });

    topic.addSubscription(new LambdaSubscription(lambda));

    const alarm4xx = new Alarm(this, "4xxAlarm", {
      metric: new Metric({
        metricName: "4XXError",
        namespace: "AWS/ApiGateway",
        period: Duration.minutes(1),
        statistic: "Sum",
        unit: Unit.COUNT,
        dimensionsMap: {
          ApiName: serviceName,
        },
      }),
      evaluationPeriods: 1,
      threshold: 5,
      alarmName: `${serviceName}-Api4xxAlarm`,
    });

    const topicAction = new SnsAction(topic);

    alarm4xx.addAlarmAction(topicAction);

    alarm4xx.addOkAction(topicAction);
  }
}

export default Alarm4xxConstruct;
