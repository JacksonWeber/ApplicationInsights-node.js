// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { shutdownAzureMonitor as distroShutdownAzureMonitor, useAzureMonitor as distroUseAzureMonitor } from "@azure/monitor-opentelemetry";
import { ProxyTracerProvider, diag, metrics, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BasicTracerProvider, BatchSpanProcessor, SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { AutoCollectLogs } from "./logs/autoCollectLogs";
import { AutoCollectExceptions } from "./logs/exceptions";
import { AzureMonitorOpenTelemetryOptions } from "./types";
import { ApplicationInsightsConfig } from "./shared/configuration/config";
import { LogApi } from "./shim/logsApi";
import { StatsbeatFeature } from "./shim/types";
import { StatsbeatFeaturesManager } from "./shared/util/statsbeatFeaturesManager";

let autoCollectLogs: AutoCollectLogs;
let exceptions: AutoCollectExceptions;

/**
 * Initialize Azure Monitor
 * @param options Configuration
 */
export function useAzureMonitor(options?: AzureMonitorOpenTelemetryOptions) {
    // Initialize statsbeat features with default values and enable SHIM feature
    StatsbeatFeaturesManager.getInstance().initialize();
    StatsbeatFeaturesManager.getInstance().enableFeature(StatsbeatFeature.SHIM);
    
    // Allows for full filtering of dependency/request spans
    const internalConfig = new ApplicationInsightsConfig(options);
    
    // Add OTLP exporters if configured
    const otlpSpanProcessor = _getOtlpSpanExporter(internalConfig);
    const otlpLogProcessor = _getOtlpLogExporter(internalConfig);
    
    // Ensure options object exists and add processors
    if (!options) {
        options = {};
    }
    
    if (otlpSpanProcessor) {
        if (!options.spanProcessors) {
            options.spanProcessors = [];
        }
        options.spanProcessors.push(otlpSpanProcessor);
    }
    
    if (otlpLogProcessor) {
        if (!options.logRecordProcessors) {
            options.logRecordProcessors = [];
        }
        options.logRecordProcessors.push(otlpLogProcessor);
    }
    
    distroUseAzureMonitor(options);
    
    // Comprehensive logging to inspect created metricReaders and metricExporters
    console.log("=== POST DISTRO ANALYSIS START ===");
    
    try {
        const meterProvider = metrics.getMeterProvider() as MeterProvider;
        console.log("MeterProvider type:", meterProvider.constructor.name);
        console.log("MeterProvider instance:", meterProvider);
        
        // Access internal state to inspect metric readers and exporters
        const meterProviderInternal = meterProvider as any;
        console.log("MeterProvider internal keys:", Object.keys(meterProviderInternal));
        
        if (meterProviderInternal._sharedState) {
            console.log("MeterProvider _sharedState:", meterProviderInternal._sharedState);
            console.log("MeterProvider _sharedState keys:", Object.keys(meterProviderInternal._sharedState));
            
            if (meterProviderInternal._sharedState.metricCollectors) {
                const metricCollectors = meterProviderInternal._sharedState.metricCollectors;
                console.log("Number of metric collectors:", metricCollectors.length);
                
                metricCollectors.forEach((collector: any, index: number) => {
                    console.log(`\n--- Metric Collector ${index} ---`);
                    console.log("Collector type:", collector.constructor.name);
                    console.log("Collector keys:", Object.keys(collector));
                    
                    if (collector._metricReader) {
                        const metricReader = collector._metricReader;
                        console.log("MetricReader type:", metricReader.constructor.name);
                        console.log("MetricReader keys:", Object.keys(metricReader));
                        
                        if (metricReader._exporter) {
                            const exporter = metricReader._exporter;
                            console.log("Exporter type:", exporter.constructor.name);
                            console.log("Exporter keys:", Object.keys(exporter));
                            
                            // Log exporter configuration
                            if (exporter._otlpExporter) {
                                console.log("Underlying OTLP Exporter:", exporter._otlpExporter.constructor.name);
                                console.log("Underlying OTLP Exporter keys:", Object.keys(exporter._otlpExporter));
                            }
                            
                            // Check for delegate pattern
                            if (exporter._delegate) {
                                console.log("Exporter delegate type:", exporter._delegate.constructor.name);
                                console.log("Exporter delegate keys:", Object.keys(exporter._delegate));
                                
                                if (exporter._delegate._transport) {
                                    console.log("Transport type:", exporter._delegate._transport.constructor.name);
                                    console.log("Transport keys:", Object.keys(exporter._delegate._transport));
                                    
                                    if (exporter._delegate._transport._transport) {
                                        const innerTransport = exporter._delegate._transport._transport;
                                        console.log("Inner transport type:", innerTransport.constructor.name);
                                        console.log("Inner transport keys:", Object.keys(innerTransport));
                                        
                                        if (innerTransport._parameters) {
                                            console.log("Transport parameters:", innerTransport._parameters);
                                        }
                                    }
                                }
                            }
                            
                            // For Azure Monitor exporters
                            if (exporter._azureExporter) {
                                console.log("Azure Exporter type:", exporter._azureExporter.constructor.name);
                            }
                        }
                        
                        // Log metric reader configuration
                        if (metricReader._exportIntervalMillis) {
                            console.log("Export interval (ms):", metricReader._exportIntervalMillis);
                        }
                        if (metricReader._exportTimeoutMillis) {
                            console.log("Export timeout (ms):", metricReader._exportTimeoutMillis);
                        }
                    }
                });
            }
            
            if (meterProviderInternal._sharedState.metricReaders) {
                console.log("\nDirect metric readers:", meterProviderInternal._sharedState.metricReaders);
            }
        }
        
        // Log options that were passed to the distro
        console.log("\nOptions passed to distro:");
        console.log("- metricReaders length:", options?.metricReaders?.length || 0);
        if (options?.metricReaders) {
            options.metricReaders.forEach((reader: any, index: number) => {
                console.log(`  MetricReader ${index}:`, reader.constructor.name);
                if (reader._exporter) {
                    console.log(`    Exporter:`, reader._exporter.constructor.name);
                }
            });
        }
        
    } catch (error) {
        console.error("Error during metric provider inspection:", error);
    }
    
    console.log("=== POST DISTRO ANALYSIS END ===\n");
    
    const logApi = new LogApi(logs.getLogger("ApplicationInsightsLogger"));
    autoCollectLogs = new AutoCollectLogs();
    if (internalConfig.enableAutoCollectExceptions) {
        exceptions = new AutoCollectExceptions(logApi);
    }
    autoCollectLogs.enable(internalConfig.instrumentationOptions);
}

/**
* Shutdown Azure Monitor
*/
export async function shutdownAzureMonitor() {
    await distroShutdownAzureMonitor();
    autoCollectLogs.shutdown();
    exceptions?.shutdown();
}

/**
 * Try to send all queued telemetry if present.
 */
export async function flushAzureMonitor() {
    try {
        await (metrics.getMeterProvider() as MeterProvider).forceFlush();
        await (((trace.getTracerProvider() as ProxyTracerProvider).getDelegate()) as BasicTracerProvider).forceFlush();
        await (logs.getLoggerProvider() as LoggerProvider).forceFlush();
    } catch (err) {
        diag.error("Failed to flush telemetry", err);
    }
}

function _getOtlpSpanExporter(internalConfig: ApplicationInsightsConfig): SpanProcessor {
    if (internalConfig.otlpTraceExporterConfig?.enabled) {
        const otlpTraceExporter = new OTLPTraceExporter(internalConfig.otlpTraceExporterConfig);
        const otlpSpanProcessor = new BatchSpanProcessor(otlpTraceExporter);
        return otlpSpanProcessor;
    }
}

function _getOtlpLogExporter(internalConfig: ApplicationInsightsConfig): BatchLogRecordProcessor {
    if (internalConfig.otlpLogExporterConfig?.enabled) {
        const otlpLogExporter = new OTLPLogExporter(internalConfig.otlpLogExporterConfig);
        const otlpLogProcessor = new BatchLogRecordProcessor(otlpLogExporter);
        return otlpLogProcessor;
    }
}
