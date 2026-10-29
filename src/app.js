import {timeParts,safeOriginal,KIND} from './core.js?v=20261029-text-first';
const $=id=>document.getElementById(id);
const number=new Intl.NumberFormat('en-US');
let manifest=null,worker=null,page=1,lastToken=0,currentRows=[],ready=false,searchStarted=false,recentRows=[];
let post=new URLSearchParams(location.search).get('post')||'';
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function filters(){return {query:$('query').value,platform:$('platform').value,kind:$('kind').value,start:$('start').value,end:$('end').value,zone:$('zone').value,order:$('order').value,textOnly:$('textOnly').checked,post};}
function showError(message){$('error').hidden=!message;$('error').textContent=message||'';}
function render(rows){
  currentRows=rows;$('records').replaceChildren();let previousDay='';
  const zone=$('zone').value;
  for(const row of rows){
    const parts=timeParts(row.published_at,zone);
    if(parts.date!==previousDay){const day=element('h3','day',parts.date);$('records').append(day);previousDay=parts.date;}
    const article=element('article','record');article.dataset.id=row.id;
    const clock=element('div','clock');const time=element('time','',parts.time);time.dateTime=row.published_at;clock.append(time,element('span','',parts.offset));
    const main=element('div','record-main'),meta=element('div','meta');
    meta.append(element('span','platform '+row.platform,row.platform==='x'?'X / TWITTER':'TRUTH SOCIAL'),element('span','kind',KIND[row.kind]||KIND.unknown));
    if(row.source_deleted_flag===true)meta.append(element('span','deleted','Marked deleted in source'));
    if(row.timestamp_basis)meta.append(element('span','corrected','Time corrected'));
    main.append(meta);
    const textLink=element('a','feed-text-link');textLink.href='posts/'+row.id.replace(':','-')+'.html';
    const points=typeof row.text==='string'?Array.from(row.text):[],truncated=points.length>800||row.text_truncated===true;
    const label=row.content_status==='media_only'?'Media post. Text was not available in the collected source.':'Text was not available in the collected source.';
    textLink.append(element('p',row.text?'feed-text':'feed-text feed-text-unavailable',points.length>800?points.slice(0,799).join('')+'…':row.text||label));
    if(truncated)textLink.append(element('span','feed-read-more','Read full post →'));
    main.append(textLink);
    const textStatus=row.text_override_status||row.text_status||(row.text?'available':'unavailable');
    let textNote=!row.text?'Source text unavailable.':textStatus.includes('description')?'Official original-page description; not a full post transcript.':textStatus.includes('partial')||textStatus.includes('truncated')?'Partial source text; the original may contain more.':'Captured source text.';
    if(row.text&&truncated)textNote+=' Preview shortened to 800 characters. Open the post for the complete captured text.';
    const sourceNote=element('p','feed-text-note',textNote);sourceNote.dataset.textStatus=textStatus;main.append(sourceNote);
    const actions=element('div','actions');if(!row.text){const detail=element('a','original','View record →');detail.href='posts/'+row.id.replace(':','-')+'.html';actions.append(detail);}const url=safeOriginal(row.original_url,row.platform);
    if(url){const a=element('a','original','Original post ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}
    const share=element('button','share','Copy post link');share.type='button';
    share.addEventListener('click',async()=>{try{const link=new URL('posts/'+row.id.replace(':','-')+'.html',location.href);link.search='';link.hash='';await navigator.clipboard.writeText(link.href);share.textContent='Link copied';}catch{share.textContent='Copy the post link from the address bar.';const link=new URL('posts/'+row.id.replace(':','-')+'.html',location.href);history.replaceState(null,'',link.href);}});
    actions.append(share);main.append(actions);
    const details=element('details','provenance'),summary=element('summary','','Timestamp & sources');details.append(summary);
    details.append(element('p','',`UTC: ${row.published_at}`));
    if(row.provided_at)details.append(element('p','',`Source timestamp: ${row.provided_at} / Corrected against the creation time encoded in the post ID.`));
    details.append(element('p','',`Post ID: ${row.post_id}`));
    if(row.source_deleted_flag===true)details.append(element('p','','The deletion flag comes from the source dataset. The live post has not been checked.'));
    const list=element('ul','');for(const id of row.source_ids){const source=manifest.sources.find(s=>s.id===id);if(!source)continue;const li=element('li',''),a=element('a','',source.creator+' · '+id+(row.text_source===id?' · text source':''));a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);}details.append(list);main.append(details);
    article.append(clock,main);$('records').append(article);
  }
  $('empty').hidden=rows.length!==0;
  $('shownZone').textContent={'Asia/Seoul':'Korea · KST','America/New_York':'US Eastern · EST/EDT',UTC:'UTC'}[zone];
}
function runSearch(nextPage=1){
  if(!worker)return;searchStarted=true;page=nextPage;showError('');
  const f=filters();if(f.start&&f.end&&f.start>f.end){showError('The start date must not be after the end date.');return;}
  const token=++lastToken;worker.postMessage({type:'search',token,page,filter:f});
  $('resultCount').textContent=ready?'Searching posts…':'Loading the archive…';$('prev').disabled=$('next').disabled=true;
  if(post){const link=new URL(location.href);link.search='';link.searchParams.set('post',post);history.replaceState(null,'',link.href);}
}
$('filters').addEventListener('submit',e=>{e.preventDefault();post='';const url=new URL(location.href);url.search='';history.replaceState(null,'',url.href);runSearch();});
for(const id of ['platform','kind','start','end','order','textOnly'])$(id).addEventListener('change',()=>{post='';const url=new URL(location.href);url.search='';history.replaceState(null,'',url.href);runSearch();});
$('zone').addEventListener('change',()=>{if(searchStarted)runSearch(page);else render(currentRows);});
$('reset').addEventListener('click',()=>{HTMLFormElement.prototype.reset.call($('filters'));post='';const url=new URL(location.href);url.search='';history.replaceState(null,'',url.href);runSearch();});
$('prev').addEventListener('click',()=>{if(page>1){runSearch(page-1);$('archive').scrollIntoView({behavior:'smooth',block:'start'});}});
$('next').addEventListener('click',()=>{runSearch(page+1);$('archive').scrollIntoView({behavior:'smooth',block:'start'});});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('query').focus();}});
try{
  const response=await fetch('./data/summary.json');if(!response.ok)throw new Error('Could not load coverage details.');manifest=await response.json();
  $('total').textContent=number.format(manifest.total_records);$('textCount').textContent=number.format(manifest.text_records);$('metadataCount').textContent=number.format(manifest.metadata_only);
  $('asof').textContent=`Snapshot ${manifest.captured_at.slice(0,10)} UTC · Partial coverage`;
  $('coverageText').textContent=`X / Twitter: ${number.format(manifest.platforms.x.count)} posts · Truth Social: ${number.format(manifest.platforms.truth.count)} posts. Facebook and Instagram not collected. Latest Truth Social text: ${manifest.platforms.truth.last_text.slice(0,10)}; latest metadata: ${manifest.platforms.truth.last.slice(0,10)} (UTC).`;
  const recent=await(await fetch('./data/recent.json?v=20261029-text-first')).json();recentRows=recent;
  if(!post){render(recent);$('resultCount').textContent='Latest '+recent.length+' posts with archived text';$('indexStatus').textContent='Full archive loads when you search';$('next').disabled=false;}
  worker=new Worker(new URL('./worker.js?v=20261029-text-first',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.type==='progress'){$('indexStatus').textContent=`Search index ${data.done} / ${data.total}`;return;}
    if(data.type==='ready'){ready=true;$('indexStatus').textContent=`${number.format(manifest.total_records)} posts indexed`;return;}
    if(data.type==='error'){if(!data.token||data.token===lastToken){showError(data.message);$('resultCount').textContent='Search failed.';$('indexStatus').textContent='Index unavailable';}return;}
    if(data.type==='results'&&data.token===lastToken){ready=true;page=data.page;render(data.rows);$('resultCount').textContent=`${number.format(data.total)} posts`;$('indexStatus').textContent=`${number.format(manifest.total_records)} posts indexed`;$('pageLabel').textContent=`${page} / ${Math.max(1,data.pages)}`;$('prev').disabled=page<=1;$('next').disabled=page>=data.pages;}
  };
  worker.onerror=()=>{showError('Could not load search. Reload the page.');$('indexStatus').textContent='Search module error';};
  if(post&&/^(x|truth):[0-9]+$/.test(post))location.replace(new URL('posts/'+post.replace(':','-')+'.html',location.href));
}catch(error){showError(error.message||'Could not load the archive.');$('indexStatus').textContent='Loading failed';}
