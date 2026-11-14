// Single candidate class: verbal launch requests expressed with a process count.
// Baseline engine, records, source IDs, excerpts and expectations are unchanged.
import * as base from './baseline.mjs';
export const createIndex=base.createIndex;
export const classifyQuery=base.classifyQuery;
const count=/(?:\b\d+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|multiple|many))\s+(?:(?:mpi|cpu)\s+)?(?:process(?:es)?|ranks?|cores?|processors?)\b/i;
const launch=/\b(?:launch|run|running|start|execute|executing)\b/i;
const software=/\b(?:solver|svmultiphysics|mpi|mpiexec)\b/i;
const otherSolver=/\b(?:0d|1d|svzerodsolver|sv1dsolver|zero-dimensional|one-dimensional)\b/i;
export function search(index,q,options={}){
 const original=base.search(index,q,options);
 if(options.baseline&&options.baseline!=='enhanced'||original.intent!=='normal'||!count.test(q)||!launch.test(q)||!software.test(q)||otherSolver.test(q))return original;
 const context=options.context||'all',support=[];
 // Authored CamelCase tool names identify explicit alternative software.
 const names=new Set([...index.groups.values()].flatMap(rows=>rows.flatMap(r=>r.title.match(/\b[A-Za-z]*[a-z][A-Z][A-Za-z]+\b/g)||[])));
 for(const name of names)if(name.toLowerCase()!=='svmultiphysics'&&new RegExp('\\b'+name+'\\b','i').test(q))return original;
 for(const rows of index.groups.values())for(const r of rows){
  if(context!=='all'&&r.context!==context||r.key.endsWith(':overview'))continue;
  const command=/\bmpiexec\s+-np\s+\S+\s+(\S+)/i.exec(r.text);
  if(!command||!/(?:svmultiphysics|svsolver)\b/i.test(command[1]))continue;
  if(!/\b(?:run|running|parallel|command|execution)\b/i.test(r.title))continue;
  const score=(/command line/i.test(r.title)?3:0)+(/parallel/i.test(r.title)?2:0)+(/\bcores?\b/i.test(r.text)?1:0);
  support.push({...r,score:Math.max(0,...original.results.map(x=>x.score||0))+1+score,retrieval_rule:{name:'authored-MPI-process-count-launch',command_excerpt:command[0],source:r.source,source_sha256:r.source_sha256}});
 }
 support.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
 if(!support.length)return original;
 const seen=new Set(),results=[];for(const r of [...support,...original.results]){if(seen.has(r.source_id))continue;seen.add(r.source_id);results.push(r);if(results.length===(options.limit||8))break;}
 return {...original,results,process_count_routing:{rule:'authored-MPI-process-count-launch',status:'experimental; no process count is chosen or changed',sources:support.map(r=>r.key)}};
}
