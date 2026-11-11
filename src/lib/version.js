// The engine's version. package.json is the single source of truth: the web
// and .txt footers, the print zine and the RELEASE file read it from here, and
// publish stamps it into the SSH BBS binary at build time.
import pkg from '../../package.json' with { type: 'json' };

/** @type {string} SemVer, e.g. "1.0.0" */
export const version = pkg.version;

/** @type {string} e.g. "terminull v1.0.0" */
export const versionLabel = `terminull v${pkg.version}`;
