import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SuperDealsStackProps } from "../types";
import PipelineConstruct from "./pipeline/construct";
import { PipelineConfig } from "../types/pipeline";
import config from "../config/default";

export class CicdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SuperDealsStackProps) {
    super(scope, id, props);

    const { envName, env } = props;

    // In Three-Flow architecture, account and region are required for all environments
    // Use explicit values from config (which enforces required values) or environment props
    const pipelineEnv = {
      account: env?.account || config.account,
      region: env?.region || config.region,
    };

    new PipelineConstruct(this, "PipelineStack", {
      envName,
      env: pipelineEnv,
      config: config as PipelineConfig,
    });
  }
}
