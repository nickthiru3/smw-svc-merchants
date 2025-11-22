import { Construct } from "constructs";
import BindingsConstruct from "./bindings/construct";
import UsersConstruct from "./users/construct";
import MerchantsConstruct from "./merchants/construct";
import AuthConstruct from "#lib/auth/construct";
import DatabaseConstruct from "#lib/db/construct";
import type { IApiProps } from "../construct";
import type { IConfig } from "#config/default";

interface IEndpointsConstructProps {
  readonly config: IConfig;
  readonly apiProps: IApiProps;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
}

class EndpointsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IEndpointsConstructProps) {
    super(scope, id);

    const { config, apiProps, auth, db } = props;

    new BindingsConstruct(this, "BindingsConstruct", {
      config,
      apiProps,
    });

    new UsersConstruct(this, "UsersConstruct", {
      apiProps,
      auth,
      db,
    });

    new MerchantsConstruct(this, "MerchantsConstruct", {
      apiProps,
      auth,
      db,
    });
  }
}

export default EndpointsConstruct;
