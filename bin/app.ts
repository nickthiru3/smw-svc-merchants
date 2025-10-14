// Load environment variables FIRST before any other imports
import * as dotenv from "dotenv";
dotenv.config();

import "source-map-support/register";
import { App } from "aws-cdk-lib";
// import { CicdStack } from "#lib/cicd-stack";
import { ServiceStack } from "#lib/service-stack";
import appConfig, { type IConfig } from "#config/default";
import { makeEnv, makeTags, makeDescription } from "#src/helpers/config";

const app = new App();
const config: IConfig = appConfig;
const envName = config.envName;
const serviceName = config.service.name;

// Note: We pass `env: targetEnv` to each Stack so CDK binds the
// stack to a specific account/region (bootstrap/assets/lookups). Internally,
// stacks read account/region/envName from `config` as the single source of truth.
const targetEnv = makeEnv(envName, config);

// Conditional stack deployment based on environment
if (envName === "dev") {
  // Deploy service infrastructure directly (no pipeline)
  console.log("Deploying ServiceStack directly", { envName });

  const description = makeDescription(envName, "Service Infrastructure");
  const tags = makeTags(envName, config, "service-only");

  new ServiceStack(app, `${envName}-${serviceName}-ServiceStack`, {
    env: targetEnv,
    config,
    description,
    tags,
  });
} else {
  // Deploy AWS CI/CD pipeline stack (which includes service infrastructure via stages)
  console.log("Deploying CicdStack (pipeline)", { envName });

  // const description = makeDescription(envName, "CI/CD Stack");
  // const tags = makeTags(envName, config, "pipeline-with-service");

  // new CicdStack(app, `CicdStack-${serviceName}-${envName}`, {
  //   env: targetEnv,
  //   config,
  //   description,
  //   tags,
  // });
}

app.synth();
