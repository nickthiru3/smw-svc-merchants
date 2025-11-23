/**
 * Bindings Resource Construct
 *
 * Creates the bindings resource under /merchants/.well-known.
 * Follows the .well-known URI convention (RFC 8615) for service discovery.
 *
 * Resource Hierarchy:
 * /merchants/.well-known/bindings
 *   └── GET (via GetConstruct)
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8615
 */

import { Construct } from "constructs";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import GetConstruct from "./get/construct";
import type { IApiProps } from "#lib/api/construct";
import type { IConfig } from "#config/default";

/**
 * Props for Construct
 */
interface IConstructProps {
  readonly config: IConfig;
  readonly apiProps: IApiProps;
  readonly wellKnownResource: IResource;
}

/**
 * Bindings Resource Construct
 *
 * Creates the .well-known/bindings resource hierarchy and instantiates
 * method-specific constructs (GET).
 */
class BindingsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IConstructProps) {
    super(scope, id);

    const { config, apiProps, wellKnownResource } = props;

    // Create /merchants/.well-known/bindings resource
    const bindingsResource = wellKnownResource.addResource(
      "bindings",
      apiProps.optionsWithCors
    );

    // Instantiate GET /merchants/.well-known/bindings
    new GetConstruct(this, "GetConstruct", {
      config,
      apiProps,
      bindingsResource,
    });
  }
}

export default BindingsConstruct;
