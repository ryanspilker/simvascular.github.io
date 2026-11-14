// Isolated experiment only. Pass records already selected by selectPilotRecords.
export function packageMentionExcerpt(text, name, limit=300) {
  const pattern=new RegExp('(^|[^A-Za-z0-9_])'+[...name].join('\\s*')+'(?=$|[^A-Za-z0-9_])','i');
  const hit=pattern.exec(text);if(!hit)return text.slice(0,limit);
  let start=Math.max(0,hit.index-70),end=Math.min(text.length,start+limit);
  if(start>0){const space=text.indexOf(' ',start);if(space>=0&&space-start<32)start=space+1;}
  if(end<text.length){const space=text.lastIndexOf(' ',end);if(space>start&&end-space<32)end=space;}
  return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
}
export function packageMentionResults(selectedRecords, registry, query, context='all') {
  const normalize=s=>String(s).replace(/\s+/gu,'').toLowerCase();
  if(registry?.schema_version!==1||!Array.isArray(registry.links))return null;
  const matching=registry.links.filter(r=>r?.status==='active'&&typeof r.package_name==='string'&&normalize(r.package_name)===normalize(query));
  const link=matching.length===1?matching[0]:null;
  if(!link)return null; // The caller retains its unchanged general-search path.
  if(!/^[A-Za-z0-9]+$/.test(link.package_name))return null;
  const pattern=new RegExp('(^|[^A-Za-z0-9_])'+[...link.package_name].join('\\s*')+'(?=$|[^A-Za-z0-9_])','i');
  const matches=selectedRecords.filter(r=>(!context||context==='all'||r.context===context)&&(pattern.test(r.title)||pattern.test(r.text)));
  // Prefer the passage over its duplicate overview; retain distinct destinations.
  matches.sort((a,b)=>Number(a.key.endsWith(':overview'))-Number(b.key.endsWith(':overview'))||a.key.localeCompare(b.key));
  const seen=new Set();
  return matches.filter(r=>{const id=r.source_id+'|'+r.href;if(seen.has(id))return false;seen.add(id);return true;}).slice(0,8);
}
