import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {safeOriginal} from '../src/core.js';

const code=fs.readFileSync(new URL('../src/post-detail.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
class Node {
 constructor(tag){this.tagName=tag;this.children=[];this.events={};this.style={};this.textContent='';this.disabled=false;}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.textContent='';this.append(...nodes);}
 addEventListener(name,fn){this.events[name]=fn;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
function setup(original='https://truthsocial.com/@realDonaldTrump/posts/123',host='nanalab.kr',sdk){
 const data=new Node('script');data.textContent=JSON.stringify({original_url:original});const slot=new Node('div'),button=new Node('button'),head=new Node('head'),timers=new Map();let serial=0;
 const document={querySelector:id=>({'#post-detail-config':data,'#post-embed':slot,'#load-post-embed':button}[id]||null),createElement:tag=>new Node(tag),head};
 const window={...(sdk?{twttr:sdk}:{})};
 vm.runInNewContext(code,{document,window,location:{hostname:host},safeOriginal,URL,Promise,setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 return {slot,button,head,window,timers};
}
async function flush(){for(let i=0;i<20;i++)await Promise.resolve();}
test('local and unapproved test hosts never load original scripts or iframes',async()=>{
 for(const host of ['localhost','127.0.0.1','preview.example']){const env=setup(undefined,host);await flush();assert.equal(env.head.children.length,0);assert.ok(env.slot.children[0].textContent.includes('disabled in local preview'));assert.equal(env.slot.children[0].children[0].href,'https://truthsocial.com/@realDonaldTrump/posts/123');}
});
test('unsafe hosts, accounts, credentials and protocols cannot initialize a detail embed',async()=>{
 for(const original of ['https://truthsocial.com/@another/123','https://name:password@truthsocial.com/@realDonaldTrump/123','http://x.com/realDonaldTrump/status/123','https://x.com/another/status/123','https://example.org/@realDonaldTrump/123']){const env=setup(original);await flush();assert.equal(env.head.children.length,0);assert.equal(env.slot.children[0].children.length,0);assert.ok(env.slot.children[0].textContent.includes('could not be verified'));}
});
test('Truth Social details use the official normalized iframe and retain failure retry',async()=>{
 const env=setup();await flush();let frame=env.slot.children[0];assert.equal(frame.tagName,'iframe');assert.equal(frame.src,'https://truthsocial.com/@realDonaldTrump/123/embed');assert.equal(frame.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(env.button.disabled,false);
 frame.onerror();assert.ok(env.slot.children[0].textContent.includes('Could not load'));assert.equal(env.slot.children[0].children[0].href,'https://truthsocial.com/@realDonaldTrump/posts/123');
 env.button.events.click();await flush();frame=env.slot.children[0];assert.equal(frame.tagName,'iframe');frame.onload();assert.equal(env.timers.size,0);
});
test('X details use decimal string IDs with dnt and recover a missing official post',async()=>{
 const calls=[];let available=false;const sdk={widgets:{createTweet:(id,slot,options)=>{calls.push({id,options});return Promise.resolve(available?{}:null);}}};
 const env=setup('https://x.com/realDonaldTrump/status/1900000000000000123','nanalab.kr',sdk);await flush();assert.equal(calls[0].id,'1900000000000000123');assert.equal(calls[0].options.dnt,true);assert.ok(env.slot.children[0].textContent.includes('Could not display'));
 available=true;env.button.events.click();await flush();assert.equal(calls.length,2);assert.equal(env.head.children.length,0);assert.equal(env.button.disabled,false);assert.equal(env.timers.size,0);
});
test('a failed official X SDK request clears the failed script and permits another request',async()=>{
 const env=setup('https://x.com/realDonaldTrump/status/123');await flush();assert.equal(env.head.children[0].src,'https://platform.twitter.com/widgets.js');env.head.children[0].onerror();await flush();assert.equal(env.head.children.length,0);assert.equal(env.button.disabled,false);env.button.events.click();await flush();assert.equal(env.head.children.length,1);env.head.children[0].onerror();await flush();assert.equal(env.timers.size,0);
});
