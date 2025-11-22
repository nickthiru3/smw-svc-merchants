import { Construct } from "constructs";
import { CognitoUserPoolsAuthorizer } from "aws-cdk-lib/aws-apigateway";
import { RestApi, AuthorizationType } from "aws-cdk-lib/aws-apigateway";
import type { IPermissionsProvider } from "#lib/permissions/construct";
import AuthBindingsConstruct from "#lib/auth/construct";
import type { IConfig } from "#config/default";

interface IAuthOptions {
  readonly authorizationType: AuthorizationType;
  readonly authorizer: { authorizerId: string };
  readonly authorizationScopes: string[];
}

interface IUsersAuthOptions {
  readonly readUsersAuth: IAuthOptions;
  readonly writeUsersAuth: IAuthOptions;
  readonly deleteUsersAuth: IAuthOptions;
}

interface IAuthorizationConstructProps {
  readonly restApi: RestApi;
  readonly auth: AuthBindingsConstruct;
  readonly permissions: IPermissionsProvider;
  readonly config: IConfig;
}

/**
 * Construct for managing API Gateway authorization
 * Handles Cognito authorizer and OAuth scope-based permissions
 */
class AuthorizationConstruct extends Construct {
  authorizer: CognitoUserPoolsAuthorizer;
  authOptions: {
    readonly users: IUsersAuthOptions;
  };

  constructor(
    scope: Construct,
    id: string,
    props: IAuthorizationConstructProps
  ) {
    super(scope, id);

    const { restApi, auth, permissions, config } = props;
    const authConfig = config.api.authorization;

    // Create and attach Cognito authorizer (if enabled)
    if (authConfig.cognito.enabled) {
      this.authorizer = new CognitoUserPoolsAuthorizer(
        this,
        "CognitoUserPoolsAuthorizer",
        {
          cognitoUserPools: [auth.userPool.pool],
          identitySource:
            authConfig.cognito.identitySource ||
            "method.request.header.Authorization",
        }
      );
      this.authorizer._attachToApi(restApi);
    } else {
      // No-op authorizer if Cognito is disabled
      this.authorizer = null as any;
    }

    // Get authorization options for different services
    this.authOptions = {
      users: permissions.oauth.getAuthOptions(
        this.authorizer.authorizerId
      ) as IUsersAuthOptions,
      // Add more service auth options here as needed
    };
  }
}

export default AuthorizationConstruct;
