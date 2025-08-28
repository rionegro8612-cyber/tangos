"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAPNs = sendAPNs;
async function sendAPNs(token, payload) {
    // TODO: integrate APNs
    return { providerTraceId: "apns-mock-" + Math.random().toString(36).slice(2) };
}
