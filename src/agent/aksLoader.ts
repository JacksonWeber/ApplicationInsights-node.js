// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as os from 'os';
import * as path from 'path';
import { DiagnosticLogger } from './diagnostics/diagnosticLogger';
import { FileWriter } from "./diagnostics/writers/fileWriter";
import { StatusLogger } from "./diagnostics/statusLogger";
import { AgentLoader } from "./agentLoader";
import { InstrumentationOptions } from '../types';
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { MetricReader, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLP_METRIC_EXPORTER_EXPORT_INTERVAL } from './types';

export class AKSLoader extends AgentLoader {

    constructor() {
        console.log("=== AKS LOADER: Constructor called ===");
        super();
        console.log("AKSLoader: super() call completed");
        console.log("AKSLoader: _canLoad =", this._canLoad);
        
        if (this._canLoad) {
            console.log("=== AKS LOADER: Can load, setting up AKS-specific configuration ===");
            
            (this._options.instrumentationOptions as InstrumentationOptions) = {
                ...this._options.instrumentationOptions,
                console: { enabled: true },
                bunyan: { enabled: true },
                winston: { enabled: true },
            }
            console.log("AKSLoader: Instrumentation options configured");

            let statusLogDir = '/var/log/applicationinsights/';
            if (this._isWindows) {
                if (process.env.HOME) {
                    statusLogDir = path.join(process.env.HOME, "LogFiles", "ApplicationInsights", "status");
                }
                else {
                    statusLogDir = path.join(os.tmpdir(), "Microsoft", "ApplicationInsights", "StatusMonitor", "LogFiles", "ApplicationInsights", "status");
                }
            }
            console.log("AKSLoader: Status log directory set to:", statusLogDir);
            
            this._statusLogger = new StatusLogger(this._instrumentationKey, new FileWriter(statusLogDir, 'status_nodejs.json', {
                append: false,
                deleteOnExit: false,
                renamePolicy: 'overwrite',
                sizeLimit: 1024 * 1024,
            }));
            console.log("AKSLoader: Status logger created");

            this._diagnosticLogger = new DiagnosticLogger(
                this._instrumentationKey,
                new FileWriter(
                    statusLogDir,
                    'applicationinsights-extension.log',
                    {
                        append: true,
                        deleteOnExit: false,
                        renamePolicy: 'overwrite',
                        sizeLimit: 1024 * 1024, // 1 MB
                    }
                )
            );
            console.log("AKSLoader: Diagnostic logger created");

            // Create metricReaders array and add OTLP reader if environment variables request it
            console.log("=== AKS LOADER: Setting up OTLP metrics configuration ===");
            console.log("AKSLoader: OTEL_METRICS_EXPORTER =", process.env.OTEL_METRICS_EXPORTER);
            console.log("AKSLoader: OTEL_EXPORTER_OTLP_ENDPOINT =", process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
            console.log("AKSLoader: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT =", process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT);
            
            try {
                const metricReaders: MetricReader[] = [];
                if (
                    process.env.OTEL_METRICS_EXPORTER === "otlp" &&
                    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT)
                ) {
                    console.log("AKSLoader: OTLP metrics exporter conditions met, creating OTLP metric reader");
                    try {
                        const otlpExporter = new OTLPMetricExporter();
                        console.log("AKSLoader: OTLP metric exporter created successfully");

                        const otlpMetricReader = new PeriodicExportingMetricReader({
                            exporter: otlpExporter,
                            exportIntervalMillis: OTLP_METRIC_EXPORTER_EXPORT_INTERVAL,
                        });
                        console.log("AKSLoader: OTLP metric reader created with interval:", OTLP_METRIC_EXPORTER_EXPORT_INTERVAL);

                        metricReaders.push(otlpMetricReader);
                        console.log("AKSLoader: OTLP metric reader added to metricReaders array");
                    } catch (error) {
                        console.warn("AKSLoader: Failed to create OTLP metric reader:", error);
                    }
                } else {
                    console.log("AKSLoader: OTLP metrics exporter conditions not met, skipping OTLP setup");
                }

                // Attach metricReaders to the options so the distro can consume them
                if ((metricReaders || []).length > 0) {
                    this._options.metricReaders = metricReaders;
                    console.log("AKSLoader: metricReaders attached to options, count:", metricReaders.length);
                } else {
                    console.log("AKSLoader: No metric readers to attach");
                }
            } catch (err) {
                console.warn("AKSLoader: Error while preparing metricReaders:", err);
            }
            console.log("=== AKS LOADER: Constructor completed successfully ===");
        } else {
            console.log("=== AKS LOADER: Cannot load, skipping configuration ===");
        }
    }
}
