(function(){
if(!['nanalab.kr','www.nanalab.kr','nanacompany.github.io'].includes(location.hostname.toLowerCase()))return;
function load(src,attrs){var s=document.createElement('script');s.async=true;s.src=src;for(var k in attrs)s.setAttribute(k,attrs[k]);document.head.appendChild(s);}
window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
load('https://www.googletagmanager.com/gtm.js?id=GTM-NV2WWQXB',{});
gtag('js',new Date());gtag('config','G-2ZYSF0173P',{page_location:location.origin+location.pathname,page_referrer:document.referrer?document.referrer.split(/[?#]/)[0]:''});
load('https://www.googletagmanager.com/gtag/js?id=G-2ZYSF0173P',{});
load('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9767176956440077',{crossorigin:'anonymous'});
function beacon(){if(document.querySelector('script[src*="static.cloudflareinsights.com/beacon.min.js"]'))return;load('https://static.cloudflareinsights.com/beacon.min.js',{'data-cf-beacon':JSON.stringify({token:'9f3423bb0d034d91bbe1a12afeff2429'})});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',beacon,{once:true});else beacon();
})();