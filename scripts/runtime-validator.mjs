import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the exact browser validator without loading any platform or publisher network code.
export function runtimeValidator(){
 const config={base:'/trump-says/',origin:'https://nanalab.kr/trump-says',name:'Trump Says',xHandles:['realDonaldTrump'],displayTimezone:'America/New_York',listTextOnly:true,allowText:true,autoEmbeds:false};
 const document={querySelector:selector=>selector==='#feed-config'?{textContent:JSON.stringify(config)}:null,querySelectorAll:()=>[],addEventListener(){}};
 const context={document,location:{href:'https://nanalab.kr/trump-says/'},URL,Date,Intl,console,setTimeout,clearTimeout,addEventListener(){}};context.window=context;
 vm.runInNewContext(fs.readFileSync(new URL('../src/feed.js',import.meta.url),'utf8'),context);
 return context.SaysFeed.validateRecord;
}
