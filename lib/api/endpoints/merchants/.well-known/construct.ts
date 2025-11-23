/**
 * .well-known Resource Construct
 *
 * Creates the .well-known resource under /merchants.
 * Follows RFC 8615 for well-known URIs.
 *
 * Resource Hierarchy:
 * /merchants/.well-known
 *   └── bindings/ (via BindingsConstruct)
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8615
 */

import { Construct } from "constructs";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import BindingsConstruct from "./bindings/construct";
import type { IApiProps } from "#lib/api/construct";
import type { IConfig } from "#config/default";

/**
 * Props for Construct
 */
interface IConstructProps {
  readonly config: IConfig;
  readonly apiProps: IApiProps;
  readonly merchantsResource: IResource;
}

/**
 * .well-known Resource Construct
 *
 * Creates the .well-known resource and instantiates sub-resource constructs.
 */
class WellKnownConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IConstructProps) {
    super(scope, id);

    const { config, apiProps, merchantsResource } = props;

    // Create /merchants/.well-known resource
    const wellKnownResource = merchantsResource.addResource(
      ".well-known",
      apiProps.optionsWithCors
    );

    // Instantiate bindings sub-resource
    new BindingsConstruct(this, "BindingsConstruct", {
      config,
      apiProps,
      wellKnownResource,
    });
  }
}

export default WellKnownConstruct;
