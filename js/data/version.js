// ENGINE_VERSION: bump on ANY change that can alter a mission outcome (formulas, data numbers,
// AI weights). Replays and ladder submissions are re-simulated with the version they were made on.
// DATA_VERSION: bump when data changes in a way that doesn't affect outcomes (names, flavor, colours).
export const ENGINE_VERSION = 3;          // v3: tier-1 Cargo Hauler retuned (see ship.revisions). v2: alien ships + the pod-bay ship-log egg
export const COMPAT_VERSIONS = [1, 2, 3];
export const DATA_VERSION = 1;
export const engineCompatible = v => COMPAT_VERSIONS.includes(v);
