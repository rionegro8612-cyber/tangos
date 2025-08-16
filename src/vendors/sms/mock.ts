import { SmsProvider } from './types';

const mock: SmsProvider = {
  async send(to: string, text: string) {
    console.log('[SMS:mock]', to, text);
    return { ok: true };
  },
};

export default mock;
