export const aliasGroups = [
 ['restart','resume','continue'], ['save','saving','write','written'],
 ['output','results','visualization','vtk'], ['cores','processors','parallel','mpiexec'],
 ['inlet','inflow'], ['step','steps'], ['mesh','grid'],
 ['0d','reduced','lumped'], ['modes','harmonics','fourier']
];
export const stopWords = new Set('a an the this that these those is are was were be been do does how what where which why can i my we it its to of for in on at by and or with from without as have has need want please more less'.split(' '));
export function tokens(value) {
 const expanded=String(value).normalize('NFKC').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase();
 return expanded.match(/[a-z0-9]+(?:_[a-z0-9]+)*/g)?.flatMap(t=>t.includes('_')?[t,...t.split('_')]:[t]).filter(t=>!stopWords.has(t))||[];
}
export function classifyQuery(q) {
 if(q.length>240)return'too-long';
 if(!q.trim())return'empty';
 if(/\b(guarantee|guaranteed|diagnosis|diagnose)\b/i.test(q))return'unsupported-guarantee';
 const ts=tokens(q).filter(t=>!['set','change','configure','specify'].includes(t));
 return ts.length===1&&/^(pressure|flow|model|simulation|solver)$/.test(ts[0])?'ambiguous':'normal';
}
export function createIndex(records) {
 const items=records.map(r=>{
  const body=tokens(r.text),heading=tokens(r.title),labels=tokens((r.context||'')+' '+(r.purpose||''));
  const tf=new Map();for(const t of body)tf.set(t,(tf.get(t)||0)+1);
  const discovery=new Set(tokens((r.discovery_terms||r.discovery_labels||[]).join(' '))),sourceTerms=new Set(tokens((r.source||'').replace(/([a-z])([0-9])/gi,'$1 $2')));
  return{r,tf,heading:new Set(heading),labels:new Set(labels),discovery,sourceTerms,length:Math.max(1,body.length)};
 });
 const df=new Map(),sourceDf=new Map();for(const i of items){for(const t of i.tf.keys())df.set(t,(df.get(t)||0)+1);for(const t of i.sourceTerms)sourceDf.set(t,(sourceDf.get(t)||0)+1);}
 return{items,df,sourceDf,avg:items.reduce((n,i)=>n+i.length,0)/Math.max(1,items.length),count:items.length};
}
export function suggestRoutes(index,q,{context='all',limit=4}={}){
 if(['empty','too-long','unsupported-guarantee'].includes(classifyQuery(q)))return[];
 const query=new Set(tokens(q)),related=new Set();
 for(const group of aliasGroups)if(group.some(t=>query.has(t)))for(const t of group)related.add(t);
 const ignore=new Set(['find','look','up','start','follow','understand','instructions','controls']);
 const routes=[];
 for(const item of index.items){
  if(context!=='all'&&item.r.context!==context)continue;
  for(let n=0;n<(item.r.discovery_labels||[]).length;n++){
   const label=item.r.discovery_terms?.[n]||item.r.discovery_labels[n],terms=new Set(tokens(label).filter(t=>!ignore.has(t)));
   let score=0,matched=0;for(const t of terms){if(query.has(t)){score++;matched++;}else if(related.has(t)){score+=.75;matched++;}}
   if(score)routes.push({label:item.r.discovery_labels[n],href:item.r.href,source_id:item.r.source_id,source:item.r.source,source_sha256:item.r.source_sha256,context:item.r.context,score:score/Math.sqrt(Math.max(1,terms.size)),matched});
  }
 }
 routes.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
 const seen=new Set();return routes.filter(r=>{const key=r.label+'|'+r.href;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
export function search(index,q,{baseline='enhanced',context='all',limit=8}={}) {
 const intent=classifyQuery(q);
 if(['empty','too-long','unsupported-guarantee'].includes(intent))return{intent,results:[]};
 const query=[...new Set(tokens(q))];if(!query.length)return{intent:'no-terms',results:[]};
 const weights=new Map(query.map(t=>[t,1]));
 if(baseline==='enhanced')for(const group of aliasGroups)if(group.some(t=>query.includes(t)))for(const t of group)if(!weights.has(t))weights.set(t,.28);
 const norm=q.replace(/[<>]/g,'').trim().toLowerCase();
 const scored=[];
 for(const i of index.items){
  const r=i.r;if(context!=='all'&&r.context!==context)continue;
  let score=0,matched=0,headingMatches=0,discoveryMatches=0,sourceMatches=0;
  if(baseline==='title'){
   for(const t of query)if(i.heading.has(t)){score+=1;matched++;}
  }else{
   for(const [t,w]of weights){
    const tf=i.tf.get(t)||0;let originalMatch=!!tf;
    if(tf){const idf=Math.log(1+(index.count-(index.df.get(t)||0)+.5)/((index.df.get(t)||0)+.5));score+=w*idf*(tf*2.2)/(tf+1.2*(.25+.75*i.length/index.avg));}
    if(baseline==='enhanced'){
     if(i.heading.has(t)){score+=w*2.4;originalMatch=true;if(w===1)headingMatches++;}
     if(i.labels.has(t))score+=w*.3;
     if(i.discovery.has(t)){score+=2.4;originalMatch=true;if(w===1)discoveryMatches++;}
     if(i.sourceTerms.has(t)){const idf=Math.log(1+(index.count-(index.sourceDf.get(t)||0)+.5)/((index.sourceDf.get(t)||0)+.5));score+=w*.7*idf;originalMatch=true;if(w===1)sourceMatches++;}
    }
    if(w===1&&originalMatch)matched++;
   }
  }
  const exact=r.token?.toLowerCase()===norm||r.source_id.toLowerCase()===norm;
  if(baseline==='enhanced'&&exact)score+=100;
  const specificHeadingMatch=baseline==='enhanced'&&matched===1&&(headingMatches||discoveryMatches)&&query.length<=4;
  if(score>0&&(exact||matched>=Math.min(2,query.length)||specificHeadingMatch))scored.push({...r,score,matched,exact,match_evidence:{heading:headingMatches,task_metadata:discoveryMatches,source_path:sourceMatches}});
 }
 scored.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
 const contextMatches=new Map();
 if(intent==='ambiguous'&&context==='all')for(const r of scored){const group=contextMatches.get(r.context)||new Set();group.add(r.source_id);contextMatches.set(r.context,group);}
 const context_options=[...contextMatches].map(([context,ids])=>({context,sources:ids.size})).sort((a,b)=>a.context.localeCompare(b.context));
 const seen=new Set(),results=[];
 for(const r of scored){if(seen.has(r.source_id))continue;seen.add(r.source_id);results.push(r);if(results.length===limit)break;}
 return{intent,results,context_options,suggested_routes:baseline==='enhanced'?suggestRoutes(index,q,{context}):[]};
}
