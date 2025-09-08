"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withIdempotency = void 0;
const redis_1 = require("../lib/redis");
const memoryCache = new Map();
const TTL_SEC = 300;
const withIdempotency = (ttlSeconds = TTL_SEC) => {
    return async (req, res, next) => {
        const key = req.headers["idempotency-key"] || req.body?.requestId;
        if (!key)
            return next();
        const now = Date.now();
        async function getFromStore() {
            // 1) Redis
            try {
                const r = await (0, redis_1.ensureRedis)();
                const v = await r.get(`idem:${key}`);
                if (v)
                    return v;
            }
            catch (e) {
                // fall through
            }
            // 2) In-memory fallback (dev/test only)
            const m = memoryCache.get(key);
            if (m && m.exp > now)
                return m.value;
            return null;
        }
        async function setToStore(value) {
            try {
                const r = await (0, redis_1.ensureRedis)();
                await r.setex(`idem:${key}`, ttlSeconds, value);
                return;
            }
            catch (e) {
                // in-memory fallback
                memoryCache.set(key, { value, exp: now + ttlSeconds * 1000 });
            }
        }
        // 이미 처리된 요청인지 확인
        const cached = await getFromStore();
        if (cached) {
            // 필요 시 JSON을 복원해서 동일 응답
            return res.status(200).json(JSON.parse(cached));
        }
        // 응답 가로채기
        const originalJson = res.json.bind(res);
        res.json = ((body) => {
            // 성공만 캐시(원한다면 범위 조정)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                setToStore(JSON.stringify(body)).catch(() => { });
            }
            return originalJson(body);
        });
        next();
    };
};
exports.withIdempotency = withIdempotency;
