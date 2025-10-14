import { Construct } from "constructs";
import {
  CfnConfigurationSet,
  CfnConfigurationSetEventDestination,
} from "aws-cdk-lib/aws-ses";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { PolicyStatement, Effect, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import type { IConfig } from "#config/default";

interface ISesMonitorConstructProps {
  readonly config: IConfig;
}

class SesMonitorConstruct extends Construct {
  configurationSetName: string;

  constructor(scope: Construct, id: string, props: ISesMonitorConstructProps) {
    super(scope, id);

    const { config } = props;

    const region = config.region;
    const accountId = config.accountId;
    const serviceName = config.service.name;

    // Create a CloudWatch Log Group for SES events
    const logGroup = new LogGroup(this, "SesEventsLogGroup", {
      logGroupName: `ses/${serviceName}/events`, // Log group name
      retention: RetentionDays.ONE_WEEK, // Adjust retention as needed
    });

    // Create a Configuration Set
    const configSetName = `${serviceName}-config-set`;
    const configurationSet = new CfnConfigurationSet(this, "ConfigurationSet", {
      name: configSetName,
    });

    // Create an Event Destination for the Configuration Set
    const eventDestination = new CfnConfigurationSetEventDestination(
      this,
      "EventDestination",
      {
        configurationSetName: configSetName,
        eventDestination: {
          name: "CloudWatchDestination",
          enabled: true,
          matchingEventTypes: [
            "send",
            "reject",
            "bounce",
            "complaint",
            "delivery",
            "renderingFailure",
          ],
          cloudWatchDestination: {
            // This structure is needed even if empty for CloudWatch destinations
            dimensionConfigurations: [
              {
                // Add required dimension configurations
                defaultDimensionValue: "default",
                dimensionName: "ses-event-type",
                dimensionValueSource: "messageTag",
              },
            ],
          },
        },
      }
    );

    // Add dependency to ensure the Configuration Set is created before the Event Destination
    eventDestination.addDependency(configurationSet);

    // Grant SES permission to write to the CloudWatch Log Group
    logGroup.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("ses.amazonaws.com")],
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [logGroup.logGroupArn],
        // Add condition to ensure only this account/region can publish
        conditions: {
          StringEquals: {
            "aws:SourceAccount": accountId,
          },
          ArnLike: {
            "aws:SourceArn": `arn:aws:ses:${region}:${accountId}:configuration-set/${configSetName}`,
          },
        },
      })
    );

    // Export the configuration set name for use by other constructs
    this.configurationSetName = configSetName;
  }
}

export default SesMonitorConstruct;
