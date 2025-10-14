import { Construct } from "constructs";
import { Role, FederatedPrincipal } from "aws-cdk-lib/aws-iam";
import { CfnIdentityPoolRoleAttachment } from "aws-cdk-lib/aws-cognito";
import UserPoolConstruct from "../user-pool/construct";
import IdentityPoolConstruct from "../identity-pool/construct";

interface IRolesConstructProps {
  readonly userPool: UserPoolConstruct;
  readonly identityPool: IdentityPoolConstruct;
}

class RolesConstruct extends Construct {
  authenticated: Role;
  unAuthenticated: Role;
  merchants: Role;

  constructor(scope: Construct, id: string, props: IRolesConstructProps) {
    super(scope, id);

    const { userPool, identityPool } = props;

    // Create authenticated role
    this.authenticated = new Role(this, "CognitoDefaultAuthenticatedRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.pool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    // Create unauthenticated role
    this.unAuthenticated = new Role(this, "CognitoDefaultUnauthenticatedRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.pool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    // Create merchants role
    this.merchants = new Role(this, "MerchantsRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.pool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    // Create role mappings
    new CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
      identityPoolId: identityPool.pool.ref,
      roles: {
        authenticated: this.authenticated.roleArn,
        unauthenticated: this.unAuthenticated.roleArn,
      },
      roleMappings: {
        roleMapping: {
          type: "Token",
          ambiguousRoleResolution: "AuthenticatedRole",
          identityProvider: `${userPool.pool.userPoolProviderName}:${userPool.poolClient.userPoolClientId}`,
        },
      },
    });
  }
}

export default RolesConstruct;
