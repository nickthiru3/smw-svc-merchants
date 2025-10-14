import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";
import type { IConfig } from "#config/default";

// Import your constructs
// import DbStack from "../db/stack";
// import MonitorStack from "../monitor/stack";
// import StorageStack from "../storage/stack";
// import ApiStack from "../api/stack";
import { ServiceStack } from "../service-stack";

/**
 * Properties for the PipelineStage
 */
export interface IPipelineStageProps extends StageProps {
  readonly config: IConfig;
}

/**
 * Pipeline stage that represents a deployment environment
 */
export class PipelineStage extends Stage {
  constructor(scope: Construct, id: string, props: IPipelineStageProps) {
    super(scope, id, props);

    const { config } = props;

    new ServiceStack(this, "ServiceStack", {
      config,
    });
  }
}

export default PipelineStage;
