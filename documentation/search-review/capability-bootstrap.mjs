import {relatedSoftwareLinks} from './capability-route.mjs';
const input=document.getElementById('query'),form=document.getElementById('search-form'),status=document.getElementById('search-status');
const panel=document.createElement('section');panel.id='related-software-shortcuts';panel.hidden=true;panel.setAttribute('aria-labelledby','related-software-title');status.before(panel);
const documentationHeading=document.createElement('h2');documentationHeading.className='search-results-title';documentationHeading.textContent='Documentation results';status.before(documentationHeading);
let registry;
function render(){
 documentationHeading.hidden=!input.value.trim();
 panel.replaceChildren();const links=registry?relatedSoftwareLinks(registry,input.value):[];panel.hidden=!links.length;if(!links.length)return;
 const heading=document.createElement('h2'),note=document.createElement('p'),list=document.createElement('ul');heading.id='related-software-title';heading.className='search-results-title';heading.textContent='Related software links';note.textContent='Exact package-name shortcut to separate project documentation. These are not authored-excerpt results or a claim of GUI or external-documentation search coverage.';
 if(!document.getElementById('search-results').children.length&&/^No (?:matching excerpt|exact setting)/.test(status.textContent))note.textContent+=' No indexed passages matched this query; this does not mean no documentation exists.';
 for(const r of links){const li=document.createElement('li'),a=document.createElement('a'),meta=document.createElement('p');a.href=r.href;a.textContent=r.title+' · '+r.purpose;meta.textContent=r.destination+' · '+r.inspection_status;li.append(a,meta);list.append(li);}panel.append(heading,note,list);
}
fetch(new URL('./capability-links.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Registry unavailable');return r.json();}).then(r=>{registry=r;render();}).catch(()=>{panel.hidden=true;});
input.addEventListener('input',render);form.addEventListener('submit',render);addEventListener('popstate',render);document.getElementById('clear-search').addEventListener('click',render);

const observer=new MutationObserver(render);observer.observe(status,{childList:true,subtree:true,characterData:true});observer.observe(document.getElementById('search-results'),{childList:true});
