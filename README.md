# Trump Says

Independent timestamped social-record archive. See Sources & coverage in the app and src/data/manifest.json for exact counts, source licenses and gaps. Not complete across all SNS.

Build: node scripts/build.mjs
Tests: node --test tests/*.test.mjs
Import: python scripts/import_archive.py (uses existing workspace source snapshots; --refresh-metadata explicitly refreshes factual current-feed metadata). No recurring job configured.

New owner-private Site; do not register its private URL in the public NaNa Lab catalog.


## English interface and portrait

The interface, runtime states and coverage page are English. The official portrait by Daniel Torok / The White House is a public-domain U.S. federal government work. The original JPEG is unchanged; CSS scales/crops the display. `src/assets/portrait-credit.json` retains the source, license record and SHA-256.


## Publisher integrations

Every generated HTML page includes GA4, Google Tag Manager (with noscript fallback), AdSense and Cloudflare Web Analytics using the verified existing NaNa publisher IDs. The build injects these integrations. Analytics and ad scripts load only on the approved production hostnames, not local preview hosts. User input values and uploaded file contents are not passed to analytics events. GA page locations omit query strings and hashes.
