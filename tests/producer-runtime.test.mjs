import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeLikes,withTextOverride} from '../scripts/feed-model.mjs';
import {runtimeValidator} from '../scripts/runtime-validator.mjs';
test('Trump producer metadata with legacy source identifiers and captured source URLs passes the actual shared runtime',()=>{
 const validate=runtimeValidator(),app={origin:'https://nanalab.kr/trump-says'},likes={counts:{},sources:{}};
 const original={id:'x:123',post_id:'123',platform:'x',original_url:'https://x.com/realDonaldTrump/status/123',published_at:'2026-10-28T00:00:00Z',kind:'original',text:'Original body',text_source:'3dl-kaggle-v1',source_ids:['3dl-kaggle-v1'],content_status:'text'};
 const normalized=mergeLikes(original,likes,app);assert.deepEqual(normalized.text_source,{provider:'3dl-kaggle-v1'});assert.equal(validate(normalized).text,original.text);
 const captured=withTextOverride({...original,text:'',text_source:null},{'x:123':{text:'Captured body',status:'partial',source_url:original.original_url}});assert.equal(validate(mergeLikes(captured,likes,app)).text_source,original.original_url);
 assert.throws(()=>validate({...normalized,text_source:'javascript:alert(1)'}));assert.throws(()=>validate({...normalized,text_source:{url:'https://user:password@example.com'}}));
});
test('actual generated home record data survives the shared runtime validation',()=>{
 const validate=runtimeValidator(),home=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const records=[...home.matchAll(/<script type="application\/json" class="feed-record-data">(.*?)<\/script>/gs)].map(match=>JSON.parse(match[1]));
 assert.equal(records.length,120);for(const record of records)assert.equal(validate(record).id,record.id);
});
