const MANAGED=new Set(['og:title','og:type','og:url','og:description','og:image','og:image:alt','og:image:width','og:image:height','og:image:type','twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt']);
const MARKER=/<!-- Trump Says home social preview -->[\s\S]*?<!-- \/Trump Says home social preview -->/g;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const HOME_PORTRAIT={file:'assets/donald-trump-portrait.jpg',width:1638,height:2048,type:'image/jpeg',alt:'Donald Trump, official portrait by Daniel Torok'};

export function stripHomeSocialMetadata(html){
 return html.replace(MARKER,'').replace(/<meta\b[^>]*>/gi,tag=>{
  const name=tag.match(/\b(?:property|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return name&&MANAGED.has((name[1]||name[2]||name[3]).toLowerCase())?'':tag;
 });
}

export function withHomeSocialMetadata(html,origin){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.username||base.password||base.port||base.search||base.hash)throw new Error('Invalid home social origin');
 const home=base.href.replace(/\/$/,'')+'/',image=new URL(HOME_PORTRAIT.file,home).href;
 const title='Trump Says',description='Donald Trump posts: most liked source records followed by the latest collected posts.';
 const entries=[['og:title',title],['og:type','website'],['og:url',home],['og:description',description],['og:image',image],['og:image:alt',HOME_PORTRAIT.alt],['og:image:width',HOME_PORTRAIT.width],['og:image:height',HOME_PORTRAIT.height],['og:image:type',HOME_PORTRAIT.type],['twitter:card','summary_large_image'],['twitter:title',title],['twitter:description',description],['twitter:image',image],['twitter:image:alt',HOME_PORTRAIT.alt]];
 const tags=entries.map(([name,value])=>`<meta ${name.startsWith('og:')?'property':'name'}="${name}" content="${escape(value)}">`).join('');
 const clean=stripHomeSocialMetadata(html);
 if(!/<\/head>/i.test(clean))throw new Error('Missing home head');
 return clean.replace(/<\/head>/i,`<!-- Trump Says home social preview -->${tags}<!-- /Trump Says home social preview --></head>`);
}
