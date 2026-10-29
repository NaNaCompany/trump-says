"""Validate the generated feed, ranking, route preservation and snapshot invariants."""
from collections import Counter
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from itertools import islice
from html import unescape
import hashlib,json,os,re,subprocess,xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs'
manifest=json.loads((ROOT/'src/data/manifest.json').read_text(encoding='utf-8'))
likes=json.loads((ROOT/'src/data/likes.json').read_text(encoding='utf-8'))
all_rows=[]
def read_chunk(chunk):
 raw=(ROOT/'src'/chunk['file']).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==chunk['sha256'],('Existing source chunk changed',chunk['file'])
 return json.loads(raw)
with ThreadPoolExecutor(max_workers=32) as pool:
 for rows in pool.map(read_chunk,manifest['chunks']):all_rows.extend(rows)
print('Immutable source chunks checked.',flush=True)
all_rows.sort(key=lambda row:(row['published_at'],int(row['post_id'])),reverse=True)
overrides=json.loads((ROOT/'src/data/text-overrides.json').read_text(encoding='utf-8'))
for row in all_rows:
 extra=overrides.get(row['id'])
 if not row.get('text') and isinstance(extra,dict) and isinstance(extra.get('text'),str):
  row.update(text=extra['text'],text_override_status=extra.get('status','available'),text_override_source=extra.get('source_url'))
by_id={r['id']:r for r in all_rows}
eligible=[r for r in all_rows if r['kind'] not in ('repost','retweet')]
known=[r for r in eligible if r['id'] in likes['counts']]
popular=sorted(known,key=lambda r:(-likes['counts'][r['id']]['count'],-datetime.fromisoformat(r['published_at'].replace('Z','+00:00')).timestamp(),r['id']))[:100]
popular_ids=[r['id'] for r in popular];popular_set=set(popular_ids)
expected_latest=[r['id'] for r in eligible if r['id'] not in popular_set]
post_files=set(os.listdir(OUT/'posts'))

def read_pages(paths):
 """Bound outstanding reads to 64 pages; assertions remain in original sequence."""
 paths=iter(paths)
 with ThreadPoolExecutor(max_workers=32) as pool:
  while batch:=list(islice(paths,64)):
   for path,text in zip(batch,pool.map(lambda p:p.read_text(encoding='utf-8'),batch)):yield path,text
def records(text):return [json.loads(s) for s in re.findall(r'<script type="application/json" class="feed-record-data">(.*?)</script>',text,re.S)]
def escaped(value):return re.sub(r'[ \t]+(?=\r?\n)',lambda match:''.join('&#32;' if char==' ' else '&#9;' for char in match[0]),str(value).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;'))

def validate_html(text,url,detail=False):
 assert text.count('rel="canonical"')==1 and f'<link rel="canonical" href="{url}">' in text,url
 for identity in ('G-2ZYSF0173P','GTM-NV2WWQXB','ca-pub-9767176956440077','9f3423bb0d034d91bbe1a12afeff2429','googletagmanager.com/ns.html?id=GTM-NV2WWQXB'):
  assert identity in text,(url,identity)
 assert 'https://nanalab.kr/apps/' in text and 'id="feed-config"' in text
 config=json.loads(re.search(r'<script type="application/json" id="feed-config">(.*?)</script>',text,re.S)[1])
 assert config['archiveMenuUrl']=='/trump-says/archive-menu.html' and config['listTextOnly'] is not detail
 if detail:
  assert config==dict(base='/trump-says/',origin='https://nanalab.kr/trump-says',archiveMenuUrl='/trump-says/archive-menu.html',listTextOnly=False)
 else:assert config['displayTimezone']=='America/New_York' and config['allowText'] is True and config['autoEmbeds'] is False
 assert 'feed.css?v=20261029-text-first' in text and 'feed.js?v=20261029-text-first' in text
 if not detail:
  no_fallback=re.sub(r'<noscript>.*?</noscript>','',text,flags=re.S)
  assert '<iframe' not in no_fallback and 'feed-embed' not in text and 'data-feed-action="embed"' not in text and 'post-detail.js' not in text,url
 for row in records(text):
  assert row['post_kind'] not in ('repost','retweet'),row['id']
  original=by_id[row['id']]
  body=original.get('text') or None
  expected=body[:799]+'…' if body and len(body)>800 else body
  assert row['text']==expected and row['text_truncated']==bool(body and len(body)>800),row['id']
  assert row['text'] is None or len(row['text'])<=800,row['id']
  assert row['source_ids']==original['source_ids'] and row['content_status']==original['content_status'],row['id']
  source=original.get('text_override_source') or original.get('text_source') or None
  expected_source={'provider':source} if isinstance(source,str) and re.fullmatch(r'[a-z0-9][a-z0-9_.-]*',source,re.I) else source
  assert row['text_source']==expected_source,('Runtime source metadata mismatch',row['id'])
  assert f'class="feed-text-link" href="{row["permalink"]}"' in text,row['id']
  if row['text']:assert escaped(row['text']) in text,row['id']
  assert row['id'].replace(':','-')+'.html' in post_files
home=(OUT/'index.html').read_text(encoding='utf-8')
validate_html(home,'https://nanalab.kr/trump-says/')
top_fragment=home.split('<ol id="popular-records">',1)[1].split('</ol>',1)[0]
assert [r['id'] for r in records(top_fragment)]==popular_ids
assert len(popular_ids)==100 and len(popular_set)==100
home_latest=home.split('id="latest-records" data-feed-items>',1)[1].split('</ol>',1)[0]
assert [r['id'] for r in records(home_latest)]==expected_latest[:20]
assert 'assets/donald-trump-portrait.jpg' in home
assert 'id="archive-toggle"' in home and 'id="archive-panel-body"' in home and 'class="month-button"' in home
new_pages=sorted((OUT/'feed').glob('latest-*.html'));latest=[]
for i,(path,text) in enumerate(read_pages(new_pages),1):
 url='https://nanalab.kr/trump-says/feed/'+path.name
 validate_html(text,url);page=records(text);assert 0<len(page)<=20
 latest.extend(r['id'] for r in page)
 links=re.findall(r'<a id="feed-next" rel="next" href="([^"]+)"',text)
 assert links==([f'/trump-says/feed/latest-{i+1:04d}.html'] if i<len(new_pages) else []),(path,'next sequence')
 if i%500==0:print(f'Feed pages checked: {i}/{len(new_pages)}',flush=True)
assert latest==expected_latest and len(latest)==len(set(latest))
assert not set(latest)&popular_set
NS='{http://www.sitemaps.org/schemas/sitemap/0.9}'
index=ET.parse(OUT/'sitemap.xml').getroot();refs=[n.findtext(NS+'loc') for n in index]
assert len(refs)==3
post_urls=[];navigation=[]
for url in refs:
 path=OUT/url.rsplit('/',1)[1];root=ET.parse(path).getroot();locs=[n.findtext(NS+'loc') for n in root]
 assert len(locs)<=50000 and path.stat().st_size<50_000_000
 if path.name.startswith('sitemap-posts-'):post_urls+=locs
 else:navigation=locs
assert len(post_urls)==97084 and len(set(post_urls))==97084
previous=[]
for name in ('sitemap-posts-01.xml','sitemap-posts-02.xml'):
 raw=subprocess.run(['git','show','HEAD:docs/'+name],cwd=ROOT,capture_output=True,check=True).stdout
 previous.extend(n.findtext(NS+'loc') for n in ET.fromstring(raw))
assert previous==post_urls,'Existing post URLs or order changed'
assert len(navigation)==len(set(navigation))
for path in new_pages:assert 'https://nanalab.kr/trump-says/feed/'+path.name in navigation
assert 'https://nanalab.kr/trump-says/archive-menu.html' in navigation
menu=(OUT/'archive-menu.html').read_text(encoding='utf-8');assert 'id="archive-menu-content"' in menu
for name in ('feed.js','feed.css'):assert (ROOT/'src'/name).read_bytes()==(OUT/name).read_bytes()
for i,(path,text) in enumerate(read_pages((OUT/'archive').glob('*.html')),1):
 validate_html(text,'https://nanalab.kr/trump-says/archive/'+path.name)
 if i%1000==0:print(f'Archive pages checked: {i}',flush=True)
for name in ('search.html','sources.html','archive-menu.html'):
 validate_html((OUT/name).read_text(encoding='utf-8'),'https://nanalab.kr/trump-says/'+name)
assert 'browse-month.js?v=20261029-text-first' in (OUT/'archive/2026-10.html').read_text(encoding='utf-8')
assert 'app.js?v=20261029-text-first' in (OUT/'search.html').read_text(encoding='utf-8')
for name in ('app.js','browse-month.js'):
 source=(ROOT/'src'/name).read_text(encoding='utf-8')
 assert not re.search(r'createTweet|widgets\.js|createElement\([\'"]iframe',source)
# Existing static detail bodies are generated from the same immutable source chunks.
sampled=list({r['id']:r for r in [*all_rows[:100],all_rows[-1],all_rows[len(all_rows)//2],*popular[:3],*[by_id[id] for id in overrides]]}.values())
sample_paths=[OUT/'posts'/(row['id'].replace(':','-')+'.html') for row in sampled]
for row,(_,text) in zip(sampled,read_pages(sample_paths)):
 validate_html(text,'https://nanalab.kr/trump-says/posts/'+row['id'].replace(':','-')+'.html',detail=True)
 assert row['published_at'] in text
 assert 'post-detail.js?v=20261029-text-first' in text and 'id="post-embed"' in text and 'id="load-post-embed"' in text,row['id']
 data=json.loads(re.search(r'<script type="application/json" id="post-detail-config">(.*?)</script>',text,re.S)[1])
 assert data=={'original_url':row['original_url']},row['id']
 if row['text']:
  assert '<blockquote class="post-text" dir="auto">'+escaped(row['text'])+'</blockquote>' in text,row['id']
  captured=re.search(r'<blockquote class="post-text" dir="auto">(.*?)</blockquote>',text,re.S)[1]
  assert unescape(captured)==row['text'],('Rendered detail source string changed',row['id'])
 if row.get('text_override_source'):assert escaped(row['text_override_source']) in text and escaped(row['text_override_status']) in text,row['id']
files=[]
def scan_entries(folder):
 for entry in os.scandir(folder):
  if entry.is_dir(follow_symlinks=False):yield from scan_entries(entry.path)
  elif entry.is_file(follow_symlinks=False):yield entry
print('Feed, browse and detail assertions passed; measuring final output bytes.',flush=True)
with ThreadPoolExecutor(max_workers=32) as pool:
 entries=scan_entries(OUT)
 while batch:=list(islice(entries,512)):
  files.extend(pool.map(lambda entry:(entry.name,entry.stat(follow_symlinks=False).st_size),batch))

total_bytes=sum(size for _,size in files)
assert total_bytes<1_000_000_000,('GitHub Pages size risk',total_bytes)
report=dict(status='passed',display_policy='text-first-list-and-full-text-plus-official-detail-embed',source_records=len(all_rows),existing_source_chunks_unchanged=True,existing_post_urls_preserved=len(post_urls),popular_records=len(popular_ids),latest_records=len(latest),excluded_native_reposts=sum(r['kind'] in ('repost','retweet') for r in all_rows),unknown_kind_retained=sum(r['kind']=='unknown' for r in eligible),feed_pages=len(new_pages),feed_page_size=20,feed_latest_unique_descending=True,home_latest_equals_page_one=True,popular_latest_disjoint=True,feed_preview_limit_codepoints=800,lists_without_platform_embeds=True,source_text_overlays=len(overrides),source_text_overlays_nonempty=sum(bool(r.get('text')) for r in overrides.values()),likes_known=len(likes['counts']),likes_unknown=len(all_rows)-len(likes['counts']),all_new_feed_and_browse_pages_publisher_checked=True,lazy_archive_menu=True,browse_timezone='America/New_York',source_bytes_unchanged=True,docs_files=len(files),docs_html=sum(name.endswith('.html') for name,_ in files),docs_bytes=total_bytes,sitemap_leaves=refs,navigation_urls=len(navigation),detail_samples_checked=len(sampled))
(ROOT/'evidence/feed-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report),flush=True)
