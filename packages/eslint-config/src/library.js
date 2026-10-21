// Lint configuration of the shared packages (§14.6).
import { base, packageBoundaries } from './base.js';

/** @param {{ allowedPackages?: string[] }} [options] */
export function library({ allowedPackages = [] } = {}) {
  return [...base, packageBoundaries(allowedPackages)];
}
