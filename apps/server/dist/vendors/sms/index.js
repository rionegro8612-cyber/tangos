"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mock_1 = __importDefault(require("./mock"));
const twilio_1 = __importDefault(require("./twilio"));
const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
let sms = mock_1.default;
if (provider === 'twilio')
    sms = twilio_1.default;
exports.default = sms;
