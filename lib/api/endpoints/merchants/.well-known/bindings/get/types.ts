/**
 * TypeScript Types for GET /merchants/.well-known/bindings
 *
 * Service discovery endpoint types following RFC 8615 (.well-known URIs).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8615
 */

/**
 * Service Bindings Structure
 *
 * Contains public configuration and endpoints for this service.
 * Used by clients for service discovery.
 */
export interface IServiceBindings {
  /** Service name identifier */
  readonly service: string;

  /** Environment name (dev, staging, prod) */
  readonly env: string;

  /** AWS region */
  readonly region: string;

  /** API configuration */
  readonly api: {
    /** Base URL for API endpoints */
    readonly baseUrl: string;
  };

  /** Storage configuration */
  readonly storage: {
    /** S3 bucket name */
    readonly bucket: string;
    /** S3 bucket region */
    readonly region: string;
  };
}
