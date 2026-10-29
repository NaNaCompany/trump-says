"""Check exact recovered detail text for overlays and whitespace-encoded source strings."""
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path
import hashlib,json,re

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'src/data/manifest.json').read_text(encoding='utf-8'))
overrides=json.loads((ROOT/'src/data/text-overrides.json').read_text(encoding='utf-8'))
rows=[]
for chunk in manifest['chunks']:
 raw=(ROOT/'src'/chunk['file']).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==chunk['sha256'],chunk['file']
 rows.extend(json.loads(raw))
selected=[];whitespace=0
for row in rows:
 extra=overrides.get(row['id'])
 if not row.get('text') and isinstance(extra,dict) and isinstance(extra.get('text'),str):row={**row,'text':extra['text']}
 encoded=bool(re.search(r'[ \t]+(?=\r?\n)',row.get('text') or ''))
 if encoded:whitespace+=1
 if extra or encoded:selected.append(row)

def check(row):
 raw=(ROOT/'docs/posts'/(row['id'].replace(':','-')+'.html')).read_bytes()
 text=raw.decode('utf-8')
 match=re.search(r'<blockquote class="post-text" dir="auto">(.*?)</blockquote>',text,re.S)
 if row.get('text'):
  assert match,('Missing full body',row['id'])
  decoded=unescape(match[1])
  assert decoded==row['text'],('Rendered body differs from source string',row['id'])
  assert hashlib.sha256(decoded.encode('utf-8')).hexdigest()==hashlib.sha256(row['text'].encode('utf-8')).hexdigest(),row['id']
 else:assert not match,('Invented body for empty source',row['id'])
 assert 'id="post-detail-config"' in text and 'id="post-embed"' in text,row['id']
 if row['id'] in overrides:
  extra=overrides[row['id']]
  assert extra['status'] in text and extra['source_url'] in text,row['id']
 return row['id']

with ThreadPoolExecutor(max_workers=32) as pool:checked=list(pool.map(check,selected))
report=dict(status='passed',immutable_source_records=len(rows),overlay_records=len(overrides),checked_detail_records=len(checked),source_strings_with_encoded_line_end_whitespace=whitespace,decoded_body_exact_source_string=True,decoded_utf8_sha256_matches_source=True,no_source_trimming=True,empty_media_sources_not_invented=True)
(ROOT/'evidence/detail-text-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report),flush=True)
