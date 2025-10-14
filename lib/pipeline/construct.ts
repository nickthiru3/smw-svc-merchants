import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as pipelines from "aws-cdk-lib/pipelines";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as iam from "aws-cdk-lib/aws-iam";
import { PipelineConfig, PipelineConstructProps } from "../../types/pipeline";
import PipelineStage from "./stage";

/**
 * Pipeline construct that sets up a CI/CD pipeline using AWS CodePipeline
 */
export class PipelineConstruct extends Construct {
  constructor(scope: Construct, id: string, props: PipelineConstructProps) {
    super(scope, id);

    const { envName, env, config } = props;
    const pipelineConfig = config as PipelineConfig;

    // GitHub configuration with fallbacks to config values
    const gitHubRepo =
      props.gitHubRepo ??
      config.gitHubRepo ??
      "nickthiru3/super-deals-deals-ms";
    const gitHubBranch = props.gitHubBranch ?? config.gitHubBranch ?? "main";

    // Note: GitHub token secret is not needed when using CodeStar connections
    // CodeStar connections handle OAuth authentication automatically

    // Create the pipeline
    const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
      pipelineName: `super-deals-deals-ms-${envName}-pipeline`,
      crossAccountKeys: false,
      synth: new pipelines.CodeBuildStep("Synth", {
        input: pipelines.CodePipelineSource.connection(
          gitHubRepo,
          gitHubBranch,
          {
            connectionArn: `arn:aws:codestar-connections:${env.region}:${env.account}:connection/${config.codestarConnectionId}`,
            triggerOnPush: false,
          }
        ),
        installCommands: [
          "echo 'Node.js version:' && node --version",
          "echo 'npm version:' && npm --version",
          "echo 'Installing dependencies...'",
          "npm ci --verbose --no-audit --no-fund --ignore-scripts --include=dev",
        ],
        commands: [
          "echo 'Starting build process...'",
          "npm run build",
          "echo 'Starting CDK synthesis...'",
          "npx cdk synth",
        ],
        env: {
          NODE_ENV: "production",
        },
        primaryOutputDirectory: "cdk.out",
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ["sts:AssumeRole"],
            resources: ["*"],
            conditions: {
              "ForAnyValue:StringEquals": {
                "iam:ResourceTag/aws-cdk:bootstrap-role": [
                  "image-pulling",
                  "file-publishing",
                  "deploy",
                ],
              },
            },
          }),
        ],
      }),
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: true, // Required for building Docker images if needed
          environmentVariables: {
            NODE_VERSION: {
              value: "22", // Specify Node.js 22 for compatibility
            },
          },
        },
      },
    });

    // Add stages based on environment configuration
    if (pipelineConfig.stages) {
      for (const [stageName, stageConfig] of Object.entries(
        pipelineConfig.stages
      )) {
        // Only create stages that are enabled in the config (default to true if not specified)
        if (stageConfig?.enabled !== false) {
          const stageEnv: cdk.Environment = {
            account: stageConfig?.account || env.account || cdk.Aws.ACCOUNT_ID,
            region: stageConfig?.region || env.region || cdk.Aws.REGION,
          };

          // Create the stage with merged config
          const stage = new PipelineStage(this, `${stageName}Stage`, {
            envName: stageName,
            env: stageEnv,
            config: {
              ...pipelineConfig,
              ...stageConfig,
              envName: stageName,
            },
          });

          // Set up stage options
          const stageOptions: pipelines.AddStageOpts = {
            // Add manual approval for production stages
            pre:
              stageName === "production" || stageName === "prod"
                ? [new pipelines.ManualApprovalStep("PromoteToProduction")]
                : undefined,
          };

          // Add the stage to the pipeline
          pipeline.addStage(stage, stageOptions);
        }
      }
    } else {
      // Fallback for backward compatibility
      const stage = new PipelineStage(this, `${envName}Stage`, {
        envName,
        env: {
          account: env.account || cdk.Aws.ACCOUNT_ID,
          region: env.region || cdk.Aws.REGION,
        },
        config: pipelineConfig,
      });

      pipeline.addStage(stage);
    }

    // Add pre-synth validation steps
    pipeline.addWave("PreSynth", {
      pre: [
        new pipelines.CodeBuildStep("RunUnitTests", {
          commands: ["npm ci", "npm test"],
        }),
      ],
    });
  }
}

export default PipelineConstruct;
