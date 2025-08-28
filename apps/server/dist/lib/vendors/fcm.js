"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFCM = sendFCM;
async function sendFCM(token, payload) {
    // TODO: integrate FCM
    return { providerTraceId: "fcm-mock-" + Math.random().toString(36).slice(2) };
}
