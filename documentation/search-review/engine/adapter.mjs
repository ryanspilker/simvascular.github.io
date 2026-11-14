// Existing UI-compatible interface; retained ranking is still the default.
// This review copy adds one conservative plural vocabulary normalization.
import * as baseline from './baseline/search/site-search.mjs';
import * as candidate from './candidate.mjs';
import {selectPilotRecords} from './baseline/scope-index.mjs';
import {packageMentionResults,packageMentionExcerpt} from './baseline/remainder-mention-gate.mjs';
export const createIndex=baseline.createIndex, classifyQuery=baseline.classifyQuery, excerpt=baseline.excerpt;
export function search(index,query,{variant='baseline',...options}={}){
 if(!['baseline','candidate'].includes(variant))throw Error('Unknown ranking variant');
 const engine=variant==='candidate'?candidate:baseline;
 // Do not rewrite XML-like identifiers, non-normal intents, or comparison modes.
 // This is a finite vocabulary mapping, not a general stemmer or source-ID boost.
 const normalized=baseline.classifyQuery(query)==='normal'&&!query.includes('_')&&
  (!options.baseline||options.baseline==='enhanced')
  ?query.replace(/\bresistances\b/gi,'resistance'):query;
 const result=engine.search(index,normalized,options);
 return normalized===query?result:{...result,query_normalization:{
  rule:'resistance-plural-vocabulary',original_query:query,normalized_query:normalized,
  notice:'Retrieval vocabulary only; authored excerpts, links and source scope unchanged.'
 }};
}
// For direct consumers that also need the existing scope and full-name gate.
// The current copied UI may keep its own unchanged gate before calling search.
export function createScopedReviewAdapter(data,outline,policy,registry,{variant='baseline'}={}){
 const records=selectPilotRecords(data,outline,policy),index=createIndex(records);
 return {records,index,search(query,options={}){
  const matches=packageMentionResults(records,registry,query,options.context||'all');
  return matches===null?search(index,query,{...options,variant}):{intent:'registered-package-mention',results:matches};
 },excerpt(record,query){
  const matches=packageMentionResults(records,registry,query,'all');
  const name=matches===null?null:registry.links.find(r=>r.status==='active'&&r.package_name.replace(/\s+/g,'').toLowerCase()===query.replace(/\s+/g,'').toLowerCase())?.package_name;
  return name?packageMentionExcerpt(record.text,name):excerpt(record.text,query);
 }};
}
