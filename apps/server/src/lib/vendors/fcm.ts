export async function sendFCM(token: string, payload: any) {
  // TODO: integrate FCM
  return { providerTraceId: "fcm-mock-" + Math.random().toString(36).slice(2) };
}
