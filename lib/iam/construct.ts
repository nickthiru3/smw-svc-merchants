import { Construct } from "constructs";
import RolesConstruct from "./roles/construct";
import AuthConstruct from "#lib/auth/construct";

interface IIamConstructProps {
  readonly auth: AuthConstruct;
}

class IamConstruct extends Construct {
  roles: RolesConstruct;

  constructor(scope: Construct, id: string, props: IIamConstructProps) {
    super(scope, id);

    const { auth } = props;

    this.roles = new RolesConstruct(this, "RolesConstruct", {
      auth,
    });
  }
}

export default IamConstruct;
