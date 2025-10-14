import { Construct } from "constructs";
import PostConstruct from "./post/construct";
import AuthConstruct from "#lib/auth/construct";
import DatabaseConstruct from "#lib/db/construct";
import type { IApiProps } from "../../construct";

interface IUsersConstructProps {
  readonly apiProps: IApiProps;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
}

class UsersConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IUsersConstructProps) {
    super(scope, id);

    const { apiProps, auth, db } = props;

    const usersResource = apiProps.restApi.root.addResource(
      "users",
      apiProps.optionsWithCors
    );

    new PostConstruct(this, "PostConstruct", {
      apiProps,
      auth,
      db,
      usersResource,
    });
  }
}

export default UsersConstruct;
