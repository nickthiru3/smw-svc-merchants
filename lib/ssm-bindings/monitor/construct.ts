import { Construct } from "constructs";
import SsmBindingsUtilConstruct from "#lib/utils/ssm-bindings/construct";
import type { IMonitorBindings } from "@super-deals/infra-contracts";
import type { IConfig } from "#config/default";

interface IMonitorBindingsConstructProps {
  readonly config: IConfig;
}

class MonitorBindingsConstruct extends Construct {
  public readonly slackWebhookUrl: string;

  constructor(
    scope: Construct,
    id: string,
    props: IMonitorBindingsConstructProps
  ) {
    super(scope, id);

    const { config } = props;

    const envName = config.envName;

    const producerServiceName = "platform";
    const visibility = "private";
    const secure = true;

    const params = {
      slackWebhookUrl: "monitor/slack/webhookUrl",
    } as const;

    const bindings = new SsmBindingsUtilConstruct<IMonitorBindings>(
      this,
      "MonitorBindings",
      {
        envName,
        producerServiceName,
        visibility,
        secure,
        params,
      }
    );

    this.slackWebhookUrl = bindings.values.slackWebhookUrl;
  }
}

export default MonitorBindingsConstruct;
