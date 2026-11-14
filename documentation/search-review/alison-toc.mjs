import {initializeSearch} from './alison-search-ui.mjs?v=nov14-review-1';
const {ready}=initializeSearch(new URL('./',import.meta.url));
function contentsTarget(hash){
 let id;try{id=decodeURIComponent(hash.replace(/^#/,''));}catch{return false;}
 if(!/^source-[a-f0-9]{16}$/.test(id))return false;
 return document.getElementById(id)||false;
}
function revealContents(hash,{focus=false}={}){
 const target=contentsTarget(hash);if(!target)return false;
 for(let parent=target.parentElement;parent;parent=parent.parentElement){if(parent.tagName==='DETAILS')parent.open=true;}
 target.scrollIntoView({block:'center'});
 if(focus)target.querySelector('a')?.focus({preventScroll:true});
 return true;
}
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a.contents-jump');
 if(!link||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const hash=link.getAttribute('href');if(!contentsTarget(hash))return;
 event.preventDefault();const url=new URL(location.href);url.hash=hash;
 // Record the search position before scrolling to the outline, so native
 // Back restoration has the original result position to return to.
 history.pushState({},'',url);revealContents(hash,{focus:true});
});
addEventListener('popstate',()=>revealContents(location.hash));
ready.then(()=>{if(location.hash&&!revealContents(location.hash)){try{document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();}catch{}}});
