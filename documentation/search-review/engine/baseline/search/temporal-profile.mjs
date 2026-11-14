// Contextual vocabulary normalization for coupled inlet timing/profile queries.
// Delegates ranking to the frozen process-count candidate; no destination IDs.
import * as base from './process-count.mjs';
import {tokens} from './pilot-search-accepted.mjs';
export const createIndex=base.createIndex;
export const classifyQuery=base.classifyQuery;

export function search(index,q,options={}){
 const original=base.search(index,q,options);
 if((options.baseline&&options.baseline!=='enhanced')||original.intent!=='normal')return original;
 const inlet=/\b(?:inlet|inflow|entrance)\b/i.test(q);
 const spatial=/\bprofile\b/i.test(q)&&/\b(?:uniform|flat|parabolic|spatial|across)\b/i.test(q);
 const temporal=/\b(?:unsteady|pulsatile|pulsating|temporal)\b|\btime[ -](?:dependent|varying)\b|\b(?:varying|changing|varies|changes)\b[^.!?;]{0,45}\b(?:over|with|in)\s+time\b/i.test(q);
 if(!inlet||!spatial||!temporal)return original;
 // Qualify the vocabulary against authored inlet XML, not document identity.
 const support=[...index.groups.values()].flat().filter(r=>
  !r.key.endsWith(':overview')&&/\b(?:inlet|inflow)\b/i.test(r.text)&&
  /<Time_dependence>\s*Unsteady\s*<\/Time_dependence>/i.test(r.text)&&
  /<Profile>\s*Flat\s*<\/Profile>/i.test(r.text));
 const contexts=new Set(support.map(r=>r.context)),queryTerms=new Set(tokens(q));
 if(!support.length||(options.context&&options.context!=='all'&&!contexts.has(options.context)))return original;
 const explicit=index.contexts.filter(c=>tokens(c).every(t=>queryTerms.has(t)));
 if(explicit.some(c=>!contexts.has(c)))return original;
 // Named tools also appear in titles without being their own context labels.
 const toolNames=new Set([...index.groups.values()].flat().flatMap(r=>r.title.match(/\b[A-Za-z]*[a-z][A-Z][A-Za-z]+\b/g)||[]));
 for(const name of toolNames)if(![...contexts].some(c=>c.toLowerCase()===name.toLowerCase())&&new RegExp('\\b'+name+'\\b','i').test(q))return original;
 const normalized=q.replace(/\buniform\b/ig,'flat').replace(/\bentrance\b/ig,'inlet')+' unsteady temporal spatial';
 // Preserve the original engine's query-length contract after expansion.
 if(normalized.length>240)return original;
 const result=base.search(index,normalized,options);
 return {...result,query_normalization:{rule:'inlet-temporal-spatial-vocabulary',original_query:q,normalized_query:normalized,
  support:support.map(r=>({key:r.key,source:r.source,source_sha256:r.source_sha256})),
  notice:'Retrieval terms only; authored excerpts and source ranking engine retained.'}};
}
