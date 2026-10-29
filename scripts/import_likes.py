"""Derive factual like counts from the existing pinned source snapshots only."""
from collections import Counter
from pathlib import Path
import csv,hashlib,json,re

SITE=Path(__file__).resolve().parents[1]
WORKSPACE=SITE.parent
EVIDENCE=WORKSPACE/'.tools/trump-says-20261028'
RAW=EVIDENCE/'raw'
audit=json.loads((EVIDENCE/'source-audit.json').read_text(encoding='utf-8'))
manifest=json.loads((SITE/'src/data/manifest.json').read_text(encoding='utf-8'))
sources={s['id']:s for s in audit['sources']}
rows={};rejected=Counter();counts=Counter()

def put(identity,platform,value,source,filename):
    identity=str(identity)
    value=str(value).strip()
    if not re.fullmatch(r'\d+',identity) or not re.fullmatch(r'\d+',value):
        rejected[source]+=1
        return
    key=platform+':'+identity
    # First available value wins in this explicit snapshot priority order.
    if key not in rows:
        rows[key]={'count':int(value),'source_id':source}
        counts[source]+=1

for source,filename in [('stiles','stiles-truth.json'),('truth-fork','truth-fork-truth.json')]:
    raw=(RAW/filename).read_bytes()
    expected=next(f['sha256'] for f in sources[source]['files'] if f['file']==filename)
    assert hashlib.sha256(raw).hexdigest()==expected
    for row in json.loads(raw):
        put(row['id'],'truth',row.get('favourites_count'),'stiles' if source=='stiles' else 'truth-fork',filename)

filename='kaggle-djt_posts_dec2025.csv'
raw=(RAW/filename).read_bytes()
assert hashlib.sha256(raw).hexdigest()==sources['3dl-kaggle-v1']['files'][0]['sha256']
with (RAW/filename).open(encoding='utf-8-sig',newline='') as h:
    for row in csv.DictReader(h):
        platform={'Twitter':'x','Truth Social':'truth'}.get(row['platform'])
        if platform:put(row['id'],platform,row.get('favorite_count'),'3dl-kaggle-v1',filename)

all_rows=[]
for chunk in manifest['chunks']:
    all_rows.extend(json.loads((SITE/'src'/chunk['file']).read_text(encoding='utf-8')))
retained={r['id'] for r in all_rows}
rows={key:value for key,value in rows.items() if key in retained}
output={
    'captured_at':audit['captured_at'],
    'capture_time_basis':'Time the source files were collected locally, not the time each like count was measured.',
    'selection_policy':'First available pinned source: stiles, truth-fork, 3dl-kaggle-v1. Counts are source snapshots and are not current live values.',
    'sources':{key:{'id':key,'url':s['url'],'creator':s['creator'],'declared_dataset_license':s['license'],'license_url':s['license_url'],'files':s['files']} for key,s in sources.items()},
    'counts':rows,
}
(SITE/'src/data/likes.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
report={
    'status':'passed','records':len(all_rows),'known_like_counts':len(rows),
    'unknown_like_counts':len(all_rows)-len(rows),'source_selected_counts':dict(counts),
    'unparseable_values':dict(rejected),'source_policy':output['selection_policy'],
    'capture_time_basis':output['capture_time_basis'],'post_chunks_changed':False,
    'bodies_copied':False,'translations_created':False,
}
(SITE/'evidence').mkdir(exist_ok=True)
(SITE/'evidence/likes-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report),flush=True)
