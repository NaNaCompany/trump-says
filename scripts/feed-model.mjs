import {timeParts,safeOriginal} from '../src/core.js';

export const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const postUri=row=>row.id.replace(':','-')+'.html';

export function eligibleFeedRows(rows){
 // Keep uncertain source classifications visible as uncertain; exclude explicit native reposts.
 return rows.filter(row=>row.kind!=='repost'&&row.kind!=='retweet'&&safeOriginal(row.original_url,row.platform));
}

export function mergeLikes(row,likes,app){
 const info=likes.counts[row.id];
 const source=info?likes.sources[info.source_id]:null;
 return {
  id:row.id,post_id:row.post_id,platform:row.platform,
  original_url:safeOriginal(row.original_url,row.platform),
  published_at:row.published_at,published_date:row.published_at.slice(0,10),
  permalink:app.origin+'/posts/'+postUri(row),
  like_count:info?.count??null,
  likes_captured_at:info?likes.captured_at:null,
  likes_source:source?{provider:source.id,url:source.url,count_precision:'exact',capture_time_basis:likes.capture_time_basis}:null,
  post_kind:row.kind||'unknown',text:null,
 };
}

export function topLiked(rows,max=100){
 return rows.filter(r=>Number.isSafeInteger(r.like_count)&&r.like_count>=0)
  .sort((a,b)=>b.like_count-a.like_count||b.published_at.localeCompare(a.published_at)||a.id.localeCompare(b.id))
  .slice(0,max);
}

export function makeFeedCard(row){
 if(!row.original_url)throw new Error('Unsafe original URL');
 const clock=timeParts(row.published_at,'America/New_York');
 const serialized=JSON.stringify(row).replaceAll('<','\\u003c');
 const likes=row.like_count===null?'Likes unavailable':row.like_count.toLocaleString('en-US')+' likes';
 return `<li class="feed-record archive-record" data-feed-id="${esc(row.id)}"><div class="feed-meta"><time datetime="${esc(row.published_at)}">${clock.date} · ${clock.time} ${clock.offset}</time><span class="feed-likes">${esc(likes)}</span></div><div class="feed-embed" data-feed-embed><p class="feed-loading">Original post loads as this record enters view.</p></div><div class="feed-actions"><a href="${esc(row.permalink)}">View post</a><a href="${esc(row.original_url)}" target="_blank" rel="noopener noreferrer">Original ↗</a><button type="button" data-feed-action="embed">Load original post</button></div><script type="application/json" class="feed-record-data">${serialized}</script></li>`;
}

export function archiveMenu(groups,{inline=false}={}){
 const years=[...new Set([...groups.keys()].map(m=>m.slice(0,4)))];
 const yearGrid=years.map(year=>`<section class="year-group"><h3>${year}</h3><nav class="year-grid" aria-label="Months in ${year}">`+Array.from({length:12},(_,i)=>{
  const key=year+'-'+String(i+1).padStart(2,'0'),rows=groups.get(key),label=new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2000,i,1)));
  return rows?`<a class="month-button" href="/trump-says/archive/${key}.html"><b>${label}</b><span>${rows.length.toLocaleString('en-US')}</span></a>`:`<span class="month-button disabled" aria-disabled="true"><b>${label}</b><span>—</span></span>`;
 }).join('')+'</nav></section>').join('');
 return `<button type="button" id="archive-toggle" class="archive-toggle" aria-controls="archive-panel" aria-expanded="false">Archive</button><aside id="archive-panel" class="archive-panel" hidden aria-label="Browse archive"><div class="archive-panel-heading"><h2>Browse by year and month</h2><button id="archive-close" type="button" aria-label="Close archive">Close</button></div><p>Dates use US Eastern time (EST/EDT).</p><div id="archive-panel-body" data-archive-menu>${inline?yearGrid:''}</div><a href="/trump-says/archive-menu.html">Open archive index</a></aside>`;
}

export function archiveMonths(groups){
 const widget=archiveMenu(groups,{inline:true});
 const start='<div id="archive-panel-body" data-archive-menu>';
 return widget.slice(widget.indexOf(start)+start.length,widget.indexOf('</div><a href="/trump-says/archive-menu.html">'));
}

export function enhanceEmptyDetail(html,row,likes,app){
 if(row.text||row.kind==='repost'||row.kind==='retweet'||!safeOriginal(row.original_url,row.platform)||html.includes('data-feed-id='))return html;
 const normalized=mergeLikes(row,likes,app),serialized=JSON.stringify(normalized).replaceAll('<','\\u003c');
 const marker=`<article data-post-id="${esc(row.id)}">`;
 if(!html.includes(marker))throw new Error('Missing detail article');
 html=html.replace(marker,`<article class="feed-record" data-post-id="${esc(row.id)}" data-feed-id="${esc(row.id)}"><script type="application/json" class="feed-record-data">${serialized}</script>`);
 return html.replace(/<p class="unavailable">[^<]*<\/p>/,match=>`<div class="feed-embed" data-feed-embed>${match}</div>`);
}
