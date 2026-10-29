import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {HOME_PORTRAIT,stripHomeSocialMetadata,withHomeSocialMetadata} from '../scripts/home-social.mjs';
const origin='https://nanalab.kr/trump-says';
test('home share metadata reuses the verified original portrait and deduplicates managed tags',()=>{
 const html='<html><head><meta name="description" content="Original description"><meta property="og:image" content="old"><meta content="duplicate" property="og:image"><meta name="twitter:card" content="summary"></head><body><p>Unchanged body.</p></body></html>';
 const next=withHomeSocialMetadata(html,origin);
 for(const name of ['og:title','og:type','og:url','og:description','og:image','og:image:alt','og:image:width','og:image:height','og:image:type','twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt'])assert.equal((next.match(new RegExp('(?:property|name)="'+name+'"','g'))||[]).length,1,name);
 assert.ok(next.includes('content="https://nanalab.kr/trump-says/assets/donald-trump-portrait.jpg"'));assert.ok(next.includes('name="twitter:card" content="summary_large_image"'));assert.ok(next.includes('property="og:image:width" content="1638"'));assert.ok(next.includes('property="og:image:height" content="2048"'));assert.ok(next.includes('property="og:image:type" content="image/jpeg"'));
 assert.equal(stripHomeSocialMetadata(next),stripHomeSocialMetadata(html));assert.equal(withHomeSocialMetadata(next,origin),next);
});
test('the future build applies social portrait tags only when writing the root home page',()=>{
 const source=fs.readFileSync(new URL('../scripts/build-posts.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("await fs.writeFile(path.join(dist,'index.html'),withHomeSocialMetadata(home,app.origin));"));
 assert.equal((source.match(/withHomeSocialMetadata\(/g)||[]).length,1);
 const credit=JSON.parse(fs.readFileSync(new URL('../src/assets/portrait-credit.json',import.meta.url),'utf8'));
 assert.equal(HOME_PORTRAIT.file,credit.file);
 for(const folder of ['src','docs']){const bytes=fs.readFileSync(new URL('../'+folder+'/'+HOME_PORTRAIT.file,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),credit.sha256);}
});
