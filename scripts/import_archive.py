from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
from html.parser import HTMLParser
from collections import Counter, defaultdict
import csv, datetime as dt, hashlib, json, re, sys

ROOT=Path(__file__).resolve().parents[3]
SITE=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'.tools/trump-says-20261028'
RAW=EVIDENCE/'raw'
DATA=SITE/'src/data';DATA.mkdir(parents=True,exist_ok=True)
UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
audit=json.loads((EVIDENCE/'source-audit.json').read_text(encoding='utf-8'))
source_defs={row['id']:row for row in audit['sources']}
records={};rejects=[];conflicts=[];raw_counts=Counter();encoding_repairs=Counter()

def repair_encoding(value,source):
    # Repair only reversible UTF-8 bytes misread as Latin-1. Raw snapshots remain unchanged.
    def repair(match):
        chunk=match.group()
        try:
            fixed=chunk.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError,UnicodeDecodeError):return chunk
        if fixed!=chunk:encoding_repairs[source]+=1
        return fixed
    return re.sub(r'[\u0080-\u00ff]+',repair,str(value or ''))

class Text(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.parts=[]
    def handle_starttag(self,tag,attrs):
        if tag in {'p','br','div'}:self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag in {'p','div'}:self.parts.append('\n')
    def handle_data(self,data):self.parts.append(data)
def plain(value):
    p=Text();p.feed(str(value or ''))
    return re.sub(r'\n{3,}','\n\n',''.join(p.parts)).strip()
def flag(v):return str(v).strip().lower() in {'true','1','yes'}
def date(value):
    d=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
    if d.tzinfo is None:raise ValueError('timestamp has no timezone')
    if d>NOW+dt.timedelta(minutes=10):raise ValueError('future timestamp')
    return d.astimezone(UTC)
def add(source,platform,identity,when,text,url,kind='unknown',deleted=None,media=0):
    raw_counts[source]+=1
    text=repair_encoding(text,source)
    try:
        identity=str(identity)
        assert re.fullmatch(r'\d+',identity),'non-decimal ID'
        stamp=date(when)
        provided=stamp
        encoded=None
        if platform=='truth':encoded=dt.datetime.fromtimestamp((int(identity)>>16)/1000,UTC)
        elif platform=='x' and int(identity)>100000000000:encoded=dt.datetime.fromtimestamp(((int(identity)>>22)+1288834974657)/1000,UTC)
        corrected=encoded is not None and abs((encoded-stamp).total_seconds())>2
        if corrected:stamp=encoded
        parts=urlsplit(url)
        assert parts.scheme=='https' and parts.netloc in {'x.com','twitter.com','truthsocial.com'},'unrecognized source host'
        assert parts.path.rstrip('/').endswith('/'+identity),'permalink ID mismatch'
        assert 'realdonaldtrump' in parts.path.lower(),'account permalink mismatch'
        key=platform+':'+identity
        row={'id':key,'platform':platform,'post_id':identity,'published_at':stamp.isoformat(timespec='milliseconds').replace('+00:00','Z'),'text':text.strip(),'kind':kind,'source_ids':[source],'original_url':url,'source_deleted_flag':deleted,'media_count':int(media or 0)}
        row['text_source']=source if row['text'] else None
        if corrected:
            row['provided_at']=provided.isoformat().replace('+00:00','Z')
            row['timestamp_basis']='post_id_timestamp'
        if key in records:
            old=records[key]
            if abs((date(old['published_at'])-stamp).total_seconds())>1:
                conflicts.append({'id':key,'type':'timestamp','source':source,'existing':old['published_at'],'incoming':row['published_at']})
            if old['text'] and row['text'] and re.sub(r'\s+',' ',old['text'])!=re.sub(r'\s+',' ',row['text']):
                conflicts.append({'id':key,'type':'text_variant','source':source,'existing_sha256':hashlib.sha256(old['text'].encode()).hexdigest(),'incoming_sha256':hashlib.sha256(row['text'].encode()).hexdigest()})
            old['source_ids']=sorted(set(old['source_ids']+[source]))
            if source in {'stiles','truth-fork','cnn-metadata'} and platform=='truth' and abs((date(old['published_at'])-stamp).total_seconds())<=1:
                old['published_at']=row['published_at']
            if len(row['text'])>len(old['text']):old['text']=row['text'];old['text_source']=source
            if old['kind']=='unknown' and row['kind']!='unknown':old['kind']=row['kind']
            old['media_count']=max(old['media_count'],row['media_count'])
            # Do not turn an old source flag into a current live deletion claim.
            if deleted is not None:old['source_deleted_flag']=deleted
        else:records[key]=row
    except Exception as error:rejects.append({'source':source,'id':str(identity),'reason':str(error)})

for source in audit['sources']:
    for file in source['files']:
        data=(RAW/file['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==file['sha256'],'Raw source changed'

with (RAW/'kaggle-djt_posts_dec2025.csv').open(encoding='utf-8-sig',newline='') as handle:
    for row in csv.DictReader(handle):
        platform={'Twitter':'x','Truth Social':'truth'}.get(row['platform'])
        if not platform:
            rejects.append({'source':'3dl-kaggle-v1','id':row['id'],'reason':'unknown platform'});continue
        kind='repost' if flag(row['repost_flag']) else 'quote' if flag(row['quote_flag']) else 'original'
        add('3dl-kaggle-v1',platform,row['id'],row['date'],row['text'],row['post_url'],kind,flag(row['deleted_flag']),row['media_count'])
for source,name in [('stiles','stiles-truth.json'),('truth-fork','truth-fork-truth.json')]:
    for row in json.loads((RAW/name).read_text(encoding='utf-8')):
        add(source,'truth',row['id'],row['created_at'],plain(row.get('content')),row['url'],media=len(row.get('media') or []))

# Current public feed is used only for newly derived IDs/timestamps/permalinks.
# Its post bodies and media are NOT copied because a downstream license was not verified.
feed='https://ix.cnn.io/data/truth-social/truth_archive.json'
if (RAW/'cnn-metadata-only.json').exists() and '--refresh-metadata' not in sys.argv:
    latest=json.loads((RAW/'cnn-metadata-only.json').read_text(encoding='utf-8'))
else:
    with urlopen(Request(feed,headers={'User-Agent':'TrumpSays-metadata-index/1.0'}),timeout=60) as response:
        latest=json.load(response)
latest_meta=[]
for row in latest:
    meta={key:row[key] for key in ['id','created_at','url']}
    meta['has_text']=row.get('has_text',bool(plain(row.get('content'))))
    meta['media_count']=row.get('media_count',len(row.get('media') or []))
    latest_meta.append(meta)
    add('cnn-metadata','truth',meta['id'],meta['created_at'],'',meta['url'],media=meta['media_count'])
    records['truth:'+str(meta['id'])]['source_has_text']=meta['has_text']
(RAW/'cnn-metadata-only.json').write_text(json.dumps(latest_meta,ensure_ascii=False),encoding='utf-8')
source_defs['cnn-metadata']={'id':'cnn-metadata','url':feed,'creator':'CNN / Matt Stiles archive continuation','license':'Factual metadata only; no post text or media redistributed','fields':['id','created_at','url','has_text','media_count']}

rows=sorted(records.values(),key=lambda r:(r['published_at'],int(r['post_id'])),reverse=True)
months=defaultdict(list)
for row in rows:months[row['published_at'][:7]].append(row)
for row in rows:row['content_status']='text' if row['text'] else 'media_only' if row['media_count'] and not row.get('source_has_text') else 'text_unavailable'
chunks=[]
for month,items in sorted(months.items(),reverse=True):
    content=json.dumps(items,ensure_ascii=False,separators=(',',':')).encode()
    filename=month+'.json';(DATA/filename).write_bytes(content)
    chunks.append({'month':month,'file':'data/'+filename,'count':len(items),'text_count':sum(bool(r['text']) for r in items),'sha256':hashlib.sha256(content).hexdigest()})
platforms={}
for p in ['x','truth']:
    subset=[r for r in rows if r['platform']==p]
    textrows=[r for r in subset if r['text']]
    platforms[p]={'count':len(subset),'text_count':len(textrows),'first':min(r['published_at'] for r in subset),'last':max(r['published_at'] for r in subset),'last_text':max(r['published_at'] for r in textrows)}
manifest={'schema_version':1,'captured_at':NOW.isoformat(),'coverage_status':'partial','total_records':len(rows),'text_records':sum(bool(r['text']) for r in rows),'metadata_only':sum(not r['text'] for r in rows),'timestamp_corrections':sum('provided_at' in r for r in rows),'content_counts':dict(Counter(r['content_status'] for r in rows)),'platforms':platforms,'chunks':chunks,'kind_counts':dict(Counter(r['kind'] for r in rows)),'source_counts':dict(raw_counts),'sources':list(source_defs.values()),'limitations':['Not a complete archive of every SNS account, deleted post, media, or revision.','Facebook and Instagram have not been collected.','X coverage ends at the last source timestamp, not today.','Recent Truth Social items without a cleared text source contain timestamps/permalinks only.','Repost/quote/original labels and deletion flags are source-provided; unknown values remain unknown.','Images, videos, third-party transcripts and thumbnails are not redistributed.'],'transformations':['IDs kept as decimal strings; deduplicated by platform and post ID.','Timezone-aware source timestamps normalized to UTC; raw source snapshots and hashes retained.','Source times differing from the encoded post creation timestamp by more than two seconds are corrected and explicitly marked; original source time retained.','HTML converted to plain text; longest available text variant retained and differences logged.','CNN feed used for factual metadata only.']}
(DATA/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(DATA/'recent.json').write_text(json.dumps([r for r in rows if r['text']][:50],ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(EVIDENCE/'normalization-audit.json').write_text(json.dumps({'encoding_repairs':dict(encoding_repairs),'raw_counts':dict(raw_counts),'unique':len(rows),'rejected':rejects,'conflicts':conflicts,'manifest':{k:v for k,v in manifest.items() if k not in ['chunks','sources']}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'records':len(rows),'text_records':manifest['text_records'],'metadata_only':manifest['metadata_only'],'chunks':len(chunks),'platforms':platforms,'rejected':len(rejects),'conflicts':dict(Counter(c['type'] for c in conflicts))},ensure_ascii=False,indent=2))
