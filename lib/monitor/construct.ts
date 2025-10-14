/**
 * Monitoring Infrastructure
 *
 * Orchestrates CloudWatch alarms and SNS notifications for:
 * - SES email events (bounces, complaints, delivery failures)
 * - API Gateway errors (4xx, 5xx responses)
 *
 * Architecture:
 * ```
 * MonitorConstruct
 * ├── SesMonitorConstruct
 * │   ├── SNS Topic (SES events)
 * │   └── SES Configuration Set
 * └── ApiMonitorConstruct
 *     ├── CloudWatch Alarm (4xx errors)
 *     ├── SNS Topic (API alerts)
 *     └── Lambda (webhook notifications)
 * ```
 *
 * @module lib/monitor/construct
 */

import { Construct } from "constructs";
import SesMonitorConstruct from "./ses/construct";
import ApiMonitorConstruct from "./api/construct";
import type { IConfig } from "#config/default";
import SsmBindingsConstruct from "#lib/ssm-bindings/construct";

/**
 * Props for MonitorConstruct
 *
 * @property config - Application configuration
 * @property ssmBindings - SSM bindings for webhook URLs
 */
interface IMonitorConstructProps {
  readonly config: IConfig;
  readonly ssmBindings: SsmBindingsConstruct;
}

/**
 * Monitoring Construct
 *
 * Orchestrates monitoring infrastructure for SES and API Gateway.
 * Creates CloudWatch alarms, SNS topics, and notification handlers.
 *
 * Monitoring Coverage:
 * - **SES Events**: Bounces, complaints, delivery failures
 * - **API Errors**: 4xx client errors, 5xx server errors
 *
 * @example
 * // Create monitor construct
 * const monitor = new MonitorConstruct(this, 'MonitorConstruct', {
 *   config: appConfig,
 *   ssmBindings: ssmBindings
 * });
 *
 * // Use SES configuration set in email Lambda
 * new NodejsFunction(this, 'EmailFunction', {
 *   environment: {
 *     CONFIGURATION_SET_NAME: monitor.ses.configurationSet.configurationSetName
 *   }
 * });
 */
class MonitorConstruct extends Construct {
  /**
   * SES monitoring construct
   *
   * Public property to allow:
   * - Email Lambdas to use configuration set
   * - Other constructs to subscribe to SES events
   */
  ses: SesMonitorConstruct;

  /**
   * Creates the monitoring construct
   *
   * Orchestrates:
   * 1. SES Monitor - Email event tracking and alerting
   * 2. API Monitor - API error tracking and alerting
   *
   * @param scope - Parent construct
   * @param id - Construct identifier
   * @param props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: IMonitorConstructProps) {
    super(scope, id);

    const { config, ssmBindings } = props;

    // 1. SES Monitor - Track email bounces, complaints, delivery failures
    this.ses = new SesMonitorConstruct(this, "SesMonitorConstruct", {
      config,
    });

    // 2. API Monitor - Track API Gateway errors and send alerts
    new ApiMonitorConstruct(this, "ApiMonitorConstruct", {
      config,
      ssmBindings,
    });
  }
}

export default MonitorConstruct;
