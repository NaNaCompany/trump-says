// The source overlay fills gaps only; original corpus records remain untouched.
export function withTextOverride(row,overrides={}){
 const extra=overrides[row.id];
 if(row.text||!extra||typeof extra!=='object'||typeof extra.text!=='string')return {...row};
 return {...row,text:extra.text,text_override_status:extra.status||'available',text_override_source:extra.source_url||null,text_override_sha256:extra.sha256||null};
}

export function textPreview(value,max=800){
 if(typeof value!=='string'||!value)return {text:null,text_truncated:false};
 const points=Array.from(value);
 return points.length>max?{text:points.slice(0,max-1).join('')+'…',text_truncated:true}:{text:value,text_truncated:false};
}
