// One explicit local pilot policy drives both outline and search membership.
export function selectPilotRecords(data,outline,policy){
 if(policy.schema_version!==1||policy.policy_id!==outline.scope_policy_id||policy.source_commit!==data.source_commit||outline.source_commit!==data.source_commit)throw Error('Pilot scope version mismatch');
 const allowed=new Set(),seen=new Set(),records=[];
 for(const entry of Object.values(policy.entries)){
  if(!['include','defer','template','retired'].includes(entry.status))throw Error('Unknown pilot status');
  if(entry.status==='include')allowed.add(entry.source_id);
 }
 if(!allowed.size||Object.keys(outline.documents).length!==allowed.size||[...allowed].some(id=>!outline.documents[id]))throw Error('Pilot scope and outline disagree');
 for(const r of data.records){
  if(r.context==='template')continue;
  const entry=policy.entries[r.source];
  if(!entry||entry.source_id!==r.source_id||entry.source_sha256!==r.source_sha256)throw Error('Unreviewed or changed source record');
  if(entry.status!=='include')continue;
  records.push(r);seen.add(r.source_id);
 }
 if(seen.size!==allowed.size||[...allowed].some(id=>!seen.has(id)))throw Error('Included source missing from index');
 return records;
}
