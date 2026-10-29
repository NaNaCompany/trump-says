import {safeOriginal} from './core.js?v=20261029-text-first';

const data=document.querySelector('#post-detail-config');
const slot=document.querySelector('#post-embed');
const button=document.querySelector('#load-post-embed');
const production=['nanalab.kr','www.nanalab.kr','nanacompany.github.io'].includes(location.hostname.toLowerCase());
let input,url,platform,postId,loading=false,scriptPromise=null,attempt=0;
try{
 input=JSON.parse(data?.textContent||'null');
 url=new URL(input.original_url);
 platform=['x.com','twitter.com'].includes(url.hostname)?'x':url.hostname==='truthsocial.com'?'truth':null;
 if(!platform||!safeOriginal(url.href,platform))throw new Error('Untrusted original');
 postId=url.pathname.match(/\/(\d+)\/?$/)?.[1];if(!postId)throw new Error('Missing post ID');
}catch{input=null;}

function note(message){
 slot.replaceChildren();const p=document.createElement('p');p.className='embed-fallback';p.textContent=message+' ';
 if(input&&url){const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open original ↗';p.append(a);}
 slot.append(p);
}
function withTimeout(promise,milliseconds,message){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]).finally(()=>clearTimeout(timer));
}
async function loadX(){
 if(window.twttr?.widgets?.createTweet)return window.twttr;
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  let settled=false;const script=document.createElement('script');
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){scriptPromise=null;script.remove();reject(error);}else resolve(window.twttr);};
  const ready=()=>{if(window.twttr?.widgets?.createTweet)finish();};
  window.twttr=window.twttr||{_e:[],ready(callback){this._e.push(callback);}};
  const timer=setTimeout(()=>finish(new Error('X embed timed out')),15000);
  script.src='https://platform.twitter.com/widgets.js';script.async=true;
  script.onload=()=>{ready();if(!settled&&window.twttr?.ready)window.twttr.ready(ready);};
  script.onerror=()=>finish(new Error('X embed unavailable'));document.head.append(script);
 });
 return scriptPromise;
}
async function load(){
 if(!slot||!input||loading)return;
 if(!production){note('Original embeds are disabled in local preview.');return;}
 loading=true;if(button)button.disabled=true;const serial=++attempt;note('Loading the official original post…');
 try{
  if(platform==='x'){
   const sdk=await loadX();if(serial!==attempt)return;slot.replaceChildren();
   const widget=await withTimeout(sdk.widgets.createTweet(postId,slot,{conversation:'none',dnt:true,align:'center'}),20000,'X post timed out');
   if(!widget)throw new Error('X post unavailable');
  }else{
   const frame=document.createElement('iframe');frame.title='Original Truth Social post';frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
   const account=url.pathname.match(/^\/@([^/]+)\//)[1];frame.src='https://truthsocial.com/@'+account+'/'+postId+'/embed';
   frame.style.cssText='width:100%;max-width:550px;min-height:560px;border:0;display:block;margin:auto';
   let timer=setTimeout(()=>{if(serial===attempt)note('The official embed is taking longer than expected.');},25000);
   frame.onload=()=>clearTimeout(timer);frame.onerror=()=>{clearTimeout(timer);if(serial===attempt)note('Could not load the official embed.');};
   slot.replaceChildren(frame);
  }
 }catch{if(serial===attempt)note('Could not display the official embed.');}
 finally{loading=false;if(button)button.disabled=false;}
}
if(slot){if(!input)note('The original post URL could not be verified.');else{button?.addEventListener('click',load);load();}}
