import { Construct } from "constructs";
import { Role, FederatedPrincipal } from "aws-cdk-lib/aws-iam";
import { CfnIdentityPoolRoleAttachment } from "aws-cdk-lib/aws-cognito";
import AuthConstruct from "#lib/auth/construct";

interface IRolesConstructProps {
  readonly auth: AuthConstruct;
}

class RolesConstruct extends Construct {
  authenticated: Role;
  unAuthenticated: Role;
  merchant: Role;

  constructor(scope: Construct, id: string, props: IRolesConstructProps) {
    super(scope, id);

    const { auth } = props;

    this.authenticated = new Role(this, "CognitoDefaultAuthenticatedRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    this.unAuthenticated = new Role(this, "CognitoDefaultUnauthenticatedRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    this.merchant = new Role(this, "CognitoMerchantRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": auth.identityPool.pool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    new CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
      identityPoolId: auth.identityPool.pool.ref,
      roles: {
        authenticated: this.authenticated.roleArn,
        unauthenticated: this.unAuthenticated.roleArn,
      },
      roleMappings: {
        roleMappingsKey: {
          type: "Rules",
          ambiguousRoleResolution: "Deny",
          identityProvider: `${auth.userPool.pool.userPoolProviderName}:${auth.userPool.poolClient.userPoolClientId}`,
          rulesConfiguration: {
            rules: [
              {
                claim: "cognito:groups",
                matchType: "Contains",
                value: "merchants",
                roleArn: this.merchant.roleArn,
              },
            ],
          },
        },
      },
    });
  }
}

export default RolesConstruct;
