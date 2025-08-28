export async function verifyPASS(input: {
  name: string;
  birth: string;
  phone: string;
  carrier: string;
}) {
  // TODO: integrate PASS
  return { verified: true, providerTraceId: "pass-mock-" + Math.random().toString(36).slice(2) };
}
