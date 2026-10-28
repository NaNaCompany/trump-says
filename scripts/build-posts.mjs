import fs from 'node:fs/promises';
import path from 'node:path';
import {completeTracking} from './publisher-tracking.mjs';
import {timeParts,safeOriginal,KIND} from '../src/core.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const uri=r=>r.id.replace(':','-')+'.html';
const header=base=>`<header class="topbar"><a class="wordmark" href="${base}">TRUMP<span>SAYS</span><b>.</b></a><nav aria-label="Pages"><a href="${base}">Archive</a><a href="${base}search.html">Search</a><a href="${base}sources.html">Sources & coverage</a></nav></header>`;
const footer=base=>`<footer><span>Independent archive · Partial coverage</span><a href="${base}sources.html">Sources & coverage</a><a class="more" href="https://nanalab.kr/apps/">More Apps</a></footer>`;
const head=(title,url,description,base)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><link rel="stylesheet" href="${base}style.css?v=public-posts-20261028"></head><body>`;
const xml=urls=>'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+esc(url)+'</loc></url>').join('')+'</urlset>\n';
export async function buildPosts(root,dist,manifest,app){
 const all=[];for(const chunk of manifest.chunks)all.push(...JSON.parse(await fs.readFile(path.join(root,'src',chunk.file),'utf8')));
 all.sort((a,b)=>b.published_at.localeCompare(a.published_at)||(BigInt(b.post_id)>BigInt(a.post_id)?1:-1));
 if(all.length!==manifest.total_records)throw new Error('Corpus count mismatch');
 await fs.mkdir(path.join(dist,'posts'),{recursive:true});await fs.mkdir(path.join(dist,'archive'),{recursive:true});
 const navigationUrls=[app.origin+'/',app.origin+'/sources.html',app.origin+'/search.html'];const monthLinks=[];
 const groups=new Map(),dayGroups=new Map(),clocks=new Map();
 for(const row of all){const clock=timeParts(row.published_at,'America/New_York');clocks.set(row.id,clock);const month=clock.date.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(row);if(!dayGroups.has(clock.date))dayGroups.set(clock.date,[]);dayGroups.get(clock.date).push(row);}
 let bytes=0;const monthRows=[];
 const monthDir=path.join(dist,'archive');
 if(path.dirname(monthDir)!==dist||path.basename(monthDir)!=='archive')throw new Error('Invalid archive output');
 // This directory contains this generator's previous untracked/public build output only.
 await fs.rm(monthDir,{recursive:true,force:true});await fs.mkdir(path.join(monthDir,'data'),{recursive:true});
 const item=row=>{const clock=clocks.get(row.id);return `<li><a href="../posts/${uri(row)}"><time datetime="${row.published_at}">${clock.date} ${clock.time} ${clock.offset}</time><span class="platform">${row.platform==='x'?'X / Twitter':'Truth Social'}</span><p>${esc(row.text?row.text.slice(0,240)+(row.text.length>240?'…':''):'Text unavailable — metadata only')}</p></a></li>`;};
 const list=rows=>rows.map(item).join('');
 for(const [month,rows]of groups){
  const year=month.slice(0,4),monthNumber=Number(month.slice(5));monthRows.push({month,year,count:rows.length});
  const daysInMonth=new Date(Date.UTC(Number(year),monthNumber,0)).getUTCDate();let dayButtons='';
  for(let day=1;day<=daysInMonth;day++){const key=month+'-'+String(day).padStart(2,'0'),items=dayGroups.get(key);dayButtons+=items?`<a class="day-button" href="${key}.html"><b>${day}</b><span>${items.length} posts</span></a>`:`<span class="day-button disabled" aria-disabled="true"><b>${day}</b><span>0 posts</span></span>`;}
  // Static fallback sample is reproducible; browser sampling refreshes on each visit.
  const sample=[...rows].sort((a,b)=>a.post_id.slice(-6).localeCompare(b.post_id.slice(-6))).slice(0,50);
  const url=app.origin+'/archive/'+month+'.html';
  const html=completeTracking(head(month+' — Trump Says',url,'Browse Donald Trump social posts by day in '+month+'. Dates use US Eastern time.','../')+header('../')+`<main class="sources month-page" data-month="${month}"><h1>${month}</h1><p>${rows.length.toLocaleString('en-US')} posts · US Eastern time (EST/EDT)</p><h2>Choose a day</h2><nav class="day-picker" aria-label="Days in ${month}">${dayButtons}</nav><div class="sample-heading"><h2>${Math.min(50,rows.length)} random posts</h2><button id="shuffle" type="button">Show another 50</button></div><p id="sample-status" role="status">${Math.min(50,rows.length)} of ${rows.length.toLocaleString('en-US')} posts. Choose a day above to see every post from that day.</p><ul class="archive-list" id="month-posts">${list(sample)}</ul>${footer('../')}</main><script type="module" src="../browse-month.js?v=20261028"></script></body></html>`);
  await fs.writeFile(path.join(monthDir,month+'.html'),html);bytes+=Buffer.byteLength(html);navigationUrls.push(url);
  const summaries=rows.map(row=>{const c=clocks.get(row.id);return {id:row.id,published_at:row.published_at,date:c.date,time:c.time,offset:c.offset,platform:row.platform,excerpt:row.text?row.text.slice(0,240)+(row.text.length>240?'…':''):'Text unavailable — metadata only'};});
  await fs.writeFile(path.join(monthDir,'data',month+'.json'),JSON.stringify(summaries));
 }
 const dayKeys=[...dayGroups.keys()];
 for(let d=0;d<dayKeys.length;d++){
  const day=dayKeys[d],rows=dayGroups.get(day),month=day.slice(0,7),url=app.origin+'/archive/'+day+'.html';
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
  html=completeTracking(html);bytes+=Buffer.byteLength(html);await fs.writeFile(path.join(dist,'posts',uri(row)),html);
  if((i+1)%10000===0)console.log(JSON.stringify({generated_posts:i+1,total:all.length}));
 }}
 await Promise.all(Array.from({length:24},job));
 const maps=['sitemap-main.xml'];await fs.writeFile(path.join(dist,maps[0]),xml(navigationUrls));
 for(let offset=0;offset<postUrls.length;offset+=50000){const name='sitemap-posts-'+String(1+offset/50000).padStart(2,'0')+'.xml';maps.push(name);await fs.writeFile(path.join(dist,name),xml(postUrls.slice(offset,offset+50000)));}
 await fs.writeFile(path.join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+maps.map(name=>'<sitemap><loc>'+app.origin+'/'+name+'</loc></sitemap>').join('')+'</sitemapindex>\n');
 const summary={...manifest};delete summary.chunks;
 await fs.writeFile(path.join(dist,'data/summary.json'),JSON.stringify(summary));
 const recent=all.filter(r=>r.text).slice(0,50).map(r=>({...r,text:r.text.slice(0,420)+(r.text.length>420?'…':'')}));
 await fs.writeFile(path.join(dist,'data/recent.json'),JSON.stringify(recent));
 const search=await fs.readFile(path.join(dist,'index.html'),'utf8');
 await fs.writeFile(path.join(dist,'search.html'),search.replace('<title>Trump Says','<title>Search — Trump Says'));
 const years=[...new Set(monthRows.map(row=>row.year))];
 const yearGrid=years.map(year=>{let buttons='';for(let month=1;month<=12;month++){const key=year+'-'+String(month).padStart(2,'0'),row=monthRows.find(x=>x.month===key),label=new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2000,month-1,1)));buttons+=row?`<a class="month-button" href="archive/${key}.html"><b>${label}</b><span>${row.count.toLocaleString('en-US')}</span></a>`:`<span class="month-button disabled" aria-disabled="true"><b>${label}</b><span>—</span></span>`;}return `<section class="year-group"><h3>${year}</h3><nav class="year-grid" aria-label="Months in ${year}">${buttons}</nav></section>`;}).join('');
 const hero=`<section class="hero"><div class="identity"><img class="portrait" src="assets/donald-trump-portrait.jpg" width="1638" height="2048" alt="Donald Trump, official portrait by Daniel Torok" fetchpriority="high"><div><h1>Trump Says</h1><p class="subject">Donald Trump’s social posts</p></div></div><div class="archive-card"><p>ARCHIVE SNAPSHOT</p><strong>${all.length.toLocaleString('en-US')}</strong><span>archived posts</span><div class="stat-row"><div><b>${manifest.text_records.toLocaleString('en-US')}</b><span>with text</span></div><div><b>${manifest.metadata_only.toLocaleString('en-US')}</b><span>metadata only</span></div></div><p class="asof">Snapshot ${manifest.captured_at.slice(0,10)} UTC · Partial coverage</p></div></section>`;
 const coverage=`<section class="coverage"><strong>Coverage</strong><p>X / Twitter: ${manifest.platforms.x.count.toLocaleString('en-US')} · Truth Social: ${manifest.platforms.truth.count.toLocaleString('en-US')}. Latest archived text: X ${manifest.platforms.x.last_text.slice(0,10)}; Truth Social ${manifest.platforms.truth.last_text.slice(0,10)}. Facebook and Instagram not collected.</p><a href="sources.html">Coverage & sources →</a></section>`;
 const homepage=head('Trump Says',app.origin+'/','Donald Trump social post archive. Choose a year, month and day.','./')+header('./')+`<main>${hero}${coverage}<section id="archive" class="year-index"><h2>Browse by year and month</h2><p>US Eastern time (EST/EDT). Choose a month, then choose a day to see all its posts.</p>${yearGrid}</section>${footer('./')}</main></body></html>`;
 await fs.writeFile(path.join(dist,'index.html'),homepage);
 const stats={posts:all.length,archive_pages:navigationUrls.length-3,months:groups.size,days:dayGroups.size,post_sitemaps:maps.slice(1).map((name,i)=>({name,urls:postUrls.slice(i*50000,(i+1)*50000).length})),navigation_urls:navigationUrls.length,generated_html_bytes:bytes,home_data_requests:0,home_post_rows:0,monthly_sample:50,browse_timezone:'America/New_York',search_recent_records:recent.length,search_load:'only on separate search page and user request'};
 await fs.writeFile(path.join(root,'BUILD_REPORT.json'),JSON.stringify(stats,null,2)+'\n');return stats;
}
