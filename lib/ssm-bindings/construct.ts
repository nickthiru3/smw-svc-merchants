import { Construct } from "constructs";
import WebsiteBindingsConstruct from "./website/construct";
import MonitorBindingsConstruct from "./monitor/construct";
import type { IConfig } from "#config/default";

type ISsmBindingsConstructProps = {
  readonly config: IConfig;
};

class SsmBindingsConstruct extends Construct {
  website: WebsiteBindingsConstruct;
  monitor: MonitorBindingsConstruct;

  constructor(scope: Construct, id: string, props: ISsmBindingsConstructProps) {
    super(scope, id);

    const { config } = props;

    this.monitor = new MonitorBindingsConstruct(
      this,
      "MonitorBindingsConstruct",
      {
        config,
      }
    );

    this.website = new WebsiteBindingsConstruct(
      this,
      "WebsiteBindingsConstruct",
      {
        config,
      }
    );
  }
}

export default SsmBindingsConstruct;
