// Plain module-level state: stands in for any singleton (a class static behaves identically).
let count = 0;
export const increment = () => ++count;
export const getCount = () => count;
