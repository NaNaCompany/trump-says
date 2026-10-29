import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('search remains the operational search interface after the home feed replaces the index',()=>{
 const search=fs.readFileSync(new URL('../docs/search.html',import.meta.url),'utf8'),home=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 assert.equal((search.match(/rel="canonical"/g)||[]).length,1);
 assert.ok(search.includes('href="https://nanalab.kr/trump-says/search.html"'));
 assert.ok(search.includes('app.js?v=20261029-text-first'));assert.ok(search.includes('id="filters"'));assert.ok(search.includes('id="query"'));assert.ok(search.includes('id="records"'));
 assert.ok(!search.includes('id="popular-records"'));assert.ok(!home.includes('app.js?'));
 assert.equal((search.match(/id="feed-config"/g)||[]).length,1);assert.equal((home.match(/id="feed-config"/g)||[]).length,1);
});
