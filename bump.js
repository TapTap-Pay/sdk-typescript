// Updates package.json#version + src/version.ts in lockstep. Called
// from the release workflow with the bare numeric tag, e.g.
// `node bump.js 0.0.33`.
//
// Kept as a small node script (rather than sed) so we preserve the
// exact JSON formatting and don't accidentally clobber adjacent fields
// when the file shape evolves.

import fs from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node bump.js <version>");
  process.exit(1);
}

const pkgPath = new URL("./package.json", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const verPath = new URL("./src/version.ts", import.meta.url);
const verSrc = fs.readFileSync(verPath, "utf8");
fs.writeFileSync(
  verPath,
  verSrc.replace(/export const VERSION = ".*";/, `export const VERSION = "${version}";`),
);

console.log(`Bumped to ${version}`);
