import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleFeedRows,mergeLikes,topLiked,makeFeedCard,archiveMenu,archiveMonths,enhanceEmptyDetail,textPreview,withTextOverride} from '../scripts/feed-model.mjs';

const row={id:'x:123',post_id:'123',platform:'x',original_url:'https://x.com/realDonaldTrump/status/123',published_at:'2024-01-01T23:30:00.000Z',kind:'original',text:'Original captured post text.',source_ids:['s'],text_source:'s',content_status:'text'};
const app={origin:'https://nanalab.kr/trump-says'};
const likes={captured_at:'2026-10-28T08:52:18Z',capture_time_basis:'source collection time',sources:{s:{id:'s',url:'https://example.org/source'}},counts:{'x:123':{count:42,source_id:'s'}}};

test('new feed excludes explicitly classified reposts and unsafe originals while preserving uncertain rows',()=>{
 const rows=[row,{...row,id:'x:124',kind:'repost'},{...row,id:'x:125',kind:'retweet'},{...row,id:'x:126',kind:'unknown'},{...row,id:'x:127',original_url:'https://x.com/another/status/123'}];
 assert.deepEqual(eligibleFeedRows(rows).map(r=>r.id),['x:123','x:126']);
});

test('like snapshots retain exact zero and unknown remains null alongside original source text metadata',()=>{
 const known=mergeLikes(row,likes,app);assert.equal(known.like_count,42);assert.equal(known.text,row.text);assert.equal(known.permalink,app.origin+'/posts/x-123.html');
 assert.deepEqual(known.text_source,{provider:'s'});assert.deepEqual(known.source_ids,['s']);assert.equal(known.text_status,'available');assert.equal(known.content_status,'text');
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
 assert.ok(html.includes('class="feed-text-link"'));assert.ok(!html.includes('feed-embed'));assert.ok(!html.includes('<button'));assert.ok(!html.includes('<iframe'));
 const data=JSON.parse(html.match(/class="feed-record-data">(.*?)<\/script>/s)[1]);assert.equal(data.post_kind,'</script><img src=x onerror=alert(1)>');
});

test('shared archive menu avoids replicating month links on every detail page',()=>{
 const groups=new Map([['2026-10',[row]],['2025-12',[row,row]]]);
 assert.ok(!archiveMenu(groups).includes('/archive/2026-10.html'));
 const inline=archiveMenu(groups,{inline:true});assert.ok(inline.includes('/trump-says/archive/2026-10.html'));
 assert.ok(archiveMonths(groups).startsWith('<section class="year-group">'));
});

test('all historical details retain full text and gain an independent official embed slot, including historical reposts',()=>{
 const html='<article data-post-id="x:123"><blockquote class="post-text">Original captured post text.</blockquote></article>';
 for(const item of [row,{...row,text:''},{...row,kind:'repost'}]){
  const next=enhanceEmptyDetail(html,item,likes,app);assert.ok(next.includes('id="post-detail-config"'));assert.ok(next.includes('id="post-embed"'));assert.ok(next.includes('Original captured post text.</blockquote>'));assert.equal(enhanceEmptyDetail(next,item,likes,app),next);
  assert.ok(!next.includes('feed-record-data'));assert.ok(!next.includes('data-feed-id'));
  const data=JSON.parse(next.match(/id="post-detail-config">(.*?)<\/script>/s)[1]);assert.deepEqual(data,{original_url:row.original_url});
 }
});

test('preview bounds count Unicode code points and include the ellipsis within the 800 limit',()=>{
 const original='😀'.repeat(801);const preview=textPreview(original);
 assert.equal(Array.from(preview.text).length,800);assert.equal(preview.text,'😀'.repeat(799)+'…');assert.equal(preview.text_truncated,true);
 assert.deepEqual(textPreview('가'.repeat(800)),{text:'가'.repeat(800),text_truncated:false});assert.deepEqual(textPreview(''),{text:null,text_truncated:false});
});

test('SSR preserves source whitespace as character references without introducing diff whitespace errors',()=>{
 const record=mergeLikes({...row,text:'Original line \nNext line'},likes,app),html=makeFeedCard(record);
 assert.ok(html.includes('Original line&#32;\nNext line'));
 assert.equal(JSON.parse(html.match(/class="feed-record-data">(.*?)<\/script>/s)[1]).text,'Original line \nNext line');
});

test('separate captured source overlay fills missing text without mutating source records or replacing existing text',()=>{
 const missing={...row,text:'',text_source:null},overlay={'x:123':{text:'Captured source string',status:'partial',source_url:row.original_url,sha256:'abc'}};
 const filled=withTextOverride(missing,overlay);assert.equal(missing.text,'');assert.equal(filled.text,'Captured source string');assert.equal(filled.text_override_status,'partial');
 const normalized=mergeLikes(filled,likes,app);assert.equal(normalized.text_status,'partial');assert.equal(normalized.text_source,row.original_url);assert.equal(normalized.text_capture_sha256,'abc');
 assert.equal(withTextOverride(row,overlay).text,row.text);assert.equal(withTextOverride(missing,{'x:123':{text:null}}).text,'');
 const media=mergeLikes(withTextOverride(missing,{'x:123':{text:'',status:'captured_official_media_without_text',source_url:row.original_url}}),likes,app);assert.equal(media.text,null);assert.equal(media.text_status,'captured_official_media_without_text');assert.equal(media.text_source,row.original_url);
});
