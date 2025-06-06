// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import { ProxyTracerProvider, metrics, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import { shutdownAzureMonitor, useAzureMonitor } from "../../src";

describe("ApplicationInsightsClient", () => {
    afterEach(() => {
        shutdownAzureMonitor();
    });

    it("OTLP Exporters added", () => {
        useAzureMonitor({
            azureMonitorExporterOptions:
                { connectionString: "InstrumentationKey=1aa11111-bbbb-1ccc-8ddd-eeeeffff3333" },
            otlpMetricExporterConfig: { enabled: true },
            otlpTraceExporterConfig: { enabled: true },
            otlpLogExporterConfig: { enabled: true }
        });
        let meterProvider = metrics.getMeterProvider() as any;
        let metricCollectors = meterProvider["_sharedState"]["metricCollectors"];
        assert.ok(metricCollectors.length == 2, "wrong number of metric collectors");
        let otlpExporter = metricCollectors[1]["_metricReader"]["_exporter"];
        assert.ok(otlpExporter instanceof OTLPMetricExporter, "wrong exporter");

        let tracerProvider = ((trace.getTracerProvider() as ProxyTracerProvider).getDelegate() as any);
        let spanProcessors = tracerProvider["_registeredSpanProcessors"];
        assert.ok(spanProcessors.length == 4, "wrong number of spanProcessors");
        otlpExporter = spanProcessors[3]["_exporter"];
        assert.ok(otlpExporter instanceof OTLPTraceExporter, "wrong exporter");

        let loggerProvider = ((logs.getLoggerProvider() as LoggerProvider) as any);
        let logRecordProcessors = loggerProvider["_sharedState"]["registeredLogRecordProcessors"];
        assert.ok(logRecordProcessors.length == 3, "wrong number of logRecordProcessors");
        otlpExporter = logRecordProcessors[2]["_exporter"];
        assert.ok(otlpExporter instanceof OTLPLogExporter, "wrong exporter");
    });
});
