export async function sendSmsWithNHN(payload: {
  to: string;
  content: string;
}): Promise<{ providerTraceId: string }> {
  // TODO: integrate NHN SMS API
  return { providerTraceId: "nhn-mock-" + Math.random().toString(36).slice(2) };
}
