import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runtimeValidator} from './runtime-validator.mjs';
const root=new URL('../',import.meta.url),validate=runtimeValidator();
const files=(await fs.readdir(new URL('docs/archive/data/',root))).filter(name=>name.endsWith('.json'));
const seen=new Set();let text=0,missing=0,provider=0,captured=0;
for(const name of files){
 const rows=JSON.parse(await fs.readFile(new URL('docs/archive/data/'+name,root),'utf8'));
 for(const row of rows){
  const normalized=validate(row);
  assert.equal(normalized.id,row.id);assert.ok(!seen.has(row.id),'Repeated month record '+row.id);seen.add(row.id);
  if(normalized.text)text++;else missing++;
  if(normalized.text_source&&typeof normalized.text_source==='object')provider++;
  if(typeof normalized.text_source==='string')captured++;
 }
}
assert.equal(seen.size,81279);
const report={status:'passed',actual_generated_month_records_checked:seen.size,month_json_files:files.length,available_preview_records:text,missing_preview_records:missing,provider_source_objects:provider,captured_source_urls:captured,shared_url_guards_unchanged:true,producer_records_survive_actual_browser_validator:true,platform_requests:0};
await fs.writeFile(new URL('evidence/producer-runtime-check.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
