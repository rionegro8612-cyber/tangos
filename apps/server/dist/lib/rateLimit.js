"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
function rateLimit(options) {
    const memory = {};
    return (req, res, next) => {
        const k = options.key(req);
        const now = Date.now();
        const entry = memory[k] && memory[k].resetAt > now
            ? memory[k]
            : (memory[k] = { count: 0, resetAt: now + options.windowSec * 1000 });
        entry.count += 1;
        if (entry.count > options.limit) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader("Retry-After", String(retryAfter));
            return res.fail("RATE_LIMITED", "Too many requests", 429);
        }
        next();
    };
}
