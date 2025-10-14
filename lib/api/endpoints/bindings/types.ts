/**
 * Type definitions for service discovery bindings endpoint
 */

/**
 * Service discovery bindings response structure
 */
export interface IServiceBindings {
  service: string;
  env: string;
  region: string;
  api: {
    baseUrl: string;
  };
  storage: {
    bucket: string;
    region: string;
  };
  [key: string]: any; // Allow additional bindings from SSM
}
