import test from 'node:test';
import assert from 'node:assert/strict';
import {timeParts,tokens,searchRecords,safeOriginal} from '../src/core.js';
test('DST fallback keeps repeated local hours distinct',()=>{
  const a=timeParts('2022-11-06T05:30:00Z','America/New_York'),b=timeParts('2022-11-06T06:30:00Z','America/New_York');
  assert.equal(a.time,b.time);assert.equal(a.offset,'GMT-4');assert.equal(b.offset,'GMT-5');
});
test('Korea date filtering uses the selected zone and includes boundary dates',()=>{
  const rows=[{id:'x:1',platform:'x',kind:'original',text:'alpha beta',published_at:'2024-01-01T23:30:00Z'}];
  assert.equal(timeParts(rows[0].published_at,'Asia/Seoul').date,'2024-01-02');
  assert.equal(searchRecords(rows,{zone:'Asia/Seoul',start:'2024-01-02',end:'2024-01-02'}).length,1);
  assert.equal(searchRecords(rows,{zone:'UTC',start:'2024-01-02'}).length,0);
  assert.throws(()=>searchRecords(rows,{start:'2024-02-01',end:'2024-01-01'}));
});
test('phrase, case, AND, platform, repost and body filters combine',()=>{
  const rows=[{id:'x:1',platform:'x',kind:'original',text:'Alpha beta WORLD',published_at:'2024-01-02T00:00:00Z'},{id:'truth:2',platform:'truth',kind:'repost',text:'alpha world beta',published_at:'2024-01-01T00:00:00Z'},{id:'truth:3',platform:'truth',kind:'unknown',text:'',published_at:'2023-01-01T00:00:00Z'}];
  assert.deepEqual(tokens('"alpha beta" WORLD'),['alpha beta','world']);
  assert.equal(searchRecords(rows,{query:'"ALPHA beta" world'}).length,1);
  assert.equal(searchRecords(rows,{query:'alpha beta',kind:'repost',platform:'truth'}).length,1);
  assert.equal(searchRecords(rows,{textOnly:true}).length,2);
  assert.equal(searchRecords(rows,{post:'truth:3'})[0].id,'truth:3');
  assert.equal(searchRecords(rows,{order:'oldest'})[0].id,'truth:3');
});
test('source links cannot execute scripts or point to an unrelated account',()=>{
  assert.ok(safeOriginal('https://x.com/realDonaldTrump/status/123','x'));
  assert.equal(safeOriginal('https://truthsocial.com/@realDonaldTrump/posts/123','truth'),'https://truthsocial.com/@realDonaldTrump/posts/123');
  assert.equal(safeOriginal('https://truthsocial.com/@realDonaldTrump/123','truth'),'https://truthsocial.com/@realDonaldTrump/123');
  assert.equal(safeOriginal('https://truthsocial.com/@another/posts/123','truth'),null);
  for(const url of ['javascript:alert(1)','https://example.com/realDonaldTrump/123','https://x.com/another/status/123'])assert.equal(safeOriginal(url,'x'),null);
});
