import { Construct } from "constructs";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Effect } from "aws-cdk-lib/aws-iam";
import path from "path";
import { buildSsmPublicPath } from "#src/helpers/ssm";
import type { IApiProps } from "#lib/api/construct";
import type { IConfig } from "#config/default";

interface IBindingsConstructProps {
  readonly config: IConfig;
  readonly apiProps: IApiProps;
}

class BindingsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IBindingsConstructProps) {
    super(scope, id);

    const { config, apiProps } = props;

    const { envName, region } = config;

    const ssmPublicPath = buildSsmPublicPath(envName);

    const wk = apiProps.restApi.root.addResource(
      ".well-known",
      apiProps.optionsWithCors
    );
    const bindings = wk.addResource("bindings", apiProps.optionsWithCors);

    const lambda = new NodejsFunction(this, "NodejsFunction", {
      bundling: {
        externalModules: ["@aws-sdk"],
        forceDockerBundling: true,
      },
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.minutes(1),
      entry: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      depsLockFilePath: path.join(__dirname, "../../../../package-lock.json"),
      environment: {
        ENV_NAME: envName,
        REGION: region,
        SSM_PUBLIC_PATH: ssmPublicPath,
      },
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["ssm:GetParametersByPath"],
          resources: [`arn:aws:ssm:*:*:parameter${ssmPublicPath ?? ""}*`],
        }),
      ],
    });

    bindings.addMethod("GET", new LambdaIntegration(lambda), {
      operationName: "ServiceDiscovery_Bindings",
    });
  }
}

export default BindingsConstruct;
