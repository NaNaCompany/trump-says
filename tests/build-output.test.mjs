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


test('emoji-only post statically displays the posting account, exact content and date before the embed',()=>{
 const html=fs.readFileSync(new URL('../docs/posts/truth-114060894274400497.html',import.meta.url),'utf8');
 const article=html.match(/<article data-post-id="truth:114060894274400497">([\s\S]*?)<\/article>/)[1];
 const visible=article.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 assert.ok(visible.includes('Posting account: <b>Donald J. Trump</b> · @realDonaldTrump'));
 assert.ok(visible.includes('Posted: <time datetime="2025-02-24T21:05:26.014Z">2025-02-24 16:05:26 GMT-5</time>'));
 assert.ok(visible.includes('<h2>Post content</h2><blockquote class="post-text" dir="auto">🇺🇸🇫🇷</blockquote>'));
 assert.ok(visible.indexOf('Posting account:')<visible.indexOf('id="post-embed"'));
 assert.ok(visible.indexOf('🇺🇸🇫🇷')<visible.indexOf('id="post-embed"'));
 assert.ok(!visible.includes('Text unavailable'));
 assert.ok(!visible.includes('Macron'),'do not substitute an image caption for authored text');
});
