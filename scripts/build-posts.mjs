import fs from 'node:fs/promises';
import path from 'node:path';
import {completeTracking} from './publisher-tracking.mjs';
import {timeParts,safeOriginal,KIND} from '../src/core.js';
import {eligibleFeedRows,mergeLikes,topLiked,makeFeedCard,archiveMenu,archiveMonths,enhanceEmptyDetail} from './feed-model.mjs';
let archiveWidget='',feedConfig='';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const uri=r=>r.id.replace(':','-')+'.html';
const header=base=>`<header class="topbar"><a class="wordmark" href="${base}">TRUMP<span>SAYS</span><b>.</b></a><nav aria-label="Pages"><a href="${base}">Archive</a><a href="${base}search.html">Search</a><a href="${base}sources.html">Sources & coverage</a></nav></header>${archiveWidget}`;
const footer=base=>`<footer><span>Independent archive · Partial coverage</span><a href="${base}sources.html">Sources & coverage</a><a class="more" href="https://nanalab.kr/apps/">More Apps</a></footer>`;
const head=(title,url,description,base)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><link rel="stylesheet" href="${base}style.css?v=public-posts-20261028"><link rel="stylesheet" href="${base}feed.css?v=20261029-nav2"><script src="${base}feed.js?v=20261029" defer></script></head><body>${feedConfig}`;
const xml=urls=>'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+esc(url)+'</loc></url>').join('')+'</urlset>\n';
export async function buildPosts(root,dist,manifest,app){
 const all=[];for(const chunk of manifest.chunks)all.push(...JSON.parse(await fs.readFile(path.join(root,'src',chunk.file),'utf8')));
 all.sort((a,b)=>b.published_at.localeCompare(a.published_at)||(BigInt(b.post_id)>BigInt(a.post_id)?1:-1));
 if(all.length!==manifest.total_records)throw new Error('Corpus count mismatch');
 await fs.mkdir(path.join(dist,'posts'),{recursive:true});await fs.mkdir(path.join(dist,'archive'),{recursive:true});
 const navigationUrls=[app.origin+'/',app.origin+'/sources.html',app.origin+'/search.html'];const monthLinks=[];
 const groups=new Map(),dayGroups=new Map(),clocks=new Map();
 for(const row of all){const clock=timeParts(row.published_at,'America/New_York');clocks.set(row.id,clock);const month=clock.date.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(row);if(!dayGroups.has(clock.date))dayGroups.set(clock.date,[]);dayGroups.get(clock.date).push(row);}
 const likes=JSON.parse(await fs.readFile(path.join(root,'src/data/likes.json'),'utf8'));
 const eligible=eligibleFeedRows(all),feedRows=eligible.map(row=>mergeLikes(row,likes,app));
 const byFeedId=new Map(feedRows.map(row=>[row.id,row]));
 const popular=topLiked(feedRows),popularIds=new Set(popular.map(row=>row.id));
 const latest=feedRows.filter(row=>!popularIds.has(row.id));
 const viewGroups=new Map([...groups].map(([key,rows])=>[key,eligibleFeedRows(rows)]));
 archiveWidget=archiveMenu(viewGroups);
 feedConfig='<script type="application/json" id="feed-config">'+JSON.stringify({base:'/trump-says/',origin:app.origin,name:'Trump Says',autoEmbeds:true,allowText:false,xHandles:['realDonaldTrump'],displayTimezone:'America/New_York',archiveMenuUrl:'/trump-says/archive-menu.html'}).replaceAll('<','\\u003c')+'</script>';
 let bytes=0;const monthRows=[];
 const monthDir=path.join(dist,'archive');
 if(path.dirname(monthDir)!==dist||path.basename(monthDir)!=='archive')throw new Error('Invalid archive output');
 // This directory contains this generator's previous untracked/public build output only.
 await fs.rm(monthDir,{recursive:true,force:true});await fs.mkdir(path.join(monthDir,'data'),{recursive:true});
 const item=row=>makeFeedCard(byFeedId.get(row.id)||mergeLikes(row,likes,app));
 const list=rows=>rows.map(item).join('');
 for(const [month,sourceRows]of groups){
  const rows=eligibleFeedRows(sourceRows);
  const year=month.slice(0,4),monthNumber=Number(month.slice(5));monthRows.push({month,year,count:rows.length});
  const daysInMonth=new Date(Date.UTC(Number(year),monthNumber,0)).getUTCDate();let dayButtons='';
  for(let day=1;day<=daysInMonth;day++){const key=month+'-'+String(day).padStart(2,'0'),sourceItems=dayGroups.get(key),items=sourceItems?eligibleFeedRows(sourceItems):null;dayButtons+=items?`<a class="day-button" href="${key}.html"><b>${day}</b><span>${items.length} posts</span></a>`:`<span class="day-button disabled" aria-disabled="true"><b>${day}</b><span>0 posts</span></span>`;}
  // Static fallback sample is reproducible; browser sampling refreshes on each visit.
  const sample=[...rows].sort((a,b)=>a.post_id.slice(-6).localeCompare(b.post_id.slice(-6))).slice(0,50);
  const url=app.origin+'/archive/'+month+'.html';
  const html=completeTracking(head(month+' — Trump Says',url,'Browse Donald Trump social posts by day in '+month+'. Dates use US Eastern time.','../')+header('../')+`<main class="sources month-page" data-month="${month}"><h1>${month}</h1><p>${rows.length.toLocaleString('en-US')} posts · US Eastern time (EST/EDT)</p><h2>Choose a day</h2><nav class="day-picker" aria-label="Days in ${month}">${dayButtons}</nav><div class="sample-heading"><h2>${Math.min(50,rows.length)} random posts</h2><button id="shuffle" type="button">Show another 50</button></div><p id="sample-status" role="status">${Math.min(50,rows.length)} of ${rows.length.toLocaleString('en-US')} posts. Choose a day above to see every post from that day.</p><ul class="archive-list" id="month-posts">${list(sample)}</ul>${footer('../')}</main><script type="module" src="../browse-month.js?v=20261028"></script></body></html>`);
  await fs.writeFile(path.join(monthDir,month+'.html'),html);bytes+=Buffer.byteLength(html);navigationUrls.push(url);
  const summaries=rows.map(row=>byFeedId.get(row.id)||mergeLikes(row,likes,app));
  await fs.writeFile(path.join(monthDir,'data',month+'.json'),JSON.stringify(summaries));
 }
 const dayKeys=[...dayGroups.keys()];
 for(let d=0;d<dayKeys.length;d++){
  const day=dayKeys[d],rows=eligibleFeedRows(dayGroups.get(day)),month=day.slice(0,7),url=app.origin+'/archive/'+day+'.html';
  const html=completeTracking(head(day+' — Trump Says',url,'All '+rows.length+' archived Donald Trump social posts for '+day+' in US Eastern time.','../')+header('../')+`<main class="sources day-page"><h1>${day}</h1><p>${rows.length.toLocaleString('en-US')} posts · US Eastern time (EST/EDT) · Newest first</p><p><a href="${month}.html">← Choose another day in ${month}</a></p><ul class="archive-list">${list(rows)}</ul><nav class="pagination" aria-label="Adjacent archive days">${d?`<a href="${dayKeys[d-1]}.html">← Newer day</a>`:''}${d+1<dayKeys.length?`<a href="${dayKeys[d+1]}.html">Older day →</a>`:''}</nav>${footer('../')}</main></body></html>`);
  await fs.writeFile(path.join(monthDir,day+'.html'),html);bytes+=Buffer.byteLength(html);navigationUrls.push(url);
 }
 const postUrls=all.map(row=>app.origin+'/posts/'+uri(row));
 let cursor=0;
 async function job(){while(cursor<all.length){const i=cursor++,row=all[i],url=postUrls[i],local=clocks.get(row.id);
  const sourceLinks=row.source_ids.map(id=>{const s=manifest.sources.find(x=>x.id===id);return s?`<li><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.creator)} · ${esc(id)}${row.text_source===id?' · text source':''}</a></li>`:'';}).join('');
  const original=safeOriginal(row.original_url,row.platform);
  const body=row.text?`<blockquote class="post-text">${esc(row.text)}</blockquote>`:`<p class="unavailable">${row.content_status==='media_only'?'Media post with no archived text.':'Text unavailable. Only the posting time, source identifiers and original link are archived.'}</p>`;
  const previous=i>0?`<a href="${uri(all[i-1])}">← Newer post</a>`:'',next=i+1<all.length?`<a href="${uri(all[i+1])}">Older post →</a>`:'';
  let html=head('Trump Says · '+row.published_at.slice(0,19).replace('T',' ')+' UTC · '+row.platform.toUpperCase(),url,row.text?row.text.slice(0,155):'Archived Donald Trump social post metadata: posting time, platform, sources and original link.','../');
  html+=header('../')+`<main class="sources post-page"><article data-post-id="${esc(row.id)}"><h1>${row.platform==='x'?'X / Twitter':'Truth Social'} post</h1><p class="meta">${esc(KIND[row.kind]||KIND.unknown)}${row.source_deleted_flag?' · Marked deleted in source':''}${row.timestamp_basis?' · Time corrected':''}</p><p class="post-date"><time datetime="${row.published_at}">${local.date} ${local.time} ${local.offset}</time><br><span>${row.published_at} · UTC</span></p>${body}<div class="actions">${original?`<a href="${esc(original)}" target="_blank" rel="noopener noreferrer">Original post ↗</a>`:''}<a href="../archive/${local.date}.html">All posts on ${local.date}</a><a href="../search.html">Search archive</a></div><details class="provenance"><summary>Timestamp & sources</summary><p>Post ID: ${esc(row.post_id)}</p>${row.provided_at?`<p>Source timestamp: ${esc(row.provided_at)}. Corrected against the creation time encoded in the post ID.</p>`:''}<ul>${sourceLinks}</ul><p>Deletion and post-type flags come from the dataset, not a live status check.</p><a href="../sources.html">Coverage, licenses and missing records</a></details></article><nav class="pagination" aria-label="Adjacent posts">${previous}${next}</nav>${footer('../')}</main></body></html>`;
  html=completeTracking(enhanceEmptyDetail(html,row,likes,app));bytes+=Buffer.byteLength(html);await fs.writeFile(path.join(dist,'posts',uri(row)),html);
  if((i+1)%10000===0)console.log(JSON.stringify({generated_posts:i+1,total:all.length}));
 }}
 await Promise.all(Array.from({length:24},job));
 const feedStats=await buildHomeFeed(root,dist,app,manifest,viewGroups,popular,latest,navigationUrls);
 const maps=['sitemap-main.xml'];await fs.writeFile(path.join(dist,maps[0]),xml(navigationUrls));
 for(let offset=0;offset<postUrls.length;offset+=50000){const name='sitemap-posts-'+String(1+offset/50000).padStart(2,'0')+'.xml';maps.push(name);await fs.writeFile(path.join(dist,name),xml(postUrls.slice(offset,offset+50000)));}
 await fs.writeFile(path.join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+maps.map(name=>'<sitemap><loc>'+app.origin+'/'+name+'</loc></sitemap>').join('')+'</sitemapindex>\n');
 const summary={...manifest};delete summary.chunks;
 await fs.writeFile(path.join(dist,'data/summary.json'),JSON.stringify(summary));
 const recent=all.filter(r=>r.text).slice(0,50).map(r=>({...r,text:r.text.slice(0,420)+(r.text.length>420?'…':'')}));
 await fs.writeFile(path.join(dist,'data/recent.json'),JSON.stringify(recent));
 const search=await fs.readFile(path.join(dist,'index.html'),'utf8');
 await fs.writeFile(path.join(dist,'search.html'),search.replace('<title>Trump Says','<title>Search — Trump Says'));
 const stats={posts:all.length,archive_pages:navigationUrls.length-3,months:groups.size,days:dayGroups.size,post_sitemaps:maps.slice(1).map((name,i)=>({name,urls:postUrls.slice(i*50000,(i+1)*50000).length})),navigation_urls:navigationUrls.length,generated_html_bytes:bytes,home_data_requests:0,home_post_rows:popular.length+Math.min(20,latest.length),popular_posts:popular.length,latest_feed_posts:latest.length,feed_pages:feedStats.pages,excluded_from_feed:all.length-feedRows.length,monthly_sample:50,browse_timezone:'America/New_York',search_recent_records:recent.length,search_load:'only on separate search page and user request'};
 await fs.writeFile(path.join(root,'BUILD_REPORT.json'),JSON.stringify(stats,null,2)+'\n');return stats;
}

async function buildHomeFeed(root,dist,app,manifest,groups,popular,latest,navigationUrls){
 const pageSize=20,pages=Math.ceil(latest.length/pageSize);
 await fs.mkdir(path.join(dist,'feed'),{recursive:true});
 const feedPath=page=>'/trump-says/feed/latest-'+String(page).padStart(4,'0')+'.html';
 const next=page=>page<pages?`<a id="feed-next" rel="next" href="${feedPath(page+1)}">Load more</a>`:'<p id="feed-end">End of collected posts.</p>';
 const status='<p id="feed-status" role="status" aria-live="polite"></p><div id="feed-sentinel" aria-hidden="true"></div>';
 for(let page=1;page<=pages;page++){
  const selected=latest.slice((page-1)*pageSize,page*pageSize),url=app.origin+'/feed/latest-'+String(page).padStart(4,'0')+'.html';
  const html=completeTracking(head('Latest posts · '+page+' — Trump Says',url,'Latest collected Donald Trump post links, page '+page+'. Native reposts excluded.','../')+header('../')+`<main class="sources home-feed"><h1>Latest posts</h1><p>Newest first · Native reposts excluded · Partial coverage</p><ol id="latest-records" data-feed-items>${selected.map(makeFeedCard).join('')}</ol>${next(page)}${status}${footer('../')}</main></body></html>`);
  await fs.writeFile(path.join(dist,'feed','latest-'+String(page).padStart(4,'0')+'.html'),html);
  navigationUrls.push(url);
 }
 const menuUrl=app.origin+'/archive-menu.html';
 await fs.writeFile(path.join(dist,'archive-menu.html'),completeTracking(head('Archive — Trump Says',menuUrl,'Browse the Trump Says archive by year and month.','./')+header('./')+`<main class="sources"><h1>Browse by year and month</h1><p>US Eastern time (EST/EDT). Existing archive routes retain the original collected records and source classifications.</p><div id="archive-menu-content" data-archive-months>${archiveMonths(groups)}</div>${footer('./')}</main></body></html>`));
 navigationUrls.push(menuUrl);
 const firstLatest=latest.slice(0,pageSize),portrait='<img class="portrait" src="assets/donald-trump-portrait.jpg" width="150" height="188" alt="Donald Trump, official portrait by Daniel Torok" fetchpriority="high">';
 const hero=`<section class="hero feed-hero"><div class="identity">${portrait}<div><h1>Trump Says</h1><p class="subject">Donald Trump · X / Twitter and Truth Social</p><p class="feed-summary">${manifest.total_records.toLocaleString('en-US')} collected records · Partial coverage</p><a class="photo-credit" href="sources.html">Photo credit & sources</a></div></div></section>`;
 const topNote=popular.length?`<p>Up to 100 collected posts ranked by available source like counts. Counts are snapshots from different platform sources, not live or directly comparable platform statistics.</p>`:'<p>Like counts are unavailable for this collection.</p>';
 const popularSection=`<section id="popular" class="feed-section"><h2>Most liked posts</h2>${topNote}<ol id="popular-records">${popular.map(makeFeedCard).join('')}</ol></section>`;
 const home=completeTracking(head('Trump Says',app.origin+'/','Donald Trump posts: most liked source records followed by the latest collected posts.','./')+header('./').replace('<div id="archive-panel-body" data-archive-menu></div>','<div id="archive-panel-body" data-archive-menu>'+archiveMonths(groups)+'</div>')+`<main class="home-feed feed-home">${hero}${popularSection}<section id="latest" class="feed-section"><h2>Latest posts</h2><p>Newest first. Posts already shown above are omitted. Native reposts excluded; unknown source classifications remain marked unknown.</p><ol id="latest-records" data-feed-items>${firstLatest.map(makeFeedCard).join('')}</ol>${next(1)}${status}</section>${footer('./')}</main></body></html>`);
 await fs.writeFile(path.join(dist,'index.html'),home);
 return {pages,pageSize,popular:popular.length,latest:latest.length};
}
