const root=document.querySelector('[data-month]'),list=document.getElementById('month-posts'),status=document.getElementById('sample-status'),button=document.getElementById('shuffle');
let rows=[];
function sample(){
 if(!window.SaysFeed?.createCard){status.textContent='The saved posts remain available. Please reload to refresh the random sample.';return;}
 const copy=[...rows];for(let i=copy.length-1;i>0;i--){const random=new Uint32Array(1);crypto.getRandomValues(random);const j=random[0]%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}
 const cards=copy.slice(0,50).map(row=>window.SaysFeed.createCard(row));list.replaceChildren(...cards);window.SaysFeed.hydrate(list);
 status.textContent=Math.min(50,rows.length)+' random posts from '+rows.length.toLocaleString('en-US')+'. Choose a day above to see every post from that day.';
}
try{const response=await fetch('./data/'+root.dataset.month+'.json');if(!response.ok)throw new Error('Could not load this month.');rows=await response.json();sample();button.addEventListener('click',sample);}catch{status.textContent+=' Could not refresh the sample; showing the saved selection.';button.disabled=true;}
