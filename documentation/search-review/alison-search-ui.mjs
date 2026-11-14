import {packageMentionResults,packageMentionExcerpt} from './remainder-mention-gate.mjs';
import {selectPilotRecords} from './scope-index.mjs';
import {taskNavigation,excludedClinicalQuery} from './task-navigation.mjs';
// Canonical-destination UI. All text is authored excerpt data, never HTML answers.
export function initializeSearch(base,{indexPath='search-records.json'}={}){
 const $=id=>document.getElementById(id),input=$('query'),context=$('context'),status=$('search-status'),list=$('search-results'),choices=$('context-choices');
 let engine,index,outline,loading,timer,selectedRecords,packageRegistry,failed=false,outsideScope=false;
 const state=()=>{const u=new URL(location.href);input.value=u.searchParams.get('q')||'';const requested=u.searchParams.get('context')||'all';context.value=requested;outsideScope=requested!=='all'&&context.value!==requested;if(outsideScope)context.value='all';};
 const address=(push=false)=>{const u=new URL(location.href);input.value.trim()?u.searchParams.set('q',input.value.trim()):u.searchParams.delete('q');context.value==='all'?u.searchParams.delete('context'):u.searchParams.set('context',context.value);history[push?'pushState':'replaceState']({},'',u);};
 const load=()=>loading||=Promise.all([import('./engine/adapter.mjs'),fetch(new URL(indexPath,base)).then(r=>{if(!r.ok)throw Error('Index unavailable');return r.json();}),fetch(new URL('alison-outline-map.json',base)).then(r=>{if(!r.ok)throw Error('Outline unavailable');return r.json();}),fetch(new URL('pilot-scope.json',base)).then(r=>{if(!r.ok)throw Error('Scope unavailable');return r.json();}),fetch(new URL('capability-links.json',base)).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([e,d,m,s,registry])=>{const records=selectPilotRecords(d,m,s);selectedRecords=records;packageRegistry=registry;if(m.source_commit!==d.source_commit||records.some(r=>!/^source-[a-f0-9]{16}$/.test(m.documents[r.source_id]?.outline_anchor)||document.getElementById(m.documents[r.source_id]?.outline_anchor)?.dataset.sourceId!==r.source_id||m.documents[r.source_id]?.source_sha256!==r.source_sha256||m.documents[r.source_id]?.source_path!==r.source||m.documents[r.source_id]?.website_url!==r.original_url))throw Error('Outline/source binding mismatch');engine=e;outline=m;index=e.createIndex(records);}).catch(()=>{failed=true;});
 function locationNote(r){const location=document.createElement('small');location.className='outline-location';location.textContent='Location in contents: '+outline.documents[r.source_id].trail.join(' › ');const jump=document.createElement("a");jump.href="#"+outline.documents[r.source_id].outline_anchor;jump.className="contents-jump";jump.textContent="Show in contents";location.append(document.createTextNode(" · "),jump);return location;}
 function destinationText(r){return (r.draft_excerpt?'Draft excerpt · ':'')+'Opens: '+(r.destination_precision==='authored_section'?'the matching authored section':r.destination_precision==='authored_parent_section'?'its parent section; the excerpt is within it':'a broader source section; use Find on the page')+' · '+r.context+(r.token?' · '+r.token:'')+(r.draft_excerpt?' · Published link shows the base version':'')+(outline.documents[r.source_id].applicability_note?' · '+outline.documents[r.source_id].applicability_note:'');}
 function render(){
  const navigation=$('task-navigation');if(navigation){navigation.replaceChildren();navigation.hidden=true;}
  list.replaceChildren();choices.replaceChildren();choices.hidden=true;const q=input.value.trim();
  if(outsideScope){status.textContent='This topic is outside the current search pilot. Choose a listed topic or browse the contents.';return;}
  if(!q){status.textContent='Search exact settings or words in the documentation. For broad questions, choose a software topic.';return;}
  if(failed){status.textContent='Search is unavailable. You can still browse the contents below.';return;}
  if(!index){status.textContent='Loading the local documentation index…';return;}
  const matches=packageRegistry?packageMentionResults(selectedRecords,packageRegistry,q,context.value):null;const result=matches===null?engine.search(index,q,{context:context.value,limit:8,variant:new URL(location.href).searchParams.get('ranking')==='candidate'?'candidate':'baseline'}):{intent:'registered-package-mention',results:matches};const packageName=matches===null?null:packageRegistry.links.find(r=>r.status==='active'&&r.package_name.replace(/\s+/g,'').toLowerCase()===q.replace(/\s+/g,'').toLowerCase()).package_name;
  const messages={'exact-setting-not-found':'No exact setting or identifier with that name was found in this topic. Check the spelling, choose another topic, or use the contents below.','empty':'Enter a word or exact setting name.','no-terms':'Enter a word or exact setting name.','too-long':'Please use 240 characters or fewer.','unsupported-guarantee':'Search can find documentation, but cannot establish clinical safety or a diagnostic guarantee.'};
  if(navigation&&matches===null&&result.intent==='normal'){
   for(const group of taskNavigation(selectedRecords,outline,q,{context:context.value})){
    const heading=document.createElement('h2'),kind=document.createElement('small'),note=document.createElement('p'),routes=document.createElement('ul');
    heading.textContent=group.title;kind.textContent='Suggested routes · separate from matching source excerpts';note.textContent=group.note;
    for(const route of group.routes){const li=document.createElement('li'),a=document.createElement('a');a.textContent=route.label;a.href=route.record.href;li.append(a,locationNote(route.record));routes.append(li);}
    navigation.append(heading,kind,note,routes);navigation.hidden=false;
   }
  }
  if(messages[result.intent]){
   status.textContent=messages[result.intent];
   if(result.intent==='exact-setting-not-found'&&result.related_results?.length){
    status.textContent+=' Related authored text matches, not exact identifier matches:';
    for(const r of result.related_results){const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');a.href=r.href;a.textContent=r.title;p.textContent=engine.excerpt(r.text,q);const destination=document.createElement('small');destination.textContent=destinationText(r);li.append(a,locationNote(r),p,destination);list.append(li);}
   }
   return;
  }
  if(result.context_options?.length&&context.value==='all'){
   choices.hidden=false;
   for(const option of result.context_options){const b=document.createElement('button');b.type='button';b.textContent=option.context;b.onclick=()=>{context.value=option.context;address(true);render();context.focus();};choices.append(b);}
  }
  status.textContent=result.results.length?'Matching source excerpts. Results open existing documentation pages.':'No matching excerpt found. Try a shorter term, select a software topic, or use the contents below.';
  if(result.intent==='registered-package-mention')status.textContent=result.results.length?'Authored passages naming this software project.':'No indexed passage names this software project in this topic. The related software link opens separate project documentation.';
  if(result.intent==='ambiguous'&&context.value==='all')status.textContent='This term spans several topics. Choose one above or make the search more specific.';
  if(result.intent==='normal'&&excludedClinicalQuery(q))status.textContent='Clinical case instructions are outside this search pilot. Any matches below are general documentation excerpts, not a verified clinical-case procedure.';
  const shown=new Set();
  for(const r of result.results){
   if(shown.has(r.href))continue;shown.add(r.href);
   const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p'),meta=document.createElement('small');
   a.href=r.href;a.textContent=r.title;
   p.textContent=packageName?packageMentionExcerpt(r.text,packageName):engine.excerpt(r.text,q);
   meta.textContent=destinationText(r);
   li.append(a);
   if(r.phrase_match_reason?.authored_excerpt){const reason=document.createElement('small');reason.className='match-reason';reason.textContent='Matched phrase in documentation: “'+r.phrase_match_reason.authored_excerpt+'”.';li.append(reason);}
   li.append(locationNote(r),p,meta);list.append(li);
  }
 }
 async function run(){render();if(outsideScope)return;if(input.value.trim()&&!index&&!failed){await load();render();}}
 $('search-form').addEventListener('submit',e=>{e.preventDefault();outsideScope=false;clearTimeout(timer);address(true);run();});
 input.addEventListener('input',()=>{outsideScope=false;clearTimeout(timer);timer=setTimeout(()=>{address();run();},180);});
 input.addEventListener('focus',()=>load(),{once:true});context.addEventListener('change',()=>{outsideScope=false;address(true);run();});
 $('clear-search').onclick=()=>{outsideScope=false;input.value='';address();render();input.focus();};addEventListener('popstate',()=>{state();run();});state();const ready=run();return{input,context,ready};
}
