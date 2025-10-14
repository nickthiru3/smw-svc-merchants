import { Construct } from "constructs";
import SsmBindingsUtilConstruct from "#lib/utils/ssm-bindings/construct";
import type { IWebsiteBindings } from "@super-deals/infra-contracts";
import type { IConfig } from "#config/default";

interface IWebsiteBindingsConstructProps {
  readonly config: IConfig;
}

class WebsiteBindingsConstruct extends Construct {
  siteUrl: string;
  sourceEmail: string;

  constructor(
    scope: Construct,
    id: string,
    props: IWebsiteBindingsConstructProps
  ) {
    super(scope, id);

    const { config } = props;

    const envName = config.envName;
    const producerServiceName = "website";

    const params = {
      websiteUrl: "websiteUrl",
      sourceEmail: "sourceEmail",
    } as const;

    const bindings = new SsmBindingsUtilConstruct<IWebsiteBindings>(
      this,
      "WebsiteBindings",
      {
        envName,
        producerServiceName,
        params,
      }
    );

    // Assign typed values
    this.siteUrl = bindings.values.websiteUrl;
    this.sourceEmail = bindings.values.sourceEmail;
  }
}

export default WebsiteBindingsConstruct;
