import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import path from "path";

interface ISnsLogSubscriptionConstructProps {
  readonly logGroupName: string;
  readonly retention?: RetentionDays;
  readonly envName: string;
}

/**
 * A construct that creates an SNS subscription that logs messages to CloudWatch Logs
 */
class SnsLogSubscriptionConstruct extends Construct {
  logGroup: LogGroup;
  lambda: NodejsFunction;
  subscription: LambdaSubscription;

  constructor(
    scope: Construct,
    id: string,
    props: ISnsLogSubscriptionConstructProps
  ) {
    super(scope, id);

    const {
      logGroupName,
      retention = RetentionDays.ONE_MONTH,
      envName,
    } = props;

    const shouldProtectFromDeletion = envName !== "local" && envName !== "dev";

    // Create a log group
    const logGroup = new LogGroup(this, "LogGroup", {
      logGroupName,
      retention,
      removalPolicy: shouldProtectFromDeletion
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });

    // Create the Lambda function that will process SNS messages
    const lambda = new NodejsFunction(this, "Function", {
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
        LOG_GROUP_NAME: logGroup.logGroupName,
      },
    });

    // Grant permissions for the Lambda to write to the log group
    logGroup.grantWrite(lambda);

    // Create the subscription
    new LambdaSubscription(lambda);
  }
}

interface ISnsToCloudWatchLogsSubscriptionProps {
  readonly logGroupName: string;
  readonly retention: RetentionDays;
  readonly envName: string;
}

/**
 * A utility class that creates an SNS subscription for logging to CloudWatch
 */
class SnsToCloudWatchLogsSubscription extends LambdaSubscription {
  constructor(
    scope: Construct,
    id: string,
    props: ISnsToCloudWatchLogsSubscriptionProps
  ) {
    const { logGroupName, retention, envName } = props;

    // Create a full SnsLogSubscription construct
    const logSubscription = new SnsLogSubscriptionConstruct(scope, id, {
      logGroupName: logGroupName!,
      retention,
      envName,
    });

    // Call parent constructor with the Lambda from the subscription
    super(logSubscription.lambda);
  }
}

export default SnsToCloudWatchLogsSubscription;
