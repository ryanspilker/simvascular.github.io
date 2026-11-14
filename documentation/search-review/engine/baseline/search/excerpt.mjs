// Show a contiguous slice of authored text around query evidence. No rewriting,
// generated explanation, markup insertion, ranking change or source-ID rule.
import {tokens} from './pilot-search-accepted.mjs';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function excerpt(text,query,{limit=300}={}){
 text=String(text);if(text.length<=limit)return text;
 const terms=[...new Set(tokens(query).filter(t=>t.length>=3))],positions=[];
 for(const term of terms){const re=new RegExp('\\b'+escape(term)+'\\b','ig');let match,count=0;while((match=re.exec(text))&&count++<24)positions.push({at:match.index,term});}
 if(!positions.length)return text.slice(0,limit).trimEnd()+'…';
 let best={start:0,score:-1};
 for(const hit of positions){const start=Math.max(0,Math.min(text.length-limit,hit.at-80)),end=start+limit,seen=new Set(positions.filter(p=>p.at>=start&&p.at<end).map(p=>p.term)),score=seen.size;
  if(score>best.score||score===best.score&&start<best.start)best={start,score};
 }
 let start=best.start,end=Math.min(text.length,start+limit);
 if(start>0){const space=text.indexOf(' ',start);if(space>=0&&space-start<32)start=space+1;}
 if(end<text.length){const space=text.lastIndexOf(' ',end);if(space>start&&end-space<32)end=space;}
 return(start?'…':'')+text.slice(start,end).trim()+(end<text.length?'…':'');
}
