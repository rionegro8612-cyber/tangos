"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mock = {
    async send(to, text) {
        console.log('[SMS:mock]', to, text);
        return { ok: true };
    },
};
exports.default = mock;
