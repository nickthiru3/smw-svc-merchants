import { Construct } from "constructs";
import type { IConfig } from "#config/default";
import IamConstruct from "#lib/iam/construct";
// import StorageConstruct from "#lib/storage/construct";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

interface IPoliciesConstructProps {
  readonly config: IConfig; // is config.env needed?
  readonly iam: IamConstruct;
  // readonly storage: StorageConstruct;
}

class PoliciesConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IPoliciesConstructProps) {
    super(scope, id);

    const {
      // config
      // storage,
      iam,
    } = props;

    // Create S3 access policy for merchants
    // const merchantS3Policy = new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   actions: ["s3:PutObject"],
    //   resources: [`${storage.s3Bucket.bucketArn}/merchants/*`],
    // });

    // Attach the policy only to the merchant role
    // iam.roles.merchant.addToPrincipalPolicy(merchantS3Policy);
  }
}

export default PoliciesConstruct;
