export const normalizePackageName=q=>String(q).replace(/\s+/gu,'').toLowerCase();
export function relatedSoftwareLinks(registry,q){
 if(registry?.schema_version!==1||!Array.isArray(registry.links))return [];
 const key=normalizePackageName(q);
 if(!key)return [];
 return registry.links.filter(r=>r?.status==='active'&&typeof r.package_name==='string'&&normalizePackageName(r.package_name)===key);
}
