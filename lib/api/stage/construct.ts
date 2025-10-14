import { Construct } from "constructs";
import {
  RestApi,
  Deployment,
  Stage,
  LogGroupLogDestination,
  AccessLogFormat,
  MethodLoggingLevel,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import type { IConfig } from "#config/default";

interface IStageConstructProps {
  readonly restApi: RestApi;
  readonly config: IConfig;
}

class StageConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IStageConstructProps) {
    super(scope, id);

    const { restApi, config } = props;

    const envName = config.envName;
    const serviceName = config.service.name;

    const shouldProtectFromDeletion = envName !== "local" && envName !== "dev";

    const accessLogGroup = new LogGroup(this, `AccessLogs`, {
      logGroupName: `/apigateway/${serviceName}/${envName}/access`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: shouldProtectFromDeletion
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });

    const deployment = new Deployment(this, `Deployment`, {
      api: restApi,
    });

    const stage = new Stage(this, `Stage`, {
      deployment,
      stageName: envName,
      accessLogDestination: new LogGroupLogDestination(accessLogGroup),
      accessLogFormat: AccessLogFormat.jsonWithStandardFields({
        caller: false,
        httpMethod: true,
        ip: true,
        protocol: true,
        requestTime: true,
        resourcePath: true,
        responseLength: true,
        status: true,
        user: true,
      }),
      methodOptions: {
        "/*/*": {
          loggingLevel: MethodLoggingLevel.INFO,
          dataTraceEnabled: true,
          metricsEnabled: true,
          throttlingBurstLimit: 10,
          throttlingRateLimit: 5,
        },
      },
    });

    // Set the default deployment stage
    if (envName === "dev") {
      restApi.deploymentStage = stage;
    }

    // Output the stage-specific URL with an alphanumeric logical ID
    new CfnOutput(this, `RestApiUrl-${serviceName}`, {
      value: stage.urlForPath("/"),
      exportName: `RestApiUrl-${serviceName}`,
    });
  }
}

export default StageConstruct;
