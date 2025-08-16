import { SmsProvider } from './types';
import twilio from 'twilio';

const sid   = process.env.TWILIO_ACCOUNT_SID || '';
const token = process.env.TWILIO_AUTH_TOKEN || '';
const from  = process.env.TWILIO_FROM || '';

let client: ReturnType<typeof twilio> | null = null;
if (sid && token) {
  client = twilio(sid, token);
}

const twilioProvider: SmsProvider = {
  async send(to: string, text: string) {
    if (!client) throw new Error('[SMS] Twilio client not configured');
    if (!from)   throw new Error('[SMS] TWILIO_FROM missing');
    await client.messages.create({ to, from, body: text });
    return { ok: true };
  },
};

export default twilioProvider;
