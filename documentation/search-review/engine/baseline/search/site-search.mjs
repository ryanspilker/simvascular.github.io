// Keep the retained ranking engine. Treat an entire XML-like literal as a
// literal lookup so a nonexistent name cannot masquerade as a setting match.
import * as base from './temporal-profile.mjs';
import {tokens} from './pilot-search-accepted.mjs';
export const classifyQuery=base.classifyQuery;
export {excerpt} from './excerpt.mjs';
export function createIndex(records){
 const literals=new Map(),groups=new Map(),df=new Map();
 for(const r of records)for(const hit of (r.title+' '+r.text).matchAll(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g)){
  const value=hit[0].toLowerCase(),contexts=literals.get(value)||new Set();contexts.add(r.context);literals.set(value,contexts);
 }
 for(const r of records){const terms=groups.get(r.source_id)||new Set();for(const term of tokens(r.text))terms.add(term);groups.set(r.source_id,terms);}
 for(const terms of groups.values())for(const term of terms)df.set(term,(df.get(term)||0)+1);
 return{base:base.createIndex(records),literals,df,documents:groups.size};
}
export function search(index,q,options={}){
 const normalized=q.trim().replace(/^<\/?|>$/g,'');
 if(q.length<=240&&/^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+$/.test(normalized)){
  const contexts=index.literals.get(normalized.toLowerCase());const available=contexts&&(!options.context||options.context==='all'||contexts.has(options.context));
  if(!available){
   // Historical or differently named identifiers may still have meaningful
   // component text. Keep only explicitly labelled related excerpts supported
   // by at least two uncommon literal terms; never call them exact settings.
   const terms=[...new Set(tokens(normalized))].filter(t=>index.df.has(t)&&index.df.get(t)<=index.documents*.1);
   const related=terms.length>=2?base.search(index.base,q,options).results.filter(r=>{const body=new Set(tokens(r.text));return terms.filter(t=>body.has(t)).length>=2;}):[];
   return{intent:'exact-setting-not-found',results:[],literal:normalized,related_results:related};
  }
 }
 return base.search(index.base,q,options);
}
