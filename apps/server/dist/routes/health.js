"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
// apps/server/src/routes/health.ts
const express_1 = require("express");
const health_1 = require("../lib/health");
exports.healthRouter = (0, express_1.Router)();
/**
 * GET /_ping - 기본 헬스체크 (기존 호환성 유지)
 */
exports.healthRouter.get('/_ping', (_req, res) => {
    res.json({ ok: true });
});
/**
 * GET /livez - Kubernetes liveness probe
 * 서버가 살아있는지만 확인
 */
exports.healthRouter.get('/livez', (_req, res) => {
    if ((0, health_1.isAlive)()) {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    }
    else {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /readyz - Kubernetes readiness probe
 * 서비스가 트래픽을 받을 준비가 되었는지 확인
 */
exports.healthRouter.get('/readyz', async (_req, res) => {
    try {
        const ready = await (0, health_1.isReady)();
        if (ready) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(503).json({
                status: 'not_ready',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        res.status(503).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /health - 상세 헬스체크
 * 모든 컴포넌트의 상태를 확인
 */
exports.healthRouter.get('/health', async (_req, res) => {
    try {
        const health = await (0, health_1.getSystemHealth)();
        const statusCode = health.overall === 'healthy' ? 200 :
            health.overall === 'degraded' ? 200 : 503;
        res.status(statusCode).json({
            status: health.overall,
            uptime: health.uptime,
            timestamp: new Date(health.timestamp).toISOString(),
            checks: health.checks.map(check => ({
                name: check.name,
                status: check.status,
                message: check.message,
                latency: check.latency,
                timestamp: new Date(check.timestamp).toISOString()
            }))
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /health/rollback - 롤백 조건 체크
 * 자동 배포 시스템에서 사용
 */
exports.healthRouter.get('/health/rollback', async (_req, res) => {
    try {
        const rollbackInfo = await (0, health_1.shouldRollback)();
        res.status(200).json({
            shouldRollback: rollbackInfo.shouldRollback,
            reason: rollbackInfo.reason,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            shouldRollback: true, // 에러 시에는 안전하게 롤백 권장
            reason: error instanceof Error ? error.message : 'Rollback check failed',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = exports.healthRouter;
