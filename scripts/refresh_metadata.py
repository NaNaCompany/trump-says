"""Capture/import factual Truth Social metadata without saving source bodies/media URLs.

Capture: python scripts/refresh_metadata.py capture evidence/refresh-YYYYMMDD-metadata.json
Import:  python scripts/refresh_metadata.py apply evidence/refresh-YYYYMMDD-metadata.json YYYYMMDD
Then run the documented build and full validation commands. Import is additive/idempotent;
existing records, monthly chunks, text overlays and like snapshots are never rewritten.
"""
import argparse
from collections import Counter, defaultdict
import datetime as dt
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://ix.cnn.io/data/truth-social/truth_archive.json'


class BodyText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def validate(meta):
    identity = str(meta['id'])
    assert re.fullmatch(r'\d+', identity), 'Invalid ID'
    assert re.fullmatch(r'https://truthsocial\.com/@realDonaldTrump/(?:posts/)?' + identity,
                        meta['url'], re.I), 'Account/permalink mismatch'
    stamp = dt.datetime.fromisoformat(meta['created_at'].replace('Z', '+00:00'))
    assert stamp.tzinfo is not None, 'Timezone required'
    encoded = dt.datetime.fromtimestamp((int(identity) >> 16) / 1000, dt.timezone.utc)
    assert abs((stamp - encoded).total_seconds()) <= 2, 'Timestamp discrepancy requires review'
    assert stamp <= dt.datetime.now(dt.timezone.utc), 'Future timestamp'
    assert type(meta['has_text']) is bool
    assert type(meta['media_count']) is int and meta['media_count'] >= 0
    return identity


def capture(destination):
    # The response exists only in memory. Never persist post content or media URLs.
    with urlopen(SOURCE, timeout=60) as response:
        raw = response.read()
    rows = json.loads(raw)
    metadata = []
    for row in rows:
        parser = BodyText()
        parser.feed(row.get('content') or '')
        meta = dict(id=str(row['id']), created_at=row['created_at'], url=row['url'],
                    has_text=bool(''.join(parser.parts).strip()),
                    media_count=len(row.get('media') or []))
        validate(meta)
        metadata.append(meta)
    destination.write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(dict(source_url=SOURCE, source_rows=len(rows), source_bytes=len(raw),
                          source_sha256=hashlib.sha256(raw).hexdigest())))


def apply(source, batch):
    assert re.fullmatch(r'\d{8}', batch), 'Batch must be YYYYMMDD'
    dt.datetime.strptime(batch, '%Y%m%d')
    data = ROOT / 'src/data'
    manifest_path = data / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    existing = []
    for chunk in manifest['chunks']:
        raw = (ROOT / 'src' / chunk['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == chunk['sha256'], 'Source chunk hash mismatch'
        existing.extend(json.loads(raw))
    ids = {row['id'] for row in existing}
    cutoff = manifest['platforms']['truth']['last']
    added = []
    for meta in json.loads(source.read_text()):
        identity = validate(meta)
        key = 'truth:' + identity
        if key in ids or meta['created_at'] <= cutoff:
            continue
        ids.add(key)
        added.append(dict(id=key, platform='truth', post_id=identity,
                          published_at=meta['created_at'], text='', kind='unknown',
                          source_ids=['cnn-metadata'], original_url=meta['url'],
                          source_deleted_flag=None, media_count=meta['media_count'],
                          text_source=None, source_has_text=meta['has_text'],
                          content_status='media_only' if meta['media_count'] and not meta['has_text'] else 'text_unavailable'))
    if not added:
        print(json.dumps(dict(added_records=0, status='unchanged')))
        return
    added.sort(key=lambda row: (row['published_at'], int(row['post_id'])), reverse=True)
    groups = defaultdict(list)
    for row in added:
        groups[row['published_at'][:7]].append(row)
    # Check all destinations before writing any file.
    for month in groups:
        assert not (data / f'{month}-refresh-{batch}.json').exists(), 'Batch already exists; use a new batch'
    for month, rows in sorted(groups.items(), reverse=True):
        name = f'{month}-refresh-{batch}.json'
        raw = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()
        (data / name).write_bytes(raw)
        manifest['chunks'].append(dict(month=month, file='data/' + name, count=len(rows),
                                       text_count=0, sha256=hashlib.sha256(raw).hexdigest()))
    all_rows = existing + added
    manifest['captured_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
    manifest['total_records'] = len(all_rows)
    manifest['metadata_only'] += len(added)
    manifest['content_counts'] = dict(Counter(row['content_status'] for row in all_rows))
    manifest['kind_counts'] = dict(Counter(row['kind'] for row in all_rows))
    manifest['source_counts']['cnn-metadata'] += len(added)
    manifest['platforms']['truth']['count'] += len(added)
    manifest['platforms']['truth']['last'] = added[0]['published_at']
    manifest['transformations'].append(f'{batch[:4]}-{batch[4:6]}-{batch[6:]} refresh adds factual metadata in separate chunks; existing source chunks, text overlays, classifications and like snapshots remain unchanged.')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(added_records=len(added), total_records=len(all_rows))))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['capture', 'apply'])
    parser.add_argument('metadata', type=Path)
    parser.add_argument('batch', nargs='?')
    args = parser.parse_args()
    if args.command == 'capture':
        capture(args.metadata)
    else:
        if not args.batch:
            parser.error('apply requires YYYYMMDD batch')
        apply(args.metadata, args.batch)
