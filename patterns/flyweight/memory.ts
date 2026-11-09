/** Heap used (MB) after forcing a GC. Needs `node --expose-gc`; otherwise numbers are noisier. */
export function heapUsedMb(): number {
  globalThis.gc?.();
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

/** Runs `build`, keeps its result alive, and reports the heap growth in MB. */
export function measure<T>(build: () => T): { result: T; deltaMb: number } {
  const before = heapUsedMb();
  const result = build();
  const after = heapUsedMb();
  return { result, deltaMb: after - before };
}
