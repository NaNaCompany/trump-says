# Trump Says

Independent timestamped social-record archive. See Sources & coverage in the app and src/data/manifest.json for exact counts, source licenses and gaps. Not complete across all SNS.

Build: node scripts/build.mjs
Tests: node --test tests/*.test.mjs
Import: python scripts/import_archive.py (uses existing workspace source snapshots; --refresh-metadata explicitly refreshes factual current-feed metadata). No recurring job configured.

Public GitHub Pages app: https://nanalab.kr/trump-says/ (main:/docs).


## English interface and portrait

The interface, runtime states and coverage page are English. The official portrait by Daniel Torok / The White House is a public-domain U.S. federal government work. The original JPEG is unchanged; CSS scales/crops the display. `src/assets/portrait-credit.json` retains the source, license record and SHA-256.


## Publisher integrations

Every generated HTML page includes GA4, Google Tag Manager (with noscript fallback), AdSense and Cloudflare Web Analytics using the verified existing NaNa publisher IDs. The build injects these integrations. Analytics and ad scripts load only on the approved production hostnames, not local preview hosts. User input values and uploaded file contents are not passed to analytics events. GA page locations omit query strings and hashes.


## Home feed update — 2026-10-29

The home page keeps the credited official portrait and statically renders up to 100 posts ranked by known source like counts. The following latest feed is newest first, excludes those popular identities, and loads complete local HTML continuation pages in 20-record batches. Native reposts are excluded from the new home/feed and displayed month/day lists; uncertain source classifications remain marked unknown. Existing static detail URLs and the original source chunks remain available unchanged.

Source counts are historical snapshots, not live likes. `python scripts/import_likes.py` derives factual counts from the existing pinned raw files. `src/data/likes.json` preserves the source selection policy, capture-time boundary and source hashes. Missing values remain null; they are not replaced by zero. No full corpus request is made by the homepage.

The right-side Archive control opens year/month navigation. Home has an inline menu; other pages fetch one shared `archive-menu.html` only when opened, avoiding hundreds of repeated month links in every detail page. Dates retain US Eastern time with IANA daylight-saving rules.

The new feed records do not republish uncleared post bodies. Official X and Truth Social embeds load automatically near the viewport with a bounded queue, and the original permalink remains available. Existing detail/search text is not rewritten by this update. The owner's separate local text archive is not copied into this repository by the feed builder.

Verification: `node --test tests/core.test.mjs tests/publisher.test.mjs tests/feed-model.test.mjs tests/feed-runtime.test.mjs`; `python scripts/check_feed.py`. Shared feed runtime regression tests are included and run against src/feed.js. Every generated continuation page retains canonical, GA4, GTM with noscript, AdSense, Cloudflare and More Apps. The feed-only text policy does not change the source rights declarations recorded in Sources & coverage.
