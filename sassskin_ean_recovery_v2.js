/* SASSKIN EAN recovery v2: uses window.SASS_PRODUCTS */
(function(){
'use strict';
const API='https://world.openbeautyfacts.org/cgi/search.pl', sleep=m=>new Promise(r=>setTimeout(r,m));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-zа-яё0-9]+/gi,' ').replace(/\b(ml|мл|g|гр|oz)\b/g,' ').replace(/\s+/g,' ').trim();
function sim(a,b){const A=new Set(norm(a).split(' ').filter(x=>x.length>2)),B=new Set(norm(b).split(' ').filter(x=>x.length>2));if(!A.size||!B.size)return 0;let h=0;A.forEach(x=>B.has(x)&&(h++));return h/Math.max(A.size,B.size)}
const ean=v=>/^\d{13}$/.test(String(v||''));
function list(){return Array.isArray(window.SASS_PRODUCTS)?window.SASS_PRODUCTS:(window.db&&Array.isArray(window.db.products)?window.db.products:null)}
async function find(p){
 const u=API+'?search_terms='+encodeURIComponent([p.brand,p.name,p.volume].filter(Boolean).join(' '))+'&search_simple=1&action=process&json=1&page_size=30';
 const r=await fetch(u);if(!r.ok)throw Error(r.status);const d=await r.json(),a=Array.isArray(d.products)?d.products:[];
 a.sort((x,y)=>(sim(p.name,y.product_name||y.product_name_en||'')*.82+(p.brand?sim(p.brand,y.brands||'')*.18:0))-(sim(p.name,x.product_name||x.product_name_en||'')*.82+(p.brand?sim(p.brand,x.brands||'')*.18:0)));
 for(const x of a){const c=String(x.code||'').replace(/\D/g,'');if(ean(c)&&sim(p.name,x.product_name||x.product_name_en||'')*.82+(p.brand?sim(p.brand,x.brands||'')*.18:0)>=.72)return c}
 return '';
}
async function run(){
 const ps=list();if(!ps){alert('База товаров не найдена.');return}
 const empty=ps.filter(p=>!String(p.barcode||'').trim());if(!empty.length){alert('Пустых штрихкодов нет.');return}
 const b=document.getElementById('sassEanRecoverBtn');if(b)b.disabled=true;let n=0;
 for(let i=0;i<empty.length;i++){try{const c=await find(empty[i]);if(c){empty[i].barcode=c;n++}}catch(e){}if(b)b.textContent=`EAN: ${n} найдено / ${i+1} из ${empty.length}`;await sleep(400)}
 window.SASS_PRODUCTS=ps;
 for(const k of ['save','saveDB','saveData','persist','persistDB']){try{if(typeof window[k]==='function'){window[k]();break}}catch(e){}}
 try{localStorage.setItem('sassskin_ean_backup',JSON.stringify(ps))}catch(e){}
 try{if(typeof window.renderAll==='function')window.renderAll()}catch(e){}
 alert(`Готово.\\n\\nНайдено EAN-13: ${n}\\nНе найдено: ${empty.length-n}`);
 if(b){b.disabled=false;b.textContent='Восстановить EAN-13'}
}
function install(){if(document.getElementById('sassEanRecoverBtn'))return;const s=document.getElementById('settings'),c=s&&s.querySelector('.card');if(!c)return;const x=document.createElement('div');x.className='notice';x.innerHTML='<b>Восстановление EAN-13</b><div class="small" style="margin:6px 0 10px">Ищет EAN-13 по бренду и названию.</div><button class="primary" id="sassEanRecoverBtn">Восстановить EAN-13</button>';c.appendChild(x);document.getElementById('sassEanRecoverBtn').onclick=run}
install();setTimeout(install,500);setTimeout(install,1500);setTimeout(install,3000);
})();