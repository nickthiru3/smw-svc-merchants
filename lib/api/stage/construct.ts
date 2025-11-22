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
import { RemovalPolicy, CfnOutput, Duration } from "aws-cdk-lib";
import type { IConfig } from "#config/default";

interface IStageConstructProps {
  readonly restApi: RestApi;
  readonly config: IConfig;
}

/**
 * Stage Construct
 *
 * Creates API Gateway deployment stage with configuration from config.api.stages.
 * Supports:
 * - Access logging to CloudWatch
 * - Throttling (rate and burst limits)
 * - Method-level logging and data tracing
 * - Caching (optional)
 *
 * Stage configuration is environment-specific and defined in config/api.ts.
 */
class StageConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IStageConstructProps) {
    super(scope, id);

    const { restApi, config } = props;

    const envName = config.envName;
    const serviceName = config.service.name;
    const stageConfig = config.api.stages[0]; // Single stage per environment

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
      stageName: stageConfig.name,
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
          loggingLevel: stageConfig.logging
            ? MethodLoggingLevel[stageConfig.logging.loggingLevel]
            : MethodLoggingLevel.OFF,
          dataTraceEnabled: stageConfig.logging?.dataTrace ?? false,
          metricsEnabled: true,
          throttlingBurstLimit: stageConfig.throttling?.burstLimit ?? 2000,
          throttlingRateLimit: stageConfig.throttling?.rateLimit ?? 1000,
          cachingEnabled: stageConfig.caching?.enabled ?? false,
          cacheTtl: stageConfig.caching?.ttl
            ? Duration.seconds(stageConfig.caching.ttl)
            : undefined,
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
