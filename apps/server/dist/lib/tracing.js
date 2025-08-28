"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTracing = startTracing;
exports.stopTracing = stopTracing;
exports.getTracingStatus = getTracingStatus;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
// 트레이싱 설정
const tracingConfig = {
    // OTLP exporter 설정 (Tempo/Jaeger로 전송)
    otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    // 서비스 정보
    serviceName: process.env.OTEL_SERVICE_NAME || 'tango-server',
    serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
    // 환경 정보
    environment: process.env.NODE_ENV || 'development',
    // 트레이싱 활성화 여부
    enabled: process.env.OTEL_ENABLED === 'true'
};
// OpenTelemetry SDK 설정 (간단한 버전)
const sdk = new sdk_node_1.NodeSDK({
    // 자동 인스트루먼트 (HTTP, Express, DB 등)
    instrumentations: [
        (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
            // 특정 인스트루먼트 비활성화 (필요시)
            '@opentelemetry/instrumentation-fs': {
                enabled: false, // 파일시스템 트레이싱 비활성화
            },
            '@opentelemetry/instrumentation-dns': {
                enabled: false, // DNS 트레이싱 비활성화
            }
        })
    ],
    // OTLP exporter 설정
    traceExporter: tracingConfig.enabled ? new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: tracingConfig.otlpEndpoint,
        headers: {
            // 인증이 필요한 경우 헤더 추가
            ...(process.env.OTLP_AUTH_TOKEN && {
                'Authorization': `Bearer ${process.env.OTLP_AUTH_TOKEN}`
            })
        }
    }) : undefined
});
// 트레이싱 시작
function startTracing() {
    if (!tracingConfig.enabled) {
        console.log('[TRACING] OpenTelemetry tracing is disabled');
        return;
    }
    try {
        sdk.start();
        console.log('[TRACING] OpenTelemetry tracing started successfully');
        console.log('[TRACING] OTLP endpoint:', tracingConfig.otlpEndpoint);
        console.log('[TRACING] Service:', tracingConfig.serviceName, tracingConfig.serviceVersion);
    }
    catch (error) {
        console.error('[TRACING] Failed to start OpenTelemetry tracing:', error);
    }
}
// 트레이싱 종료
function stopTracing() {
    if (tracingConfig.enabled) {
        sdk.shutdown()
            .then(() => console.log('[TRACING] OpenTelemetry tracing stopped'))
            .catch((error) => console.error('[TRACING] Error stopping tracing:', error));
    }
}
// 트레이싱 상태 확인
function getTracingStatus() {
    return {
        enabled: tracingConfig.enabled,
        serviceName: tracingConfig.serviceName,
        serviceVersion: tracingConfig.serviceVersion,
        environment: tracingConfig.environment,
        otlpEndpoint: tracingConfig.otlpEndpoint
    };
}
// 프로세스 종료 시 트레이싱 정리
process.on('SIGTERM', stopTracing);
process.on('SIGINT', stopTracing);
