/**
 * Public surface of the garbage collection module. Types are exported
 * separately from `#garbage-collection/types`.
 */
export { default as GarbageCollector } from './garbageCollector.js';
export { default as GarbageCollectionUx } from './garbageCollectionUx.js';
export { resolveDevhub, resolvePackageIds } from './garbageFilterResolver.js';
