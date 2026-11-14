// Single ranking addition: whole-query phrase evidence within an authored field.
// Reranks only the records already returned by the unchanged retained engine.
import * as base from './baseline/search/site-search.mjs';
export const createIndex=base.createIndex, classifyQuery=base.classifyQuery, excerpt=base.excerpt;
const words=s=>[...String(s).matchAll(/[A-Za-z0-9]+/g)].map(m=>({word:m[0].toLowerCase(),start:m.index,end:m.index+m[0].length}));
function evidence(record,query){
 for(const field of ['title','text']){
  const body=words(record[field]);
  for(let i=0;i<=body.length-query.length;i++)if(query.every((t,j)=>t.word===body[i+j].word)){
   const start=body[i].start,end=body[i+query.length-1].end;
   return {priority:field==='title'?2:1,field,start,end,authored_excerpt:record[field].slice(start,end)};
  }
 }
 return {priority:0};
}
export function search(index,q,options={}){
 const original=base.search(index,q,options),query=words(q);
 if((options.baseline&&options.baseline!=='enhanced')||original.intent!=='normal'||q.length>240||query.length<2||/_/.test(q)||original.results.some(r=>r.exact))return original;
 const ranked=original.results.map((r,i)=>({r,i,evidence:evidence(r,query)})).sort((a,b)=>b.evidence.priority-a.evidence.priority||a.i-b.i);
 if(ranked.every((r,i)=>r.i===i))return original;
 return {...original,results:ranked.map(x=>({...x.r,phrase_match_reason:{rule:'whole-query-authored-field-phrase',baseline_rank:x.i+1,...x.evidence}})),ranking_candidate:{status:'Development experiment; no new candidate retrieval or scientific answer',rule:'Complete authored title phrase, then complete authored body phrase, then unchanged baseline order'}};
}
