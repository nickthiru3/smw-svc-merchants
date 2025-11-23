/**
 * GET /merchants/.well-known/bindings Construct
 *
 * Service discovery endpoint that returns public bindings for this service.
 * Follows the .well-known URI convention (RFC 8615).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8615
 */

import { Construct } from "constructs";
import { LambdaIntegration, IResource } from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import path from "path";
import { buildSsmPublicPath } from "#src/helpers/ssm";
import type { IApiProps } from "#lib/api/construct";
import type { IConfig } from "#config/default";

/**
 * Props for GetConstruct
 */
interface IGetConstructProps {
  readonly config: IConfig;
  readonly apiProps: IApiProps;
  readonly bindingsResource: IResource;
}

/**
 * GET /merchants/.well-known/bindings Construct
 *
 * Creates the GET method for the bindings endpoint.
 */
class GetConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IGetConstructProps) {
    super(scope, id);

    const { config, apiProps, bindingsResource } = props;
    const { envName, region } = config;
    const ssmPublicPath = buildSsmPublicPath(envName);

    // Lambda function
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
      depsLockFilePath: path.join(
        __dirname,
        "../../../../../package-lock.json"
      ),
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

    // Add GET method to /merchants/.well-known/bindings
    bindingsResource.addMethod("GET", new LambdaIntegration(lambda), {
      operationName: "ServiceDiscovery_Bindings",
    });
  }
}

export default GetConstruct;
