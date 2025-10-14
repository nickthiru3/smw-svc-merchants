import { Construct } from "constructs";
import { CfnOutput } from "aws-cdk-lib";
import { CfnIdentityPool } from "aws-cdk-lib/aws-cognito";
import UserPoolConstruct from "../user-pool/construct";

interface IIdentityPoolConstructProps {
  readonly userPool: UserPoolConstruct;
}

class IdentityPoolConstruct extends Construct {
  pool: CfnIdentityPool;

  constructor(
    scope: Construct,
    id: string,
    props: IIdentityPoolConstructProps
  ) {
    super(scope, id);

    const { userPool } = props;

    this.pool = new CfnIdentityPool(this, `IdentityPool`, {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: userPool.poolClient.userPoolClientId,
          providerName: userPool.pool.userPoolProviderName,
        },
      ],
    });

    /*** Outputs ***/

    // For web client Auth service
    new CfnOutput(this, `IdentityPoolId`, {
      value: this.pool.ref,
      description: "Identity Pool ID",
      exportName: `IdentityPoolId`,
    });
  }
}

export default IdentityPoolConstruct;
