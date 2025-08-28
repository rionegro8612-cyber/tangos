import { SmsProvider } from "./types";
import mock from "./mock";
import twilioProvider from "./twilio";

const provider = (process.env.SMS_PROVIDER || "mock").toLowerCase();

let sms: SmsProvider = mock;
if (provider === "twilio") sms = twilioProvider;

export default sms;
