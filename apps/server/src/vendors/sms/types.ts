export interface SmsProvider {
  send: (to: string, text: string) => Promise<{ ok: true }>;
}
