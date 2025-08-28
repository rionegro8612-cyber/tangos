"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const twilio_1 = __importDefault(require("twilio"));
const sid = process.env.TWILIO_ACCOUNT_SID || '';
const token = process.env.TWILIO_AUTH_TOKEN || '';
const from = process.env.TWILIO_FROM || '';
let client = null;
if (sid && token) {
    client = (0, twilio_1.default)(sid, token);
}
const twilioProvider = {
    async send(to, text) {
        if (!client)
            throw new Error('[SMS] Twilio client not configured');
        if (!from)
            throw new Error('[SMS] TWILIO_FROM missing');
        await client.messages.create({ to, from, body: text });
        return { ok: true };
    },
};
exports.default = twilioProvider;
