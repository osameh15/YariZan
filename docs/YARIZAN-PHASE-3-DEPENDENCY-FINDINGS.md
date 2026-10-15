# Phase 3 dependency findings

The Nuxt application pins Nuxt 4.6.1, Vue 3.5.44 and Tailwind 4.3.3. Nuxt and build/test tooling are development dependencies; the deployed artifact is the self-contained `.output/` tree, not the source dependency tree.

Executed full `npm audit` reports **11 high-severity affected dependency nodes arising from two root advisories**, not eleven independently distinct vulnerabilities. Both upstream advisories list no patched version as of this implementation:

- [`braces` GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): stack exhaustion from attacker-controlled deeply nested glob patterns, through 3.0.3. Build patterns come from this repository, not web API input. Nuxt's globby/micromatch chain is affected. Do not run the build on untrusted source or user-supplied patterns.
- [`node-forge` GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): malformed nested DigestAlgorithm acceptance in RSA PKCS#1 v1.5 verification through 1.4.0. Nuxt/Nitro's development listener depends on it. This application does not use forge RSA verification or development HTTPS certificates; server artifact signing is separate NestJS P-256/P1363 code and device proofs use CNG/Node cryptography. This distinction is not an assertion that forge is patched.

`npm audit --omit=dev` reports zero vulnerabilities. The generated server package and recursive artifact scan confirm that Nuxt build tooling, node-forge, listhen and micromatch are absent from `.output/`. No synthetic provisioning password, private-key block or test Admin cookie field is included in the built artifact. The production dependency report is not a substitute for the full report.

`npm run audit:dependencies` checks both reports, fails for any unknown root advisory or critical finding, verifies the generated runtime manifest and scans the artifact. It explicitly prints `UNPATCHED_BUILD_DEPENDENCIES` and writes counts/links to ignored `.local/dependency-audit.json`, uploaded by CI. A passing policy check means the two documented development findings are bounded and visible; it **does not mean the full audit is clean**. Do not disable the raw findings, downgrade the framework merely to suppress audit output or promote this development stack into production.

Commercial startup remains blocked. Independent security review must approve the exposure analysis or require patched/replaced upstream tooling before commercial acceptance. No real signing custody, infrastructure configuration or deployment is provided by this document.
