# Trump Says — Update log

## 2026-10-28

- Removed decorative Korean slogans and changed the heading to `Trump Says`.
- Converted all controls, search results, errors, post-type labels and the sources/coverage page to English. Default display timezone is US Eastern.
- Added Daniel Torok / The White House's official portrait, a public-domain U.S. federal government work. The original JPEG and attribution/source/license/hash record are retained in `src/assets/`.
- Preserved the partial corpus: 97,084 unique records, 90,390 with text and 6,694 metadata-only. No additional platform coverage is claimed.
- Browser verification: portrait loaded, English search returned 530 tariff posts, reset worked and no console errors were observed. Four search/timezone/safe-link tests pass.
- Deployment target: https://trump-says.bahn1307.chatgpt.site (owner-private).


## 2026-10-28 — GitHub Pages public release

- Public repository: https://github.com/NaNaCompany/trump-says . Public app: https://nanalab.kr/trump-says/ .
- Changed hosting target to GitHub Pages `main:/docs`, retained licenses and attribution, added `.nojekyll`, public canonical/robots/sitemap URLs and removed private-preview noindex directives. The private Sites prototype is preserved separately.
- Added verified GA4 `G-2ZYSF0173P`, GTM `GTM-NV2WWQXB`, AdSense `ca-pub-9767176956440077` and Cloudflare Web Analytics `9f3423bb0d034d91bbe1a12afeff2429` to every HTML page. Local/test hosts do not initialize analytics or advertising scripts. No input contents are sent in custom analytics events.
- Created one static HTML per record, with self-canonical, timestamp, full archived text when available, provenance and original link. Main navigation is year → month (50 random posts and day buttons) → complete day list → record detail. Browse dates use America/New_York including DST. Full-text search is on a separate page and loads the corpus only on user search.
- Root sitemap index references a navigation sitemap and post shards of 50,000 and 47,084 URLs. Google protocol also limits each uncompressed sitemap to 50 MB; both limits are checked.

- Public output validation passed: 102451 HTML pages; all four integrations, canonical URLs and indexable metadata checked.
- Final browse structure: 197 month pages with 50 random records and day buttons; 5,167 complete day lists; 97,084 detail pages. Main page fetches no archive JSON and runs no search worker. All browse dates independently checked in America/New_York. Truth Social short and /posts/ source permalink formats are both retained.


## 2026-10-29 — Popular posts, latest HTML feed and floating archive

- Reused the verified Daniel Torok / White House public-domain portrait and its unchanged original bytes and credit record.
- Added exact available source like-count metadata without changing the original monthly source chunks. Unknown counts remain null. Source capture timestamps and fixed selection precedence are recorded in data/likes.json and evidence/likes-audit.json.
- Home statically renders up to 100 known-count popular posts and the first 20 latest eligible records. Popular IDs are omitted from the latest continuation stream; subsequent full HTML pages load in chronological order without duplication. Native reposts are excluded from the new feed and rendered month/day lists; original detail routes and source history are preserved.
- Added the shared right floating year/month archive menu, with a lazy shared archive HTML document on detail/list pages to control site size. US Eastern dates and IANA daylight-saving behavior remain.
- New feed content uses official X/Truth Social embeds with automatic viewport loading and original-link fallback. The new feed contains no uncleared full text, translations, media or copied portrait assets. Existing detail/search bodies remain unchanged.
- Added feed-ranking, null/zero likes, repost classification, permalink and JSON safety regression tests alongside the existing core and publisher checks. scripts/check_feed.py checks the continuation sequence, exact ranking, duplicate avoidance, old post URL preservation, source hashes, publisher tags and final byte size.
- GA4, GTM including noscript, AdSense, Cloudflare, canonicals and More Apps are retained on new and rebuilt public HTML. Local publisher/iframe traffic remains blocked by the shared preview CSP and runtime hostname guard.
- This record describes the prepared local update. Commit/push/Pages/live-readback status is recorded by the parent release workflow; this note alone does not claim a deployment.

- Final local result: 31 Node tests passed; 4,059 latest HTML pages contain 81,179 records after excluding the 100 popular IDs and 15,805 native reposts. Unknown source kinds remain classified unknown. All 97,084 original detail URLs and source-chunk hashes are preserved. 6,694 metadata-only details now auto-load official embeds. Static feed validation passed; final docs size 881,574,247 bytes across 106,511 HTML files, under the 1,000,000,000-byte release guard.
