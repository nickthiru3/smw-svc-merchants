import { Construct } from "constructs";
import Alarm4xxConstruct from "./4xx/construct";
import type { IConfig } from "#config/default";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

interface IApiMonitorConstructProps {
  readonly config: IConfig;
  readonly ssmBindings: SsmBindingsConstruct;
}

class ApiMonitorConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IApiMonitorConstructProps) {
    super(scope, id);

    const { config, ssmBindings } = props;

    new Alarm4xxConstruct(this, "Alarm4xxConstruct", {
      config,
      ssmBindings,
    });
  }
}

export default ApiMonitorConstruct;
