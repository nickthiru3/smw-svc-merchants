import { Construct } from "constructs";
import { AuthorizationType } from "aws-cdk-lib/aws-apigateway";
import ResourceServerConstruct from "./resource-server/construct";
import OAuthConstruct from "./oauth/construct";
// import PoliciesConstruct from "./policies/construct";
import IamConstruct from "#lib/iam/construct";
import AuthConstruct from "#lib/auth/construct";
import type { IConfig } from "#config/default";

export interface IAuthOptions {
  readonly authorizationType: AuthorizationType;
  readonly authorizer: { authorizerId: string };
  readonly authorizationScopes: string[];
}

export interface IUsersAuthOptions {
  readonly readUsersAuth: IAuthOptions;
  readonly writeUsersAuth: IAuthOptions;
  readonly deleteUsersAuth: IAuthOptions;
}

export interface IPermissionsProvider {
  readonly oauth: {
    getAuthOptions(authorizerId: string): IUsersAuthOptions;
  };
}

interface IPermissionsConstructProps {
  readonly config: IConfig;
  readonly iam: IamConstruct;
  readonly auth: AuthConstruct;
}

/**
 * Stack for managing identity-based permissions
 * Handles attaching policies to roles for accessing various resources
 */
export class PermissionsConstruct
  extends Construct
  implements IPermissionsProvider
{
  readonly oauth: OAuthConstruct;

  constructor(scope: Construct, id: string, props: IPermissionsConstructProps) {
    super(scope, id);

    const { config, iam, auth } = props;

    const resourceServer = new ResourceServerConstruct(
      this,
      "ResourceServerConstruct",
      {
        auth,
        config,
      }
    );

    this.oauth = new OAuthConstruct(this, "OAuthConstruct", {
      resourceServer,
    });

    // new PoliciesConstruct(this, "PoliciesConstruct", {
    //   config,
    //   iam,
    //   // storage,
    // });
  }
}

// No-op implementation to disable permissions while keeping API types intact
export class NoopPermissionsConstruct implements IPermissionsProvider {
  oauth = {
    getAuthOptions: (authorizerId: string): IUsersAuthOptions => {
      const base: IAuthOptions = {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: { authorizerId },
        authorizationScopes: [],
      };
      return {
        readUsersAuth: { ...base },
        writeUsersAuth: { ...base },
        deleteUsersAuth: { ...base },
      };
    },
  };
}
