export async function sendAPNs(token: string, payload: any) {
  // TODO: integrate APNs
  return { providerTraceId: "apns-mock-" + Math.random().toString(36).slice(2) };
}
