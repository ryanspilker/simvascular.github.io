// Curated navigation, separate from ranked authored excerpts and scientific answers.
import {classifyQuery} from './search/pilot-search-accepted.mjs';

export function excludedClinicalQuery(query) {
 // Only explicitly named excluded clinical routes; not a general anatomy classifier.
 return /\b(?:clinical\s+(?:cases?|examples?|tutorials?|instructions?)|coronar(?:y|ies)|aortofemoral\w*)\b/i.test(query);
}

export function taskNavigation(records, outline, query, {context='all'}={}) {
 const q=String(query).normalize('NFKC').trim();
 if(classifyQuery(q)!=='normal'||q.includes('_')||excludedClinicalQuery(q))return [];
 const compare=/\bsteady\b/i.test(q)&&/\b(?:pulsatile|unsteady)\b/i.test(q)&&
  /\b(?:same|different|difference|compare|versus|vs|instead|transition|switch|start(?:ing)?|initiali[sz]\w*)\b/i.test(q);
 const beginner=/\b(?:beginner|beginners|new\s+to|first\s+(?:time|simulation)|getting\s+started|where\s+(?:should|do|can)\s+i\s+(?:start|begin)|how\s+(?:should|do|can)\s+i\s+(?:start|begin))\b/i.test(q)&&
  /\b(?:cfd|simvascular|simulation|vascular\s+modeling)\b/i.test(q)&&
  !/\bnot\s+(?:a\s+)?(?:beginner|new)\b/i.test(q);
 const def=compare?{
  id:'steady-pulsatile',title:'Steady and pulsatile examples',
  note:'These routes compare the documented setups. They do not establish a verified steady-to-pulsatile initialization procedure.',
  routes:[['DOC163','Steady flow with resistance outlets'],['DOC171','Pulsatile flow with RCR outlets']]
 }:beginner?{
  id:'beginner',title:'Simulation starting points',
  note:'Choose the GUI workflow when building a model, or the CFD User Guide when starting from an existing mesh.',
  routes:[['DOC059','Getting Started · SimVascular GUI'],['DOC163','svMultiPhysics · prepared-mesh example']]
 }:null;
 if(!def)return [];
 const routes=def.routes.flatMap(([id,label])=>{
  const record=records.find(r=>r.source_id===id&&r.key===id+':0');
  const binding=outline.documents[id];
  if(!record||!binding||record.source_sha256!==binding.source_sha256||
   (context!=='all'&&record.context!==context))return [];
  return [{label,record}];
 });
 // A comparison requires both examples; filtered beginner routes may stand alone.
 if(!routes.length||(compare&&routes.length!==2))return [];
 return [{...def,routes}];
}
