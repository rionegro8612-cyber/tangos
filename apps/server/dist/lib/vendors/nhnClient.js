"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSmsWithNHN = sendSmsWithNHN;
async function sendSmsWithNHN(payload) {
    // TODO: integrate NHN SMS API
    return { providerTraceId: "nhn-mock-" + Math.random().toString(36).slice(2) };
}
