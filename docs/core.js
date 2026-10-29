const ZONES=new Set(['Asia/Seoul','America/New_York','UTC']);
const formatters=new Map();
export function timeParts(iso,zone='Asia/Seoul') {
  if(!ZONES.has(zone))throw new Error('Unsupported timezone');
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'}));
  const parts=Object.fromEntries(formatters.get(zone).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}:${parts.second}`,offset:parts.timeZoneName};
}
export function tokens(query) {
  const terms=[];const pattern=/"([^"]+)"|(\S+)/g;
  for(const match of String(query||'').normalize('NFKC').matchAll(pattern))terms.push((match[1]||match[2]).toLocaleLowerCase('en-US'));
  return terms.slice(0,20);
}
export function matchRecord(row,filter,terms=tokens(filter.query)) {
  if(filter.post && row.id!==filter.post)return false;
  if(filter.platform && filter.platform!=='all' && row.platform!==filter.platform)return false;
  if(filter.kind && filter.kind!=='all' && row.kind!==filter.kind)return false;
  if(filter.textOnly && !row.text)return false;
  if(filter.start||filter.end){const day=timeParts(row.published_at,filter.zone).date;if(filter.start&&day<filter.start)return false;if(filter.end&&day>filter.end)return false;}
  const hay=String(row.text).normalize('NFKC').toLocaleLowerCase('en-US');
  return terms.every(term=>hay.includes(term));
}
export function searchRecords(rows,filter) {
  if(filter.start&&filter.end&&filter.start>filter.end)throw new Error('The start date must not be after the end date.');
  const terms=tokens(filter.query),results=[];
  const iterable=filter.order==='oldest'?[...rows].reverse():rows;
  for(const row of iterable)if(matchRecord(row,filter,terms))results.push(row);
  return results;
}
export function safeOriginal(url,platform) {
  try{const u=new URL(url);const host=platform==='x'?['x.com','twitter.com'].includes(u.hostname):platform==='truth'&&u.hostname==='truthsocial.com';const account=platform==='x'?/^\/realdonaldtrump\/status\/[0-9]+\/?$/i:/^\/@realdonaldtrump\/(?:posts\/)?[0-9]+\/?$/i;return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&host&&account.test(u.pathname)?u.href:null;}catch{return null;}
}
export const KIND={original:'Original',repost:'Repost',quote:'Quote',unknown:'Unknown type'};
