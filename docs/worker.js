import {searchRecords} from './core.js?v=20261029-text-first';
import {withTextOverride} from './text-source.js?v=20261029-text-first';
let all=null,loading=null,latest=0;
async function load(){
  if(all)return all;if(loading)return loading;
  loading=(async()=>{
    const manifest=await(await fetch('./data/manifest.json')).json();
    const overlayResponse=await fetch('./data/text-overrides.json?v=20261029-text-first');
    if(!overlayResponse.ok)throw new Error('Captured source text could not load. Reload the page.');
    const overrides=await overlayResponse.json();
    const results=[],queue=[...manifest.chunks];let done=0;
    async function job(){while(queue.length){const chunk=queue.shift(),response=await fetch('./'+chunk.file);if(!response.ok)throw new Error('Some posts could not load. Reload the page.');const rows=await response.json();if(rows.length!==chunk.count)throw new Error('Archive chunk count mismatch.');results.push(...rows);done++;postMessage({type:'progress',done,total:manifest.chunks.length});}}
    await Promise.all(Array.from({length:6},job));
    if(results.length!==manifest.total_records)throw new Error('Archive total count mismatch.');
    results.sort((a,b)=>b.published_at.localeCompare(a.published_at)||(BigInt(b.post_id)>BigInt(a.post_id)?1:-1));
    all=results.map(row=>withTextOverride(row,overrides));return all;
  })().catch(error=>{loading=null;throw error;});
  return loading;
}
onmessage=async({data})=>{
  if(data.type==='warm'){try{await load();postMessage({type:'ready'});}catch(error){postMessage({type:'error',message:error.message});}return;}
  if(data.type!=='search')return;
  const token=data.token;latest=token;
  try{
    const rows=await load();if(token!==latest)return;
    const results=searchRecords(rows,data.filter),page=Math.max(1,Math.min(Number(data.page)||1,Math.max(1,Math.ceil(results.length/40))));
    postMessage({type:'results',token,total:results.length,page,pages:Math.ceil(results.length/40),rows:results.slice((page-1)*40,page*40)});
  }catch(error){postMessage({type:'error',token,message:error.message});}
};
