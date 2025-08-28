"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSmsWithSENS = sendSmsWithSENS;
async function sendSmsWithSENS(payload) {
    // TODO: integrate AWS SENS SDK
    return { providerTraceId: "sens-mock-" + Math.random().toString(36).slice(2) };
}
