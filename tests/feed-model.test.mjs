import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleFeedRows,mergeLikes,topLiked,makeFeedCard,archiveMenu,archiveMonths,enhanceEmptyDetail} from '../scripts/feed-model.mjs';

const row={id:'x:123',post_id:'123',platform:'x',original_url:'https://x.com/realDonaldTrump/status/123',published_at:'2024-01-01T23:30:00.000Z',kind:'original',text:'Legacy text does not automatically become cleared new feed text.'};
const app={origin:'https://nanalab.kr/trump-says'};
const likes={captured_at:'2026-10-28T08:52:18Z',capture_time_basis:'source collection time',sources:{s:{id:'s',url:'https://example.org/source'}},counts:{'x:123':{count:42,source_id:'s'}}};

test('new feed excludes explicitly classified reposts and unsafe originals while preserving uncertain rows',()=>{
 const rows=[row,{...row,id:'x:124',kind:'repost'},{...row,id:'x:125',kind:'retweet'},{...row,id:'x:126',kind:'unknown'},{...row,id:'x:127',original_url:'https://x.com/another/status/123'}];
 assert.deepEqual(eligibleFeedRows(rows).map(r=>r.id),['x:123','x:126']);
});

test('like snapshots retain exact zero and unknown remains null; no new body is published',()=>{
 const known=mergeLikes(row,likes,app);assert.equal(known.like_count,42);assert.equal(known.text,null);assert.equal(known.permalink,app.origin+'/posts/x-123.html');
 const missing=mergeLikes({...row,id:'x:99'},likes,app);assert.equal(missing.like_count,null);assert.equal(missing.likes_source,null);
 const zero=mergeLikes(row,{...likes,counts:{'x:123':{count:0,source_id:'s'}}},app);assert.equal(zero.like_count,0);
});

test('top list uses known counts descending, newest timestamp for ties, at most 100',()=>{
 const rows=Array.from({length:140},(_,i)=>({...row,id:'x:'+i,published_at:'2024-01-'+String(1+i%28).padStart(2,'0')+'T00:00:00Z',like_count:i}));
 rows.push({...row,id:'unknown',like_count:null},{...row,id:'invalid',like_count:-1});
 const selected=topLiked(rows);assert.equal(selected.length,100);assert.equal(selected[0].like_count,139);assert.equal(selected.at(-1).like_count,40);
 const tied=topLiked([{...row,id:'older',like_count:5,published_at:'2023-01-01T00:00:00Z'},{...row,id:'newer',like_count:5,published_at:'2024-01-01T00:00:00Z'}]);assert.equal(tied[0].id,'newer');
});

test('record data escapes script delimiters and preserves a verified detail link',()=>{
 const normalized=mergeLikes(row,likes,app);const html=makeFeedCard({...normalized,post_kind:'</script><img src=x onerror=alert(1)>'});
 assert.equal((html.match(/<script /g)||[]).length,1);assert.ok(!html.includes('</script><img'));assert.ok(html.includes('/posts/x-123.html'));assert.ok(html.includes('18:30:00 GMT-5'));
});

test('shared archive menu avoids replicating month links on every detail page',()=>{
 const groups=new Map([['2026-10',[row]],['2025-12',[row,row]]]);
 assert.ok(!archiveMenu(groups).includes('/archive/2026-10.html'));
 const inline=archiveMenu(groups,{inline:true});assert.ok(inline.includes('/trump-says/archive/2026-10.html'));
 assert.ok(archiveMonths(groups).startsWith('<section class="year-group">'));
});

test('metadata-only eligible details gain an official-embed slot without replacing archived text',()=>{
 const empty={...row,text:''};const html='<article data-post-id="x:123"><p class="unavailable">Text unavailable.</p></article>';
 const next=enhanceEmptyDetail(html,empty,likes,app);assert.ok(next.includes('data-feed-id="x:123"'));assert.ok(next.includes('data-feed-embed'));assert.equal(enhanceEmptyDetail(next,empty,likes,app),next);
 assert.equal(enhanceEmptyDetail(html,row,likes,app),html);
 assert.equal(enhanceEmptyDetail(html,{...empty,kind:'repost'},likes,app),html);
});
