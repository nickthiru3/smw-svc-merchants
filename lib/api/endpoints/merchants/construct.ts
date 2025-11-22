/**
 * Merchants Resource Construct
 *
 * Creates /merchants API resource and all its sub-resources/methods.
 *
 * Current Endpoints:
 * - GET /merchants/search - Search merchants by category (Story 001)
 *
 * Future Endpoints:
 * - GET /merchants/{id} - Get merchant by ID
 * - POST /merchants - Create merchant (admin only)
 * - PUT /merchants/{id} - Update merchant
 * - DELETE /merchants/{id} - Delete merchant (admin only)
 *
 * Architecture:
 * - This construct creates the /merchants resource
 * - Sub-constructs create specific methods (GET, POST, etc.)
 * - Each method construct handles its own Lambda, validation, and IAM
 *
 * @see docs/implementation/adding-endpoints-part-2-api-gateway.md - Resource patterns
 */

import { Construct } from "constructs";
import SearchConstruct from "./search/construct";
import AuthConstruct from "#lib/auth/construct";
import DatabaseConstruct from "#lib/db/construct";
import type { IApiProps } from "../../construct";

interface IMerchantsConstructProps {
  readonly apiProps: IApiProps;
  readonly auth: AuthConstruct;
  readonly db: DatabaseConstruct;
}

/**
 * Merchants Resource Construct
 *
 * Orchestrates all merchant-related endpoints under /merchants resource.
 */
class MerchantsConstruct extends Construct {
  /**
   * Creates the /merchants resource and all its endpoints
   *
   * @param scope - CDK construct scope
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IMerchantsConstructProps) {
    super(scope, id);

    const { apiProps, auth, db } = props;

    // Create /merchants resource with CORS
    const merchantsResource = apiProps.restApi.root.addResource(
      "merchants",
      apiProps.optionsWithCors
    );

    // Add GET /merchants/search endpoint
    new SearchConstruct(this, "SearchConstruct", {
      apiProps,
      auth,
      db,
      merchantsResource,
    });

    // Future endpoints will be added here:
    // new GetByIdConstruct(this, "GetByIdConstruct", { ... });
    // new PostConstruct(this, "PostConstruct", { ... });
    // new PutConstruct(this, "PutConstruct", { ... });
    // new DeleteConstruct(this, "DeleteConstruct", { ... });
  }
}

export default MerchantsConstruct;
