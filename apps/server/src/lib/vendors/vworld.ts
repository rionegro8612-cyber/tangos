export async function searchAddressVWorld(q: string) {
  // TODO: integrate VWorld API as fallback
  return { items: [], providerTraceId: "vworld-mock-" + Math.random().toString(36).slice(2) };
}
