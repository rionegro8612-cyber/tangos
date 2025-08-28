export async function sendSmsWithSENS(payload: {
  to: string;
  content: string;
}): Promise<{ providerTraceId: string }> {
  // TODO: integrate AWS SENS SDK
  return { providerTraceId: "sens-mock-" + Math.random().toString(36).slice(2) };
}
