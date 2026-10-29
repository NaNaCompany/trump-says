import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {searchRecords} from '../src/core.js';
import {withTextOverride} from '../src/text-source.js';
const code=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
function setup({failOverlay=false}={}){
 const rows=[{id:'truth:123',post_id:'123',platform:'truth',kind:'original',text:'',published_at:'2026-10-28T00:00:00Z'},{id:'truth:122',post_id:'122',platform:'truth',kind:'original',text:'Original unchanged',published_at:'2026-10-27T00:00:00Z'}];
 const overrides={'truth:123':{text:'Official captured specialphrase',status:'captured_official_rendered_text',source_url:'https://truthsocial.com/@realDonaldTrump/123/embed',sha256:'captured-hash'},'truth:122':{text:'Must not replace original',status:'partial'}};
 const messages=[],requests=[],state={failOverlay};
 const context=vm.createContext({searchRecords,withTextOverride,postMessage:data=>messages.push(data),fetch:async path=>{requests.push(path);if(path==='./data/manifest.json')return {ok:true,json:async()=>({chunks:[{file:'data/source.json',count:2}],total_records:2})};if(path==='./data/text-overrides.json?v=20261029-text-first')return {ok:!state.failOverlay,json:async()=>overrides};if(path==='./data/source.json')return {ok:true,json:async()=>rows};throw new Error('Unexpected request');}});
 vm.runInContext(code,context);
 const search=async(query,token=1)=>{await context.onmessage({data:{type:'search',filter:{query},page:1,token}});return messages.at(-1);};
 return {search,state,rows,messages,requests};
}
test('search indexes newly captured overlay text while preserving original source strings and provenance',async()=>{
 const env=setup();const found=await env.search('specialphrase');assert.equal(found.type,'results');assert.equal(found.total,1);assert.equal(found.rows[0].id,'truth:123');assert.equal(found.rows[0].text_override_status,'captured_official_rendered_text');assert.equal(found.rows[0].text_override_sha256,'captured-hash');assert.equal(env.rows[0].text,'');
 const original=await env.search('Original unchanged',2);assert.equal(original.total,1);assert.equal(original.rows[0].text,'Original unchanged');assert.equal((await env.search('Must not replace',3)).total,0);assert.equal(env.requests.length,3);
});
test('an unavailable overlay reports a search error and a retry rebuilds the complete index',async()=>{
 const env=setup({failOverlay:true});const failed=await env.search('specialphrase');assert.equal(failed.type,'error');assert.ok(failed.message.includes('Captured source text could not load'));env.state.failOverlay=false;const retried=await env.search('specialphrase',2);assert.equal(retried.type,'results');assert.equal(retried.total,1);
});
