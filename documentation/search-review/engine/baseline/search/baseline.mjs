// Isolated general rule: keep the accepted document ranking. When the query
// explicitly names exactly one authored software/workflow context, select its
// destination section using the remaining task words instead of the repeated
// context-name words. No source IDs, expected anchors or query phrases are used.
import * as accepted from './pilot-search-accepted.mjs';
export function createIndex(records){
 const groups=new Map();for(const r of records){const g=groups.get(r.source_id)||[];g.push(r);groups.set(r.source_id,g);}
 return {raw:accepted.createIndex(records),groups,contexts:[...new Set(records.map(r=>r.context).filter(Boolean))]};
}
function sectionSearch(index,q,options={}){
 const literal=accepted.search(index.raw,q,options);
 if(options.baseline&&options.baseline!=='enhanced'||literal.intent!=='normal'||/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(q)||/^DOC\d+$/i.test(q))return literal;
 const query=new Set(accepted.tokens(q));
 const explicit=index.contexts.map(context=>({context,terms:[...new Set(accepted.tokens(context))]})).filter(c=>c.terms.length&&c.terms.every(t=>query.has(t)));
 if(explicit.length!==1)return literal;
 const chosen=explicit[0],contextWords=new Set(chosen.terms),task=[...query].filter(t=>!contextWords.has(t)).join(' ');
 if(!task)return literal;
 return {...literal,results:literal.results.map(r=>{
  if(r.context!==chosen.context)return r;
  const sections=index.groups.get(r.source_id).filter(s=>!s.key.endsWith(':overview'));
  if(!sections.length)return r;
  const target=accepted.search(accepted.createIndex(sections),task,{context:r.context,limit:1}).results[0];
  if(!target)return r;
  return {...target,score:r.score,document_match_evidence:r.match_evidence,
   section_selection:{rule:'explicit-context-neutral-task-ranking',context:chosen.context,task_query:task,original_href:r.href,section_score:target.score}};
 })};
}
export const classifyQuery=accepted.classifyQuery;

// Appended to the unchanged section-aware engine by assemble-guard.mjs.
// This is conservative task routing, not medical intent understanding.
const diagnosticProblemWords=new Set(['error','errors','failure','failures','failed','crash','crashes','exception','exceptions','warning','warnings']);
const clinicalDiagnosticWords=/\b(patient|patients|clinical|medical|symptom|symptoms|disease|diseases|treatment|treatments|medication|medications|dose|doses|surgery|pain|doctor|physician)\b/i;
const personalSubject=/\b(my|our)\b|\b(this|the)\s+(patient|child|person)\b|\b(me|myself)\b/i;
const personalDecision=/\b(diagnos(?:e|is)|treat|prescribe|recommend|should|safe|treatment|medication|dose|operate|surgery)\b/i;
export function taskFindingPolicy(index,q,options={}){
 const base=accepted.classifyQuery(q);
 if(['empty','too-long'].includes(base))return{action:'unchanged',reason:base};
 if(/\b(guarantee|guaranteed|diagnosis)\b/i.test(q))return{action:'block',reason:'clinical-diagnosis-or-guarantee-restriction'};
 if(personalSubject.test(q)&&clinicalDiagnosticWords.test(q)&&personalDecision.test(q))return{action:'block',reason:'personal-clinical-decision-request'};
 if(!/\bdiagnose\b/i.test(q))return{action:'unchanged',reason:'ordinary-task-finding'};
 if(/\b(not|never|don't|dont)\b[^.!?;]{0,40}\bdiagnose\b/i.test(q))return{action:'block',reason:'negated-diagnostic-intent-not-reinterpreted'};
 if(clinicalDiagnosticWords.test(q))return{action:'block',reason:'clinical-or-mixed-diagnostic-language'};
 // A narrowly supported software object must follow the verb. An incidental
 // software mention elsewhere cannot sanitize a medical or ambiguous target.
 const after=q.slice(/\bdiagnose\b/i.exec(q).index+'diagnose'.length),target=accepted.tokens(after);
 const query=accepted.tokens(q).filter(t=>t!=='diagnose');
 if(!query.some(t=>diagnosticProblemWords.has(t)))return{action:'block',reason:'no-explicit-software-problem'};
 const explicitContext=options.context&&options.context!=='all'?options.context:null;
 const records=index.raw.items.map(i=>i.r),support=[];
 for(const r of records){
  if(explicitContext&&r.context!==explicitContext)continue;
  if(/clinical|references|template/i.test(r.context||''))continue;
  const title=accepted.tokens(r.title),component=title.filter(t=>!diagnosticProblemWords.has(t));
  if(!title.some(t=>diagnosticProblemWords.has(t))||!component.length)continue;
  // Two literal component tokens, or a selected authored context, prevent a
  // generic heading such as 'Errors' from approving any diagnostic question.
  if(component.length<2&&!explicitContext)continue;
  if(!component.every((t,i)=>target[i]===t))continue;
  const vocabulary=new Set(records.filter(o=>o.context===r.context).flatMap(o=>accepted.tokens(o.title+' '+o.text+' '+o.context)));
  const requestWords=new Set(['diagnose','help','find','understand','identify','explain']);
  const unsupported=query.filter(t=>!vocabulary.has(t)&&!requestWords.has(t));
  if(unsupported.length)continue;
  support.push({key:r.key,source_id:r.source_id,source:r.source,source_sha256:r.source_sha256,href:r.href,title:r.title,context:r.context,component_terms:component});
 }
 if(!support.length)return{action:'block',reason:'diagnostic-target-not-supported-by-authored-software-section'};
 const cleaned=q.replace(/\bdiagnose\b/ig,'find');
 const contexts=new Map();for(const s of support){const ids=contexts.get(s.context)||new Set();ids.add(s.source_id);contexts.set(s.context,ids);}
 if(contexts.size>1)return{action:'choose-context',reason:'authored-software-component-collision',support,context_options:[...contexts].map(([context,ids])=>({context,sources:ids.size})).sort((a,b)=>a.context.localeCompare(b.context))};
 return{action:'software-troubleshooting',reason:'source-backed-software-task-only',cleaned_query:cleaned,context:[...contexts.keys()][0],support};
}
export function search(index,q,options={}){
 if(options.baseline&&options.baseline!=='enhanced')return sectionSearch(index,q,options);
 const policy=taskFindingPolicy(index,q,options);
 if(policy.action==='block')return accepted.classifyQuery(q)==='unsupported-guarantee'?sectionSearch(index,q,options):{intent:'unsupported-guarantee',results:[],query_policy:policy};
 if(policy.action==='choose-context')return{intent:'ambiguous',results:[],suggested_routes:[],context_options:policy.context_options,query_policy:policy};
 if(policy.action!=='software-troubleshooting')return sectionSearch(index,q,options);
 const result=sectionSearch(index,policy.cleaned_query,{...options,context:policy.context});
 return{...result,intent:'technical-troubleshooting',query_policy:{...policy,notice:'Authored software troubleshooting excerpts only. No medical diagnosis, generated answer or verified repair is provided.'}};
}
