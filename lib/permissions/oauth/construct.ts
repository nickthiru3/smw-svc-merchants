import { Construct } from "constructs";
import ResourceServerConstruct from "../resource-server/construct";
import { AuthorizationType } from "aws-cdk-lib/aws-apigateway";

interface IOAuthConstructProps {
  readonly resourceServer: ResourceServerConstruct;
}

/**
 * Construct for managing OAuth permissions specific to deals
 * Defines scopes for deal-related operations
 */
class OAuthConstruct extends Construct {
  public readonly resourceServer: ResourceServerConstruct;

  constructor(scope: Construct, id: string, props: IOAuthConstructProps) {
    super(scope, id);

    const { resourceServer } = props;
    this.resourceServer = resourceServer;
  }

  getAuthOptions(authorizerId: string) {
    const slashScopes = this.resourceServer.getOAuthScopes();

    const baseAuth = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: { authorizerId },
    };

    return {
      readUsersAuth: {
        ...baseAuth,
        authorizationScopes: slashScopes.filter((s) => s.endsWith("/read")),
      },
      writeUsersAuth: {
        ...baseAuth,
        authorizationScopes: slashScopes.filter((s) => s.endsWith("/write")),
      },
      deleteUsersAuth: {
        ...baseAuth,
        authorizationScopes: slashScopes.filter((s) => s.endsWith("/delete")),
      },
    };
  }
}

export default OAuthConstruct;
