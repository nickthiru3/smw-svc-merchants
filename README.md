# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Guides

- See the central guides index: [docs/guides/README.md](../docs/guides/README.md)

## Secrets & Bindings

- We standardize secrets via SSM SecureString dynamic references, avoiding plaintext in templates.
- Slack webhook binding key is `slackWebhookUrl` at `monitor/slack/webhookUrl` under the private path for the `platform` producer.
- CDK injects `SLACK_WEBHOOK_URL` into monitoring Lambdas using a value like `{{resolve:ssm-secure:/super-deals/{ENV_NAME}/platform/private/monitor/slack/webhookUrl}}`, resolved via `SecretValue.ssmSecure()`.
- If you need to pin a specific SecureString version for a rollout, supply the version explicitly when calling `SecretValue.ssmSecure(parameterName, version)` in a custom construct.
