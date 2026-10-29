import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {enhanceEmptyDetail} from './feed-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=JSON.parse(await fs.readFile(path.join(root,'APP.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(root,'src/data/manifest.json'),'utf8'));
const likes=JSON.parse(await fs.readFile(path.join(root,'src/data/likes.json'),'utf8'));
let checked=0,changed=0;
for(const chunk of manifest.chunks){
 const rows=JSON.parse(await fs.readFile(path.join(root,'src',chunk.file),'utf8'));
 for(const row of rows){
  if(row.text||row.kind==='repost'||row.kind==='retweet')continue;
  const file=path.join(root,'docs/posts',row.id.replace(':','-')+'.html');
  const old=await fs.readFile(file,'utf8'),next=enhanceEmptyDetail(old,row,likes,app);checked++;
  if(old!==next){await fs.writeFile(file,next);changed++;}
 }
}
console.log(JSON.stringify({status:'passed',empty_details_checked:checked,official_embed_details_added:changed}));
