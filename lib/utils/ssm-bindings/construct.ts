import { Construct } from "constructs";
import {
  buildSsmPrivatePath,
  buildSsmPublicPath,
  readBindings,
  readSecureBindings,
} from "#src/helpers/ssm";

export type TVisibility = "public" | "private";

interface IBaseProps {
  readonly envName: string;
  readonly producerServiceName: string;
  readonly visibility?: TVisibility; // default: "public"
  readonly secure?: boolean; // when true, read from SecureString parameters
}

type TSsmBindingsUtilProps<TValues> = IBaseProps & {
  params: { [K in keyof TValues]: string };
};

class SsmBindingsUtilConstruct<TValues> extends Construct {
  readonly values: { [K in keyof TValues]: string };

  constructor(
    scope: Construct,
    id: string,
    props: TSsmBindingsUtilProps<TValues>
  ) {
    super(scope, id);

    const {
      envName,
      producerServiceName,
      visibility = "public",
      secure = false,
    } = props as IBaseProps;

    const basePath =
      visibility === "public"
        ? buildSsmPublicPath(envName, producerServiceName)
        : buildSsmPrivatePath(envName, producerServiceName);

    this.values = (secure ? readSecureBindings : readBindings)(
      this,
      basePath,
      props.params as { [K in keyof TValues]: string }
    ) as { [K in keyof TValues]: string };
  }
}

export default SsmBindingsUtilConstruct;
