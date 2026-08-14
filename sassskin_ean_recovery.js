/* SASSKIN — EAN-13 recovery helper */
(function () {
  'use strict';
  const API='https://world.openbeautyfacts.org/cgi/search.pl';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-zа-яё0-9]+/gi,' ').replace(/\b(ml|мл|g|гр|oz)\b/g,' ').replace(/\s+/g,' ').trim();
  function similarity(a,b){
    const A=new Set(norm(a).split(' ').filter(x=>x.length>2));
    const B=new Set(norm(b).split(' ').filter(x=>x.length>2));
    if(!A.size||!B.size)return 0;
    let hit=0; A.forEach(x=>{if(B.has(x))hit++});
    return hit/Math.max(A.size,B.size);
  }
  const validEAN=v=>/^\d{13}$/.test(String(v||''));
  async function findEAN(p){
    const q=encodeURIComponent([p.brand,p.name].filter(Boolean).join(' '));
    const res=await fetch(`${API}?search_terms=${q}&search_simple=1&action=process&json=1&page_size=20`);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    const list=Array.isArray(data.products)?data.products:[];
    const scored=list.map(x=>{
      const name=x.product_name||x.product_name_en||'', brand=x.brands||'';
      return {x,score:similarity(p.name,name)*.85+(p.brand?similarity(p.brand,brand):0)*.15};
    }).sort((a,b)=>b.score-a.score);
    for(const r of scored){
      const code=String(r.x.code||'').replace(/\D/g,'');
      if(validEAN(code)&&r.score>=.72)return code;
    }
    return null;
  }
  async function recover(){
    if(!window.db||!Array.isArray(window.db.products)){alert('База товаров не найдена.');return}
    const list=window.db.products.filter(p=>!String(p.barcode||'').trim());
    if(!list.length){alert('Пустых штрихкодов нет.');return}
    const btn=document.getElementById('sassEanRecoverBtn'); if(btn)btn.disabled=true;
    let found=0;
    for(let i=0;i<list.length;i++){
      try{const code=await findEAN(list[i]); if(code){list[i].barcode=code;found++}}
      catch(e){}
      if(btn)btn.textContent=`EAN: ${found} найдено / ${i+1} из ${list.length}`;
      await sleep(450);
    }
    if(typeof window.save==='function')window.save();
    if(typeof window.renderAll==='function')window.renderAll();
    alert(`Готово.\n\nНайдено EAN-13: ${found}\nОстальные не найденные не изменены.`);
    if(btn){btn.disabled=false;btn.textContent='Восстановить EAN-13'}
  }
  function install(){
    if(document.getElementById('sassEanRecoverBtn'))return;
    const settings=document.getElementById('settings'); if(!settings)return;
    const card=settings.querySelector('.card'); if(!card)return;
    const box=document.createElement('div'); box.className='notice'; box.style.marginTop='14px';
    box.innerHTML='<b>Восстановление штрихкодов</b><div class="small" style="margin:6px 0 10px">Ищет EAN-13 в открытой базе Open Beauty Facts и заполняет только пустые поля при сильном совпадении.</div><button class="primary" id="sassEanRecoverBtn">Восстановить EAN-13</button>';
    card.appendChild(box);
    document.getElementById('sassEanRecoverBtn').onclick=recover;
  }
  install(); setTimeout(install,500); setTimeout(install,1500);
})();
