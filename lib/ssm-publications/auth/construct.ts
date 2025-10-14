import { Construct } from "constructs";
import AuthConstruct from "#lib/auth/construct";
import { publishStringParameters } from "#src/helpers/ssm";

interface IAuthBindingsConstructProps {
  readonly basePath: string;
  readonly auth: AuthConstruct;
}

class AuthBindingsConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: IAuthBindingsConstructProps
  ) {
    super(scope, id);

    const { basePath, auth } = props;

    // Publish only required binding(s) consumed by downstream services
    const authBindings: Record<string, string> = {
      "auth/userPoolId": auth.userPool.pool.userPoolId,
    };

    publishStringParameters(this, basePath, authBindings);
  }
}

export default AuthBindingsConstruct;
