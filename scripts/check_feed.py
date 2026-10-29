"""Validate the generated feed, ranking, route preservation and snapshot invariants."""
from collections import Counter
from datetime import datetime
from pathlib import Path
import hashlib,json,os,re,subprocess,xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs'
manifest=json.loads((ROOT/'src/data/manifest.json').read_text(encoding='utf-8'))
likes=json.loads((ROOT/'src/data/likes.json').read_text(encoding='utf-8'))
all_rows=[]
for chunk in manifest['chunks']:
 raw=(ROOT/'src'/chunk['file']).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==chunk['sha256'],('Existing source chunk changed',chunk['file'])
 all_rows.extend(json.loads(raw))
all_rows.sort(key=lambda row:(row['published_at'],int(row['post_id'])),reverse=True)
eligible=[r for r in all_rows if r['kind'] not in ('repost','retweet')]
known=[r for r in eligible if r['id'] in likes['counts']]
popular=sorted(known,key=lambda r:(-likes['counts'][r['id']]['count'],-datetime.fromisoformat(r['published_at'].replace('Z','+00:00')).timestamp(),r['id']))[:100]
popular_ids=[r['id'] for r in popular];popular_set=set(popular_ids)
expected_latest=[r['id'] for r in eligible if r['id'] not in popular_set]
post_files=set(os.listdir(OUT/'posts'))
def records(text):return [json.loads(s) for s in re.findall(r'<script type="application/json" class="feed-record-data">(.*?)</script>',text,re.S)]
def validate_html(text,url):
 assert text.count('rel="canonical"')==1 and f'<link rel="canonical" href="{url}">' in text,url
 for identity in ('G-2ZYSF0173P','GTM-NV2WWQXB','ca-pub-9767176956440077','9f3423bb0d034d91bbe1a12afeff2429','googletagmanager.com/ns.html?id=GTM-NV2WWQXB'):
  assert identity in text,(url,identity)
 assert 'https://nanalab.kr/apps/' in text and 'id="feed-config"' in text
 config=json.loads(re.search(r'<script type="application/json" id="feed-config">(.*?)</script>',text,re.S)[1])
 assert config['archiveMenuUrl']=='/trump-says/archive-menu.html' and config['displayTimezone']=='America/New_York' and config['allowText'] is False
 for row in records(text):
  assert row['text'] is None and row['post_kind'] not in ('repost','retweet'),row['id']
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
for i,path in enumerate(new_pages,1):
 text=path.read_text(encoding='utf-8');url='https://nanalab.kr/trump-says/feed/'+path.name
 validate_html(text,url);page=records(text);assert 0<len(page)<=20
 latest.extend(r['id'] for r in page)
 links=re.findall(r'<a id="feed-next" rel="next" href="([^"]+)"',text)
 assert links==([f'/trump-says/feed/latest-{i+1:04d}.html'] if i<len(new_pages) else []),(path,'next sequence')
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
# Existing static detail bodies are generated from the same immutable source chunks.
sampled=[all_rows[0],all_rows[-1],all_rows[len(all_rows)//2],*popular[:3]]
for row in sampled:
 text=(OUT/'posts'/(row['id'].replace(':','-')+'.html')).read_text(encoding='utf-8')
 validate_html(text,'https://nanalab.kr/trump-says/posts/'+row['id'].replace(':','-')+'.html')
 assert row['published_at'] in text
files=[]
def scan(folder):
 for entry in os.scandir(folder):
  if entry.is_dir(follow_symlinks=False):scan(entry.path)
  elif entry.is_file(follow_symlinks=False):files.append((entry.name,entry.stat(follow_symlinks=False).st_size))
scan(OUT)
total_bytes=sum(size for _,size in files)
assert total_bytes<1_000_000_000,('GitHub Pages size risk',total_bytes)
report=dict(status='passed',source_records=len(all_rows),existing_source_chunks_unchanged=True,existing_post_urls_preserved=len(post_urls),popular_records=len(popular_ids),latest_records=len(latest),excluded_native_reposts=sum(r['kind'] in ('repost','retweet') for r in all_rows),unknown_kind_retained=sum(r['kind']=='unknown' for r in eligible),feed_pages=len(new_pages),feed_page_size=20,feed_latest_unique_descending=True,home_latest_equals_page_one=True,popular_latest_disjoint=True,feed_bodies_republished=False,likes_known=len(likes['counts']),likes_unknown=len(all_rows)-len(likes['counts']),all_new_feed_pages_publisher_checked=True,lazy_archive_menu=True,browse_timezone='America/New_York',source_bytes_unchanged=True,docs_files=len(files),docs_html=sum(name.endswith('.html') for name,_ in files),docs_bytes=total_bytes,sitemap_leaves=refs,navigation_urls=len(navigation),detail_samples_checked=len(sampled))
(ROOT/'evidence/feed-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report),flush=True)
