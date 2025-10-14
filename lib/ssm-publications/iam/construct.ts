import { Construct } from "constructs";
import IamConstruct from "#lib/iam/construct";
import { publishStringParameters } from "#src/helpers/ssm";

interface IIamBindingsConstructProps {
  readonly basePath: string;
  readonly iam: IamConstruct;
}

class IamBindingsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IIamBindingsConstructProps) {
    super(scope, id);

    const { basePath, iam } = props;

    // Publish IAM role ARNs for cross-repo consumers
    const iamBindings: Record<string, string> = {
      "iam/roles/merchant/arn": iam.roles.merchant.roleArn,
    };

    publishStringParameters(this, basePath, iamBindings);
  }
}

export default IamBindingsConstruct;
