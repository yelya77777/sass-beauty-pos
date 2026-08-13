/* SASSKIN POS V3 — payment wiring + stock/product/sales fixes
   Load after sassskin_pos_updates.js and sassskin_pos_updates_v2.js.
   Does not replace the database or camera implementation.
*/
(function(){
'use strict';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0));
const esc3=v=>(typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
function bindPayment(){
  document.querySelectorAll('.pay button').forEach(b=>{
    b.onclick=function(e){
      e.preventDefault();
      if(typeof window.sk4Checkout==='function') window.sk4Checkout();
      else if(typeof window.sassCheckout==='function') window.sassCheckout();
    };
  });
}
function sk4PaymentModal(finalAmount, done){
  const html=`<div class="form">
    <div class="notice">К оплате: <b>${money(finalAmount)} ₸</b></div>
    <div class="sk4-pay-tabs">
      <button type="button" id="sk4CashTab" class="active">💵 Наличные</button>
      <button type="button" id="sk4KaspiTab">💳 Kaspi</button>
      <button type="button" id="sk4MixedTab">↔️ Смешанная</button>
    </div>
    <div id="sk4PayBody"></div>
    <div class="actions"><button class="primary" id="sk4Confirm">Провести продажу</button><button class="secondary" onclick="closeModal()">Отмена</button></div>
  </div>`;
  modal('Оплата',html);
  const body=$('sk4PayBody'); let mode='cash';
  function draw(){
    if(mode==='cash') body.innerHTML=`<label>Клиент дал наличными<input id="sk4Received" type="number" min="0" inputmode="numeric" value="${finalAmount}"></label><div class="sk4-change">Сдача: <b id="sk4Change">0</b> ₸</div>`;
    if(mode==='kaspi') body.innerHTML=`<div class="notice">Клиент оплачивает всю сумму <b>${money(finalAmount)} ₸</b> через Kaspi.</div>`;
    if(mode==='mixed') body.innerHTML=`<label>Kaspi<input id="sk4Kaspi" type="number" min="0" max="${finalAmount}" inputmode="numeric" value="0"></label><div class="notice">Наличные по чеку: <b id="sk4CashDue">${money(finalAmount)} ₸</b></div><label>Клиент дал наличными<input id="sk4Received" type="number" min="0" inputmode="numeric" value="${finalAmount}"></label><div class="sk4-change">Сдача: <b id="sk4Change">0</b> ₸</div>`;
    const received=$('sk4Received');
    if(received) received.oninput=calc;
    const k=$('sk4Kaspi'); if(k) k.oninput=calc;
    calc();
  }
  function calc(){
    if(mode==='cash'){
      const r=Number(($('sk4Received')||{}).value||0); const ch=Math.max(0,r-finalAmount);
      if($('sk4Change'))$('sk4Change').textContent=money(ch);
    } else if(mode==='mixed'){
      const k=Math.min(finalAmount,Math.max(0,Number(($('sk4Kaspi')||{}).value||0))); const cash=finalAmount-k; const r=Number(($('sk4Received')||{}).value||0);
      if($('sk4CashDue'))$('sk4CashDue').textContent=money(cash)+' ₸';
      if($('sk4Change'))$('sk4Change').textContent=money(Math.max(0,r-cash));
    }
  }
  function setMode(m){mode=m;['sk4CashTab','sk4KaspiTab','sk4MixedTab'].forEach(id=>$(id).classList.remove('active'));$(m==='cash'?'sk4CashTab':m==='kaspi'?'sk4KaspiTab':'sk4MixedTab').classList.add('active');draw();}
  $('sk4CashTab').onclick=()=>setMode('cash'); $('sk4KaspiTab').onclick=()=>setMode('kaspi'); $('sk4MixedTab').onclick=()=>setMode('mixed'); draw();
  $('sk4Confirm').onclick=()=>{
    if(mode==='cash'){
      const r=Number(($('sk4Received')||{}).value||0); if(r<finalAmount)return alert('Клиент дал меньше суммы чека.'); return done({cash:finalAmount,kaspi:0,card:0,cashReceived:r,change:r-finalAmount});
    }
    if(mode==='kaspi') return done({cash:0,kaspi:finalAmount,card:0,cashReceived:0,change:0});
    const k=Math.min(finalAmount,Math.max(0,Number(($('sk4Kaspi')||{}).value||0))); const cash=finalAmount-k; const r=Number(($('sk4Received')||{}).value||0);
    if(r<cash)return alert('Клиент дал меньше наличных, чем нужно.');
    return done({cash,kaspi:k,card:0,cashReceived:r,change:r-cash});
  };
}
window.sk4Checkout=function(){
  if(!Array.isArray(window.cart)||!cart.length)return alert('Корзина пуста.');
  if(typeof discount!=='undefined' && discount.type==='percent' && Number(discount.value||0)>20){const pin=prompt('PIN владельца');if(pin!==db.pin)return alert('Неверный PIN');}
  const subtotal=typeof sassRawTotal==='function'?sassRawTotal():cart.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||0),0);
  const disc=typeof discountAmount==='function'?discountAmount(subtotal):0; const final=Math.max(0,subtotal-disc);
  sk4PaymentModal(final,payment=>{
    cart.forEach(x=>{const p=db.products.find(y=>y.id===x.id);if(p)p.stock=Math.max(0,Number(p.stock||0)-Number(x.qty||0));});
    const customer=db.customers.find(c=>c.id===selectedCustomerId);
    const sale={no:db.seq++,time:new Date().toISOString(),customerId:customer?.id||null,
      items:cart.map(x=>{const p=db.products.find(y=>y.id===x.id);return{id:p.id,name:p.name,qty:x.qty,price:typeof itemPrice==='function'?itemPrice(x):Number(x.price||0),cost:Number(p.cost||0),priceMode:x.priceMode};}),
      subtotal,discount:disc,total:final,method:payment.cash>0&&payment.kaspi>0?'Смешанная':payment.cash>0?'Наличные':'Kaspi',payments:payment};
    db.sales.unshift(sale); if(customer){customer.lastSale=sale.time;customer.total=(customer.total||0)+final;customer.orders=(customer.orders||0)+1;}
    if(typeof save==='function')save(); if(typeof closeModal==='function')closeModal(); cart=[]; selectedCustomerId=null;
    if(typeof discount!=='undefined')discount={type:'percent',value:0}; if($('disc'))$('disc').value='';
    if(typeof renderAll==='function')renderAll(); else if(typeof sassRerender==='function')sassRerender();
    alert('Продажа проведена\nЧек #'+sale.no+'\n'+money(final)+' ₸');
  });
};
function bindStock(){
  const r=$('receiveBtn'), w=$('writeoffBtn');
  if(r) r.onclick=()=>typeof sassStockMove==='function'?sassStockMove(1):null;
  if(w) w.onclick=()=>typeof sassStockMove==='function'?sassStockMove(-1):null;
}
function brandStats(){
  const stock=$('stock'); if(!stock)return;
  let box=$('sk3BrandStats');
  if(!box){
    box=document.createElement('div'); box.id='sk3BrandStats';
    const search=$('stockSearch');
    (search||stock.querySelector('h2')).insertAdjacentElement('afterend',box);
  }
  const m={};
  (db.products||[]).forEach(p=>{
    const b=(p.brand||'Без бренда').trim()||'Без бренда';
    if(!m[b])m[b]={positions:0,units:0};
    m[b].positions++; m[b].units+=Number(p.stock||0);
  });
  box.innerHTML='<div style="font-weight:700;margin:12px 0 7px">Бренды · позиций · остаток</div><div class="sk3brands">'+
    Object.entries(m).sort((a,b)=>b[1].positions-a[1].positions).map(([b,v])=>
      `<div class="sk3brand"><b>${esc3(b)}</b><br><span>${v.positions} поз. · ${v.units} шт.</span></div>`).join('')+'</div>';
}
function productDelete(){
  if(!$('products'))return;
  // Rebuild product rows using the existing table, adding a deliberately small delete button.
  const search=(($('productSearch')||{}).value||'').toLowerCase();
  const rows=(db.products||[]).filter(p=>(p.name+' '+p.brand+' '+p.barcode).toLowerCase().includes(search));
  const table=$('productTable'); if(!table)return;
  table.innerHTML=rows.map(p=>`<tr>
    <td>${p.section==='korea'?'🇰🇷':'🇨🇳'}</td>
    <td>${esc3(p.barcode)||'—'}</td>
    <td><b>${esc3(p.brand||'Без бренда')}</b><br>${esc3(p.name)}</td>
    <td>${esc3(p.volume)||'—'}</td><td>${esc3(p.category)||'—'}</td>
    <td>${p.price?money(p.price)+' ₸':'—'}</td><td>${p.stock}</td>
    <td style="white-space:nowrap">
      <button class="secondary" onclick="editProduct(${p.id})">Изменить</button>
      <button class="sk3del" data-id="${p.id}" title="Удалить товар">×</button>
    </td>
  </tr>`).join('')||'<tr><td colspan="9" class="small">Товаров нет</td></tr>';
  table.querySelectorAll('.sk3del').forEach(btn=>{
    btn.onclick=()=>{
      const id=Number(btn.dataset.id), p=db.products.find(x=>x.id===id);
      if(!p)return;
      if(!confirm(`Точно удалить товар?\n\n${p.brand||''} ${p.name}\nШтрихкод: ${p.barcode||'—'}\n\nЭто действие нельзя отменить.`))return;
      db.products=db.products.filter(x=>x.id!==id);
      save();
      renderAll();
    };
  });
}
function salesPayments(){
  const sales=$('sales'); if(!sales)return;
  let box=$('sk3PaySummary');
  if(!box){
    box=document.createElement('div'); box.id='sk3PaySummary';
    const stats=$('salesStats'); if(stats)stats.insertAdjacentElement('afterend',box);
  }
  let cash=0,kaspi=0,card=0;
  (db.sales||[]).forEach(s=>{
    const p=s.payments||{};
    if(Object.keys(p).length){cash+=Number(p.cash||0);kaspi+=Number(p.kaspi||0);card+=Number(p.card||0)}
    else if(s.method==='Kaspi')kaspi+=Number(s.total||0);
    else if(s.method==='Карта')card+=Number(s.total||0);
    else cash+=Number(s.total||0);
  });
  box.className='notice';
  box.innerHTML=`<b>Оплата:</b> наличными ${money(cash)} ₸ · Kaspi ${money(kaspi)} ₸${card?` · карта ${money(card)} ₸`:''}`;
}
function style(){
  if(document.getElementById('sk3style'))return;
  const s=document.createElement('style');s.id='sk3style';
  s.textContent=`.sk4-pay-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:12px 0}.sk4-pay-tabs button{padding:12px 7px;border:1px solid #ddd4ca;border-radius:12px;background:#f3efe9;font-weight:700}.sk4-pay-tabs button.active{background:#171615;color:#fff}.sk4-change{font-size:18px;font-weight:800;padding:10px 0}.sk3del{font-size:12px!important;line-height:1!important;padding:4px 7px!important;border-radius:8px!important;background:#eee8df;color:#777;margin-left:4px}.sk3brands{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px}.sk3brand{background:#f3efe9;border-radius:12px;padding:10px;font-size:13px}.sk3brand span{color:#817b73;font-size:12px}`;
  document.head.appendChild(s);
}
function boot(){
  try{
    style(); bindPayment(); bindStock(); brandStats(); productDelete(); salesPayments();
    // Re-run the V2 cart renderer if it exists.
    if(typeof window.renderCart==='function' && Array.isArray(window.cart)) window.renderCart();
  }catch(e){console.error('SASSKIN V3',e)}
}
boot();
setTimeout(boot,250);
setTimeout(boot,800);
setTimeout(boot,1600);
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-view]');
  if(b){setTimeout(boot,100)}
});
})();
