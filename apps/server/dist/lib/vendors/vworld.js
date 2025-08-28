"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAddressVWorld = searchAddressVWorld;
async function searchAddressVWorld(q) {
    // TODO: integrate VWorld API as fallback
    return { items: [], providerTraceId: "vworld-mock-" + Math.random().toString(36).slice(2) };
}
