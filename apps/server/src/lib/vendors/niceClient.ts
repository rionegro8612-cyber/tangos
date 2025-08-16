export async function verifyNICE(input: { name: string; birth: string; phone: string; carrier: string }) {
  // TODO: integrate NICE
  return { verified: true, providerTraceId: "nice-mock-" + Math.random().toString(36).slice(2) };
}