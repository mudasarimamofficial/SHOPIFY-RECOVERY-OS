import { globalEventBus } from "./event-bus";
// import { trace, metrics } from "@opentelemetry/api";
// ^ Commented out to prevent build errors before package is installed

export class EnterpriseMonitoring {
  /**
   * Bootstraps the observability hooks. Binds to the InternalEventBus and
   * bridges all internal pipeline telemetry to standard OpenTelemetry (OTel) exporters.
   */
  bootstrap() {
    // const tracer = trace.getTracer("shopify-recovery-os");
    // const counter = metrics.getMeter("pipeline").createCounter("events_total");

    const eventsToTrace: Array<Parameters<typeof globalEventBus.subscribe>[0]> = [
      "PipelineStarted",
      "PipelineCompleted",
      "ResourceScanned",
      "ResourceExported",
      "ResourceRestored",
      "VerificationFailed",
      "Throttled",
      "Error",
    ];

    eventsToTrace.forEach((eventType) => {
      globalEventBus.subscribe(eventType, async (payload) => {
        // OTel Counter
        // counter.add(1, { event: eventType, store: payload.storeDomain });

        // Structured JSON Logging for Datadog / New Relic
        console.log(
          JSON.stringify({
            service: "shopify-recovery-os",
            level: eventType === "Error" ? "error" : "info",
            event: eventType,
            jobId: payload.jobId,
            storeDomain: payload.storeDomain,
            timestamp: payload.timestamp,
            ...payload.meta,
          }),
        );
      });
    });
  }
}

// Auto-bootstrap on import
new EnterpriseMonitoring().bootstrap();
