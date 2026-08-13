/* SASSKIN POS — V2 PATCH
   Add AFTER sassskin_pos_updates.js.
   Does not replace the product database and does not touch the existing camera implementation.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc2 = v => (typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const money = n => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

  let cashMode = 'retail';

  const css = document.createElement('style');
  css.textContent = `
    .sk2-search{width:100%;padding:14px;border:1px solid #ddd4ca;border-radius:14px;margin:6px 0 12px;box-sizing:border-box}
    .sk2-results{display:grid;gap:6px;max-height:260px;overflow:auto;margin-bottom:10px}
    .sk2-result{display:flex;justify-content:space-between;gap:10px;align-items:center;text-align:left;width:100%;padding:11px;border:1px solid #e3ddd5;border-radius:12px;background:#fff}
    .sk2-price-row{display:flex;gap:6px;align-items:center;margin-top:7px}
    .sk2-price-row button{font-size:12px;padding:5px 8px;border-radius:9px;border:1px solid #ddd4ca;background:#f5f1ec}
    .sk2-price-row button.on{background:#171615;color:#fff}
    .sk2-pay-presets{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
    .sk2-pay-presets button{padding:14px;border-radius:13px;font-weight:700}
    .sk2-pay-presets button.active{background:#171615;color:#fff}
    .sk2-pay-box{display:grid;gap:10px}
    .sk2-pay-box input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #ddd4ca;border-radius:12px}
    .sk2-pay-total{font-size:20px;font-weight:800;margin:4px 0}
    .sk2-change{font-size:18px;font-weight:800;padding:8px 0}
    .sk2-brand-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:10px}
    .sk2-brand{padding:12px;border:1px solid #e1dbd3;border-radius:13px;background:#faf8f5}
    .sk2-delete{font-size:11px!important;padding:4px 7px!important;min-width:0!important;opacity:.7}
    .sk2-sales-pay{font-size:12px;line-height:1.5;margin-top:5px;padding:7px 9px;background:#f5f1ec;border-radius:9px}
    @media(max-width:650px){.sk2-pay-presets{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  function priceFor(item) {
    const p = db.products.find(x => x.id === item.id);
    if (!p) return 0;
    return item.priceMode === 'wholesale' ? Number(p.wholesale || 0) : Number(p.price || 0);
  }

  function total2() {
    return cart.reduce((s, x) => s + priceFor(x) * Number(x.qty || 0), 0);
  }

  // 1–2. Cash: search + mixed retail/wholesale in ONE basket.
  function installCashSearch() {
    const cash = document.querySelector('#cash');
    if (!cash || $('sk2CashSearch')) return;

    const cartCard = cash.querySelector('.cart');
    if (!cartCard) return;

    const h2 = cartCard.querySelector('h2');
    const wrap = document.createElement('div');
    wrap.id = 'sk2CashSearch';
    wrap.innerHTML = `
      <input class="sk2-search" id="sk2CashInput" placeholder="Поиск товара по названию, бренду или штрихкоду…">
      <div class="sk2-results" id="sk2CashResults"></div>
    `;
    h2.insertAdjacentElement('afterend', wrap);

    const input = $('sk2CashInput'), results = $('sk2CashResults');

    function draw() {
      const q = input.value.toLowerCase().trim();
      if (!q) { results.innerHTML = ''; return; }
      const arr = db.products.filter(p =>
        (`${p.name||''} ${p.brand||''} ${p.barcode||''}`).toLowerCase().includes(q)
      ).slice(0, 15);
      results.innerHTML = arr.map(p => `
        <button class="sk2-result" type="button" data-id="${p.id}">
          <span><b>${esc2(p.name)}</b><br><small>${esc2(p.brand||'')} · ${esc2(p.barcode||'')}</small></span>
          <span>${money(p.price)} ₸</span>
        </button>`).join('') || '<div class="small">Ничего не найдено</div>';

      results.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
        const p = db.products.find(x => x.id == b.dataset.id);
        if (!p) return;
        if (Number(p.stock || 0) < 1) return alert('Товара нет в наличии.');
        const item = cart.find(x => x.id === p.id);
        if (item) item.qty++;
        else cart.push({id:p.id, qty:1, priceMode:cashMode});
        input.value = '';
        results.innerHTML = '';
        renderMixedCart();
      });
    }
    input.oninput = draw;
  }

  function renderMixedCart() {
    const box = $('cart');
    if (!box) return;
    box.innerHTML = cart.map(x => {
      const p = db.products.find(y => y.id === x.id);
      if (!p) return '';
      const price = priceFor(x);
      return `
        <div class="item">
          <div style="flex:1">
            <b>${esc2(p.name)}</b>
            <div class="small">${money(price)} ₸ × ${x.qty} = ${money(price*x.qty)} ₸</div>
            <div class="sk2-price-row">
              <span class="small">Цена:</span>
              <button class="${x.priceMode==='retail'?'on':''}" onclick="sk2SetMode(${x.id},'retail')">Розница</button>
              <button class="${x.priceMode==='wholesale'?'on':''}" onclick="sk2SetMode(${x.id},'wholesale')">Опт</button>
            </div>
          </div>
          <div class="qty">
            <button onclick="sassChangeQty(${x.id},-1)">−</button>
            ${x.qty}
            <button onclick="sassChangeQty(${x.id},1)">+</button>
          </div>
        </div>`;
    }).join('') || '<div class="empty">Корзина пуста</div>';

    const sub = total2();
    const d = typeof discountAmount === 'function' ? discountAmount(sub) : 0;
    if ($('total')) $('total').textContent = money(sub-d);
    if (typeof renderCustomerSale === 'function') renderCustomerSale();
  }

  window.sk2SetMode = function(id, mode) {
    const x = cart.find(i => i.id === id);
    if (!x) return;
    x.priceMode = mode;
    renderMixedCart();
  };

  window.sassAddByBarcode = function(code) {
    const p = db.products.find(x => String(x.barcode||'').trim() === String(code||'').trim());
    if (!p) return alert('Штрихкод не найден.');
    if (Number(p.stock||0) < 1) return alert('Товара нет в наличии.');
    const x = cart.find(i => i.id === p.id);
    if (x) x.qty++;
    else cart.push({id:p.id,qty:1,priceMode:cashMode});
    renderMixedCart();
  };

  window.renderCart = renderMixedCart;
  window.rawTotal = total2;

  // 3. Faster payment: one-click presets. Mixed = only enter Kaspi; cash is calculated.
  function fastPayment(amount, done) {
    const html = `
      <div class="form">
        <div class="sk2-pay-total">К оплате: ${money(amount)} ₸</div>
        <div class="sk2-pay-presets">
          <button id="sk2AllCash" class="active">💵 Всё наличными</button>
          <button id="sk2AllKaspi">💳 Всё Kaspi</button>
          <button id="sk2Mixed">↔️ Смешанная</button>
          <button id="sk2ExactCash">💵 Без сдачи</button>
        </div>
        <div id="sk2PayBox" class="sk2-pay-box"></div>
        <div class="actions">
          <button class="primary" id="sk2DoPay">Провести продажу</button>
          <button class="secondary" onclick="closeModal()">Отмена</button>
        </div>
      </div>`;
    modal('Оплата', html);

    const box = $('sk2PayBox');
    let mode = 'cash';

    function render() {
      if (mode === 'cash') {
        box.innerHTML = `
          <label>Клиент дал наличными
            <input id="sk2Received" type="number" min="0" value="${amount}">
          </label>
          <div class="sk2-change">Сдача: <span id="sk2Change">0</span> ₸</div>`;
        $('sk2Received').oninput = () => {
          $('sk2Change').textContent = money(Math.max(0, Number($('sk2Received').value||0)-amount));
        };
      } else if (mode === 'kaspi') {
        box.innerHTML = `<div class="notice">Клиент оплачивает все ${money(amount)} ₸ через Kaspi.</div>`;
      } else if (mode === 'exact') {
        box.innerHTML = `<div class="notice">Наличные ровно ${money(amount)} ₸. Сдача: 0 ₸.</div>`;
      } else {
        box.innerHTML = `
          <label>Kaspi
            <input id="sk2Kaspi" type="number" min="0" max="${amount}" value="0">
          </label>
          <div class="notice">Остаток автоматически уходит в наличные.</div>
          <div>Наличные: <b id="sk2CashAuto">${money(amount)}</b> ₸</div>
          <label>Клиент дал наличными
            <input id="sk2Received" type="number" min="0" value="${amount}">
          </label>
          <div class="sk2-change">Сдача: <span id="sk2Change">0</span> ₸</div>`;
        function calc() {
          const k = Math.min(amount, Math.max(0, Number($('sk2Kaspi').value||0)));
          const c = amount-k;
          const r = Number($('sk2Received').value||0);
          $('sk2CashAuto').textContent = money(c);
          $('sk2Change').textContent = money(Math.max(0,r-c));
        }
        $('sk2Kaspi').oninput = calc;
        $('sk2Received').oninput = calc;
        calc();
      }
    }

    function setMode(m, active) {
      mode=m;
      ['sk2AllCash','sk2AllKaspi','sk2Mixed','sk2ExactCash'].forEach(id => $(id).classList.remove('active'));
      $(active).classList.add('active');
      render();
    }
    $('sk2AllCash').onclick=()=>setMode('cash','sk2AllCash');
    $('sk2AllKaspi').onclick=()=>setMode('kaspi','sk2AllKaspi');
    $('sk2Mixed').onclick=()=>setMode('mixed','sk2Mixed');
    $('sk2ExactCash').onclick=()=>setMode('exact','sk2ExactCash');

    render();

    $('sk2DoPay').onclick=()=>{
      let payment;
      if (mode==='cash') {
        const r=Number($('sk2Received').value||0);
        if (r<amount) return alert('Клиент дал меньше суммы.');
        payment={cash:amount,kaspi:0,card:0,cashReceived:r,change:r-amount};
      } else if (mode==='kaspi') {
        payment={cash:0,kaspi:amount,card:0,cashReceived:0,change:0};
      } else if (mode==='exact') {
        payment={cash:amount,kaspi:0,card:0,cashReceived:amount,change:0};
      } else {
        const k=Math.min(amount,Math.max(0,Number($('sk2Kaspi').value||0)));
        const c=amount-k, r=Number($('sk2Received').value||0);
        if (r<c) return alert('Клиент дал недостаточно наличных.');
        payment={cash:c,kaspi:k,card:0,cashReceived:r,change:r-c};
      }
      done(payment);
    };
  }

  window.sassCheckout = function() {
    if (!cart.length) return alert('Корзина пуста.');
    const subtotal=total2();
    const disc=typeof discountAmount==='function'?discountAmount(subtotal):0;
    const final=Math.max(0,subtotal-disc);

    fastPayment(final, payment=>{
      cart.forEach(x=>{
        const p=db.products.find(y=>y.id===x.id);
        if(p)p.stock=Math.max(0,Number(p.stock||0)-Number(x.qty||0));
      });
      const customer=db.customers.find(c=>c.id===selectedCustomerId);
      const sale={
        no:db.seq++,time:new Date().toISOString(),customerId:customer?.id||null,
        items:cart.map(x=>{const p=db.products.find(y=>y.id===x.id);return{id:p.id,name:p.name,qty:x.qty,price:priceFor(x),cost:Number(p.cost||0),priceMode:x.priceMode};}),
        subtotal,discount:disc,total:final,
        method:payment.cash>0&&payment.kaspi>0?'Смешанная':payment.cash>0?'Наличные':'Kaspi',
        payments:payment
      };
      db.sales.unshift(sale);
      if(customer){customer.lastSale=sale.time;customer.total=(customer.total||0)+final;customer.orders=(customer.orders||0)+1;}
      save(); closeModal(); cart=[]; selectedCustomerId=null;
      discount={type:'percent',value:0};
      if($('disc'))$('disc').value='';
      if(typeof sassRerender==='function')sassRerender();
      alert('Продажа проведена\nЧек #'+sale.no+'\n'+money(final)+' ₸');
      if(typeof maybeWhatsAppReceipt==='function')maybeWhatsAppReceipt(sale);
    });
  };

  function replacePayButton(){
    const pay=document.querySelector('.pay');
    if(!pay)return;
    if(pay.dataset.sk2)return;
    pay.dataset.sk2='1';
    pay.innerHTML='<button type="button" class="primary" id="sk2Pay">Оплатить / провести</button>';
    $('sk2Pay').onclick=window.sassCheckout;
  }

  // 4. Stock receipt/write-off: scan or search, no product list dumped in the modal.
  window.sassStockMove=function(sign){
    modal(sign>0?'Приход':'Списание',`
      <div class="form">
        <input class="sk2-search" id="sk2MoveSearch" placeholder="Введите название или EAN-13">
        <button class="secondary" id="sk2MoveScan">📷 Сканировать товар</button>
        <div id="sk2MoveResults" class="sk2-results"></div>
        <div class="notice" id="sk2MoveSelected">Товар не выбран</div>
        <label>Количество<input id="sk2MoveQty" type="number" min="1" value="1"></label>
        <div class="actions">
          <button class="primary" id="sk2MoveSave">${sign>0?'Добавить приход':'Списать'}</button>
          <button class="secondary" onclick="closeModal()">Отмена</button>
        </div>
      </div>`);
    const input=$('sk2MoveSearch'),res=$('sk2MoveResults'),sel=$('sk2MoveSelected');
    let selected=null;
    function choose(p){selected=p;sel.innerHTML='<b>'+esc2(p.name)+'</b> · остаток '+Number(p.stock||0);}
    function draw(){
      const q=input.value.toLowerCase().trim();
      if(!q){res.innerHTML='';return;}
      const arr=db.products.filter(p=>(`${p.name||''} ${p.brand||''} ${p.barcode||''}`).toLowerCase().includes(q)).slice(0,12);
      res.innerHTML=arr.map(p=>`<button class="sk2-result" data-id="${p.id}" type="button"><span>${esc2(p.name)}<br><small>${esc2(p.barcode||'')}</small></span><b>${p.stock}</b></button>`).join('');
      res.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>choose(db.products.find(p=>p.id==b.dataset.id)));
    }
    input.oninput=draw;
    $('sk2MoveScan').onclick=()=>{
      if(typeof scanBarcode!=='function')return alert('Сканер недоступен.');
      scanBarcode(code=>{
        input.value=code;
        const p=db.products.find(x=>String(x.barcode||'').trim()===String(code).trim());
        if(!p)return alert('Товар с этим штрихкодом не найден.');
        choose(p);
      });
    };
    $('sk2MoveSave').onclick=()=>{
      const n=Number($('sk2MoveQty').value||0);
      if(!selected||n<1)return alert('Сначала выбери/сканируй товар и укажи количество.');
      if(sign<0&&n>Number(selected.stock||0))return alert('Недостаточно остатка.');
      selected.stock=Number(selected.stock||0)+(sign>0?n:-n);
      if(typeof save==='function')save();
      closeModal();
      if(typeof renderStock==='function')renderStock();
      if(typeof renderProducts==='function')renderProducts();
    };
  };

  // 5. Warehouse: brand count + positions per brand.
  function installBrandStats(){
    const stock=document.querySelector('#stock');
    if(!stock||$('sk2BrandStats'))return;
    const search=stock.querySelector('#stockSearch');
    const host=document.createElement('div');
    host.id='sk2BrandStats';
    host.innerHTML='<div class="small">Бренды и позиции</div><div class="sk2-brand-grid" id="sk2BrandGrid"></div>';
    (search||stock.querySelector('h2'))?.insertAdjacentElement('afterend',host);
    const grid=$('sk2BrandGrid');
    if(!grid)return;
    const map={};
    db.products.forEach(p=>{
      const b=(p.brand||'Без бренда').trim()||'Без бренда';
      if(!map[b])map[b]={count:0,stock:0};
      map[b].count++;
      map[b].stock+=Number(p.stock||0);
    });
    const rows=Object.entries(map).sort((a,b)=>b[1].count-a[1].count);
    grid.innerHTML=rows.map(([b,v])=>`<div class="sk2-brand"><b>${esc2(b)}</b><br><small>${v.count} поз. · ${v.stock} шт.</small></div>`).join('');
  }

  // 6. Tiny delete + confirmation. Uses existing deleteProduct if present.
  function installSafeDelete(){
    if(!$('products'))return;
    document.querySelectorAll('#products button').forEach(btn=>{
      const text=(btn.textContent||'').trim().toLowerCase();
      if(!text.includes('удал'))return;
      if(btn.dataset.sk2)return;
      btn.dataset.sk2='1';
      btn.classList.add('sk2-delete');
      const old=btn.onclick;
      btn.onclick=function(e){
        e.preventDefault();
        e.stopPropagation();
        if(!confirm('Точно удалить этот товар из базы?\\n\\nЭто действие нельзя отменить.'))return;
        if(typeof old==='function')old.call(btn,e);
        else {
          const m=btn.getAttribute('onclick');
          if(m && typeof Function=== 'function') Function(m)();
        }
      };
    });
  }

  // 7. Sales: show cash and Kaspi separately.
  function installSalesObserver(){
    const sales=document.querySelector('#sales');
    if(!sales||sales.dataset.sk2)return;
    sales.dataset.sk2='1';
    const render0=window.renderSales;
    if(typeof render0==='function'){
      window.renderSales=function(){
        render0.apply(this,arguments);
        decorateSales();
      };
    }
    decorateSales();
  }
  function decorateSales(){
    const sales=$('sales');
    if(!sales)return;
    const text=sales.innerText||'';
    // Add a compact summary at top without rewriting the existing sales database.
    let sum=document.getElementById('sk2SalesSummary');
    if(!sum){
      sum=document.createElement('div');
      sum.id='sk2SalesSummary';
      const h=sales.querySelector('h2');
      (h||sales.firstElementChild)?.insertAdjacentElement('afterend',sum);
    }
    const rows=db.sales||[];
    let cash=0,kaspi=0;
    rows.forEach(s=>{
      const p=s.payments||{};
      cash+=Number(p.cash||0);
      kaspi+=Number(p.kaspi||0);
    });
    sum.className='notice';
    sum.innerHTML=`<b>Все продажи:</b> наличными ${money(cash)} ₸ · Kaspi ${money(kaspi)} ₸`;
    // Payment details for visible sale blocks/cards.
    sales.querySelectorAll('.card').forEach(card=>{
      if(card.querySelector('.sk2-sales-pay'))return;
      const m=card.innerText.match(/(?:Чек|№)\s*#?\s*(\d+)/);
      if(!m)return;
      const s=rows.find(x=>String(x.no)===String(m[1]));
      if(!s||!s.payments)return;
      const p=s.payments;
      const div=document.createElement('div');
      div.className='sk2-sales-pay';
      div.innerHTML=`Наличные: <b>${money(p.cash||0)} ₸</b> · Kaspi: <b>${money(p.kaspi||0)} ₸</b>${Number(p.change||0)>0?` · Сдача: <b>${money(p.change)} ₸</b>`:''}`;
      card.appendChild(div);
    });
  }

  function boot(){
    try{
      installCashSearch();
      installPaymentButtons();
      installBrandStats();
      installSafeDelete();
      installSalesObserver();
      if(typeof renderMixedCart==='function' && Array.isArray(window.cart)) renderMixedCart();
    }catch(e){ console.error('SASSKIN V2 patch:',e); }
  }

  // Existing app renders sections after navigation, so retry lightly.
  boot();
  setTimeout(boot,300);
  setTimeout(boot,1000);
  setTimeout(boot,2000);

})();
