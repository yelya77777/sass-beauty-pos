
/*
 SASS BEAUTY POS — SAFE UI UPDATE
 This file does NOT replace or rewrite the product database.
 It only changes the UI/behavior requested by the owner.
 Add this file to the repo and load it AFTER the existing index script.
*/
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const money2 = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

  // ---------- 1. CASH: no product grid, large basket ----------
  const gridStyle = document.createElement('style');
  gridStyle.textContent = `
    #cash .grid{grid-template-columns:1fr}
    #cash .grid>.card:first-child{display:none}
    #cash .cart{min-height:calc(100vh - 170px)}
    #cash .items{min-height:330px}
    .sass-price-picker{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px}
    .sass-price-picker button{padding:14px;border-radius:14px;background:#ebe6df;color:#49443e;font-weight:700}
    .sass-price-picker button.on{background:#171615;color:#fff}
    .sass-scan-row{display:flex;gap:8px;margin-bottom:12px}
    .sass-scan-row button{flex:1}
    .sass-payment-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
    .sass-payment-grid input{width:100%;padding:12px;border:1px solid #e6e0d7;border-radius:12px}
    .sass-change{font-size:18px;font-weight:800;padding:10px 0}
    .sass-receipt{font-family:monospace;background:#f3efe9;border-radius:14px;padding:14px;white-space:pre-wrap}
    @media(max-width:700px){.sass-payment-grid{grid-template-columns:1fr}.sass-scan-row{flex-direction:column}}
  `;
  document.head.appendChild(gridStyle);

  let priceMode = 'retail';

  function installCashUI() {
    const cartCard = document.querySelector('#cash .cart');
    if (!cartCard || document.getElementById('sassPricePicker')) return;

    const h2 = cartCard.querySelector('h2');
    const picker = document.createElement('div');
    picker.id = 'sassPricePicker';
    picker.innerHTML = `
      <div class="small">Цена для этой продажи</div>
      <div class="sass-price-picker">
        <button type="button" data-price-mode="retail" class="on">Розничная цена</button>
        <button type="button" data-price-mode="wholesale">Оптовая цена</button>
      </div>
      <div class="sass-scan-row">
        <button type="button" class="primary" id="sassScanCash">📷 Сканировать товар</button>
        <button type="button" class="secondary" id="sassManualCash">Ввести штрихкод</button>
      </div>
    `;
    h2.insertAdjacentElement('afterend', picker);

    picker.querySelectorAll('[data-price-mode]').forEach(btn => {
      btn.onclick = () => {
        priceMode = btn.dataset.priceMode;
        picker.querySelectorAll('[data-price-mode]').forEach(x => x.classList.toggle('on', x === btn));
      };
    });

    $('sassScanCash').onclick = () => {
      if (typeof scanBarcode !== 'function') return alert('Сканер недоступен.');
      scanBarcode((code) => window.sassAddByBarcode(code));
    };
    $('sassManualCash').onclick = () => {
      const code = prompt('Введите EAN-13 / штрихкод');
      if (code) window.sassAddByBarcode(code.trim());
    };
  }

  // ---------- 2. Barcode -> directly to basket, selected price ----------
  window.sassAddByBarcode = function (code) {
    const p = db.products.find(x => String(x.barcode || '').trim() === String(code).trim());
    if (!p) return alert('Штрихкод ' + code + ' не найден.');

    if (Number(p.stock || 0) < 1) return alert('Товара нет в наличии.');

    let x = cart.find(i => i.id === p.id);
    if (x) {
      if (x.qty >= Number(p.stock || 0)) return alert('Недостаточно остатка.');
      x.qty++;
      x.priceMode = priceMode;
    } else {
      x = { id: p.id, qty: 1, priceMode: priceMode };
      cart.push(x);
    }
    renderSassCart();
  };

  function itemPrice(item) {
    const p = db.products.find(x => x.id === item.id);
    if (!p) return 0;
    return item.priceMode === 'wholesale' ? Number(p.wholesale || 0) : Number(p.price || 0);
  }

  function sassRawTotal() {
    return cart.reduce((s, x) => s + itemPrice(x) * Number(x.qty || 0), 0);
  }

  window.sassAddToCart = function (id) {
    const p = db.products.find(x => x.id === id);
    if (!p || Number(p.stock || 0) < 1) return alert('Товара нет в наличии.');
    window.sassAddByBarcode(p.barcode);
  };

  function renderSassCart() {
    const box = $('cart');
    if (!box) return;
    box.innerHTML = cart.map(x => {
      const p = db.products.find(y => y.id === x.id);
      if (!p) return '';
      const price = itemPrice(x);
      return `
        <div class="item">
          <div>
            <b>${esc(p.name)}</b>
            <div class="small">${x.priceMode === 'wholesale' ? 'Оптовая' : 'Розничная'} · ${money2(price)} ₸ × ${x.qty}</div>
          </div>
          <div class="qty">
            <button onclick="sassChangeQty(${x.id},-1)">−</button>
            ${x.qty}
            <button onclick="sassChangeQty(${x.id},1)">+</button>
          </div>
        </div>`;
    }).join('') || '<div class="empty">Корзина пуста</div>';

    const t = sassRawTotal();
    const d = typeof discountAmount === 'function' ? discountAmount(t) : 0;
    $('total').textContent = money2(t - d);
    if (typeof renderCustomerSale === 'function') renderCustomerSale();
  }

  window.sassChangeQty = function (id, d) {
    const x = cart.find(i => i.id === id);
    const p = db.products.find(y => y.id === id);
    if (!x || !p) return;
    x.qty += d;
    if (x.qty < 1) cart = cart.filter(i => i.id !== id);
    if (x.qty > Number(p.stock || 0)) x.qty = Number(p.stock || 0);
    renderSassCart();
  };

  // Keep normal cash render calls compatible with the new basket.
  window.renderCart = renderSassCart;
  window.rawTotal = sassRawTotal;

  // ---------- 3 + 4. Mixed payment + cash received/change ----------
  function paymentModal(finalAmount, done) {
    const html = `
      <div class="form">
        <div class="notice">К оплате: <b>${money2(finalAmount)} ₸</b></div>
        <div class="sass-payment-grid">
          <label>Наличные<input id="sassCashPart" type="number" min="0" value="0"></label>
          <label>Kaspi<input id="sassKaspiPart" type="number" min="0" value="0"></label>
          <label>Карта<input id="sassCardPart" type="number" min="0" value="0"></label>
        </div>
        <label>Получено наличными<input id="sassCashReceived" type="number" min="0" value="0"></label>
        <div class="sass-change">Сдача: <span id="sassChange">0</span> ₸</div>
        <div id="sassPayError" class="small danger"></div>
        <div class="actions">
          <button class="primary" id="sassConfirmPayment">Провести продажу</button>
          <button class="secondary" onclick="closeModal()">Отмена</button>
        </div>
      </div>`;

    modal('Оплата', html);

    const cash = $('sassCashPart'), kaspi = $('sassKaspiPart'), card = $('sassCardPart'), received = $('sassCashReceived');
    const change = $('sassChange'), err = $('sassPayError');

    function calc() {
      const c = Number(cash.value || 0), k = Number(kaspi.value || 0), cd = Number(card.value || 0);
      const r = Number(received.value || 0);
      change.textContent = money2(Math.max(0, r - c));
      const paid = c + k + cd;
      err.textContent = paid < finalAmount ? 'Не хватает: ' + money2(finalAmount - paid) + ' ₸' : '';
      return { c, k, cd, r, paid };
    }
    [cash, kaspi, card, received].forEach(x => x.oninput = calc);
    $('sassConfirmPayment').onclick = () => {
      const p = calc();
      if (p.paid < finalAmount) return;
      if (p.r < p.c) return err.textContent = 'Получено наличными меньше, чем указано наличными в оплате.';
      done({ cash: p.c, kaspi: p.k, card: p.cd, cashReceived: p.r, change: Math.max(0, p.r - p.c) });
    };
  }

  window.sassCheckout = function () {
    if (!cart.length) return alert('Корзина пуста.');

    if (discount.type === 'percent' && Number(discount.value || 0) > 20) {
      const pin = prompt('PIN владельца');
      if (pin !== db.pin) return alert('Неверный PIN');
    }

    const subtotal = sassRawTotal();
    const disc = typeof discountAmount === 'function' ? discountAmount(subtotal) : 0;
    const final = Math.max(0, subtotal - disc);

    paymentModal(final, (payment) => {
      cart.forEach(x => {
        const p = db.products.find(y => y.id === x.id);
        if (p) p.stock = Math.max(0, Number(p.stock || 0) - Number(x.qty || 0));
      });

      const customer = db.customers.find(c => c.id === selectedCustomerId);
      const sale = {
        no: db.seq++,
        time: new Date().toISOString(),
        customerId: customer?.id || null,
        items: cart.map(x => {
          const p = db.products.find(y => y.id === x.id);
          return { id:p.id, name:p.name, qty:x.qty, price:itemPrice(x), cost:Number(p.cost||0), priceMode:x.priceMode };
        }),
        subtotal,
        discount:disc,
        total:final,
        method:(payment.cash>0 && payment.kaspi>0) || (payment.cash>0 && payment.card>0) || (payment.kaspi>0 && payment.card>0) ? 'Смешанная' :
          payment.cash>0 ? 'Наличные' : payment.kaspi>0 ? 'Kaspi' : 'Карта',
        payments: payment
      };

      db.sales.unshift(sale);

      if (customer) {
        customer.lastSale = sale.time;
        customer.total = (customer.total || 0) + final;
        customer.orders = (customer.orders || 0) + 1;
      }

      save();
      closeModal();
      cart = [];
      selectedCustomerId = null;
      discount = {type:'percent', value:0};
      if ($('disc')) $('disc').value = '';
      sassRerender();
      alert('Продажа проведена\nЧек #' + sale.no + '\n' + money2(final) + ' ₸');
      maybeWhatsAppReceipt(sale);
    });
  };

  // Replace existing payment buttons with one payment action.
  function installPaymentButtons() {
    const pay = document.querySelector('.pay');
    if (!pay || pay.dataset.sassInstalled) return;
    pay.dataset.sassInstalled = '1';
    pay.innerHTML = '<button type="button" id="sassPayBtn">Оплата / чек</button>';
    $('sassPayBtn').onclick = window.sassCheckout;
  }

  // ---------- 5. Stock receipt: barcode/search, no huge select ----------
  window.sassStockMove = function (sign) {
    modal(sign > 0 ? 'Приход' : 'Списание', `
      <div class="form">
        <label>Поиск товара / штрихкод
          <input id="sassMoveSearch" placeholder="Название, бренд или EAN-13" autocomplete="off">
        </label>
        <button class="secondary" id="sassMoveScan">📷 Сканировать штрихкод</button>
        <div id="sassMoveResults"></div>
        <input id="sassMoveProduct" type="hidden">
        <label>Количество<input id="sassMoveQty" type="number" min="1" value="1"></label>
        <div class="notice" id="sassMoveSelected">Товар не выбран</div>
        <div class="actions">
          <button class="primary" id="sassMoveSave">Сохранить</button>
          <button class="secondary" onclick="closeModal()">Отмена</button>
        </div>
      </div>`);

    const search = $('sassMoveSearch'), results = $('sassMoveResults'), hidden = $('sassMoveProduct'), selected = $('sassMoveSelected');

    function showResults() {
      const s = String(search.value || '').toLowerCase().trim();
      const arr = db.products.filter(p => !s || (p.name+' '+p.brand+' '+p.barcode).toLowerCase().includes(s)).slice(0,30);
      results.innerHTML = arr.map(p => `<button type="button" class="secondary" style="width:100%;text-align:left;margin:3px 0" data-id="${p.id}">${esc(p.name)} · ${esc(p.barcode||'—')} · остаток ${p.stock}</button>`).join('') || '<div class="small">Ничего не найдено</div>';
      results.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
        const p = db.products.find(x => x.id == b.dataset.id);
        hidden.value = p.id;
        selected.innerHTML = '<b>Выбрано:</b> ' + esc(p.name) + ' · текущий остаток ' + p.stock;
      });
    }
    search.oninput = showResults;
    showResults();

    $('sassMoveScan').onclick = () => {
      scanBarcode(code => {
        search.value = code;
        showResults();
        const p = db.products.find(x => String(x.barcode||'') === String(code));
        if (p) {
          hidden.value = p.id;
          selected.innerHTML = '<b>Выбрано:</b> ' + esc(p.name) + ' · текущий остаток ' + p.stock;
        } else alert('Штрихкод не найден.');
      });
    };

    $('sassMoveSave').onclick = () => {
      const p = db.products.find(x => x.id == hidden.value);
      const n = Number($('sassMoveQty').value || 0);
      if (!p || n < 1) return alert('Выбери товар и количество.');
      if (sign < 0 && n > Number(p.stock || 0)) return alert('Недостаточно остатка.');
      p.stock = Number(p.stock || 0) + sign * n;
      save();
      closeModal();
      sassRerender();
    };
  };

  // ---------- 6. Delete button ----------
  window.sassDeleteProduct = function (id) {
    const p = db.products.find(x => x.id === id);
    if (!p) return;
    if (!confirm('Удалить товар «' + p.name + '» из базы?')) return;
    db.products = db.products.filter(x => x.id !== id);
    save();
    sassRerender();
  };

  // ---------- 7 + 8. Remove product-card/photo functions from UI ----------
  // Product data itself is NOT modified. Only the form/UI fields are simplified.
  const oldProductForm = window.productForm;
  window.productForm = function (p = {}) {
    pendingPhoto = '';
    modal(p.id ? 'Изменить товар' : 'Добавить товар', `
      <div class="form">
        <label>Штрихкод<input id="fbarcode" inputmode="numeric" value="${esc(p.barcode||'')}"></label>
        <label>Бренд<input id="fbrand" value="${esc(p.brand||'')}"></label>
        <label>Название<input id="fname" value="${esc(p.name||'')}"></label>
        <label>Раздел<select id="fsection">
          <option value="korea" ${p.section==='korea'?'selected':''}>🇰🇷 Корейская косметика</option>
          <option value="china" ${p.section==='china'?'selected':''}>🇨🇳 Китай</option>
        </select></label>
        <label>Объём<input id="fvolume" value="${esc(p.volume||'')}"></label>
        <label>Тип<input id="fcat" value="${esc(p.category||'')}"></label>
        <label>Цена закупки<input id="fcost" type="number" value="${p.cost||0}"></label>
        <label>Оптовая цена<input id="fwholesale" type="number" value="${p.wholesale||0}"></label>
        <label>Розничная цена<input id="fprice" type="number" value="${p.price||0}"></label>
        <label>Остаток<input id="fstock" type="number" value="${p.stock??0}"></label>
        <div class="actions">
          <button class="primary" onclick="sassSaveProduct(${p.id||0})">Сохранить</button>
          <button class="secondary" onclick="closeModal()">Отмена</button>
        </div>
      </div>`);
  };


  window.editProduct = function (id) {
    const p = db.products.find(x => x.id === id);
    if (p) window.productForm(p);
  };
  const addProductBtn = $('addProduct');
  if (addProductBtn) addProductBtn.onclick = () => window.productForm();

  function sassRerender() {
    if (typeof renderStock === 'function') renderStock();
    const skuStat = document.querySelector('#stockStats .stat');
    if (skuStat) skuStat.firstChild.textContent = 'Товаров';
    renderSassCart();
    patchRenderProducts();
    if (typeof renderCustomers === 'function') renderCustomers();
    renderSassSales();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    if ($('ownerPin')) $('ownerPin').value = db.pin || '';
    if ($('dbCount')) $('dbCount').textContent = db.products.length;
    if ($('krCount')) $('krCount').textContent = db.products.filter(p=>p.section==='korea').length;
    if ($('cnCount')) $('cnCount').textContent = db.products.filter(p=>p.section==='china').length;
  }

  window.sassSaveProduct = function (id) {
    const d = {
      barcode: $('fbarcode').value.trim(),
      brand: $('fbrand').value.trim(),
      name: $('fname').value.trim(),
      section: $('fsection').value,
      volume: $('fvolume').value.trim(),
      category: $('fcat').value.trim(),
      cost: Number($('fcost').value || 0),
      wholesale: Number($('fwholesale').value || 0),
      price: Number($('fprice').value || 0),
      stock: Number($('fstock').value || 0)
    };
    if (!d.name) return alert('Укажи название.');
    const target = db.products.find(x => x.id === id);
    if (target) Object.assign(target, d);
    else { d.id = Date.now(); db.products.push(d); }
    save(); closeModal(); sassRerender();
  };

  // ---------- 9. Sales table: fiscal receipt layout ----------
  function renderSassSales() {
    const head = document.querySelector('#salesTable')?.closest('table')?.querySelector('thead');
    if (head) head.innerHTML = '<tr><th>Чек</th><th>Время</th><th>Клиент</th><th>Товары</th><th>Оплата</th><th></th></tr>';
    const search = String(($('salesSearch')?.value || '')).toLowerCase();
    const sales = db.sales.filter(x => ('#'+x.no+' '+x.items.map(i=>i.name).join(' ')).toLowerCase().includes(search));
    const rev = db.sales.reduce((a,x)=>a+Number(x.total||0),0);
    $('salesStats').innerHTML = `
      <div class="stat">Выручка<strong>${money2(rev)} ₸</strong></div>
      <div class="stat">Чеков<strong>${db.sales.length}</strong></div>
      <div class="stat">Средний чек<strong>${money2(db.sales.length ? rev/db.sales.length : 0)} ₸</strong></div>
      <div class="stat">Скидки<strong>${money2(db.sales.reduce((a,x)=>a+Number(x.discount||0),0))} ₸</strong></div>`;

    $('salesTable').innerHTML = sales.map(s => {
      const c = db.customers.find(c => c.id === s.customerId);
      const rows = s.items.map(i => `
        <div style="display:grid;grid-template-columns:minmax(180px,1fr) 70px 110px;text-align:left;gap:8px;border-bottom:1px dashed #ddd;padding:4px 0">
          <span>${esc(i.name)}</span><span style="text-align:center">${i.qty}</span><span style="text-align:right">${money2(i.price*i.qty)} ₸</span>
        </div>`).join('');
      const payments = s.payments ? `Наличные ${money2(s.payments.cash)} · Kaspi ${money2(s.payments.kaspi)} · Карта ${money2(s.payments.card)}` : esc(s.method||'—');
      return `<tr>
        <td>#${s.no}</td>
        <td>${new Date(s.time).toLocaleString('ru-RU')}</td>
        <td>${esc(c?.name||'—')}</td>
        <td>
          <div style="font-weight:700;display:grid;grid-template-columns:minmax(180px,1fr) 70px 110px;gap:8px">
            <span>Наименование</span><span style="text-align:center">Кол-во</span><span style="text-align:right">Сумма</span>
          </div>
          ${rows}
          <div style="text-align:right;font-weight:800;padding-top:6px">Итого: ${money2(s.total)} ₸</div>
        </td>
        <td>${payments}</td>
        <td><button class="secondary" onclick="editSale(${s.no})">Изменить</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">Продаж нет</td></tr>';
  }

  // ---------- 10. WhatsApp receipt ----------
  function receiptText(sale) {
    const lines = [
      'SASSKIN',
      'Чек #' + sale.no,
      new Date(sale.time).toLocaleString('ru-RU'),
      '------------------------------'
    ];
    sale.items.forEach(i => lines.push(i.name + ' × ' + i.qty + ' = ' + money2(i.price*i.qty) + ' ₸'));
    lines.push('------------------------------');
    lines.push('Итого: ' + money2(sale.total) + ' ₸');
    if (sale.payments) {
      lines.push('Наличные: ' + money2(sale.payments.cash) + ' ₸');
      lines.push('Kaspi: ' + money2(sale.payments.kaspi) + ' ₸');
      if (sale.payments.card) lines.push('Карта: ' + money2(sale.payments.card) + ' ₸');
      if (sale.payments.change) lines.push('Сдача: ' + money2(sale.payments.change) + ' ₸');
    }
    return lines.join('\n');
  }

  function maybeWhatsAppReceipt(sale) {
    const c = db.customers.find(x => x.id === sale.customerId);
    if (!c || !c.phone) return;
    // Browser-only app cannot silently send a WhatsApp message.
    // It opens WhatsApp with the receipt prepared; sending is one tap.
    const phone = String(c.phone).replace(/\D/g,'');
    const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(receiptText(sale));
    setTimeout(() => {
      try { window.open(url, '_blank'); } catch(e) {}
    }, 250);
  }

  // ---------- 5/6/9 bindings ----------
  function patchRenderProducts() {
    const s = String(($('productSearch')?.value || '')).toLowerCase();
    $('productTable').innerHTML = db.products.filter(p => (p.name+' '+p.brand+' '+p.barcode).toLowerCase().includes(s)).map(p => `
      <tr>
        <td>${p.section==='korea'?'🇰🇷':'🇨🇳'}</td>
        <td>${esc(p.barcode)||'—'}</td>
        <td><b>${esc(p.brand||'Без бренда')}</b><br>${esc(p.name)}</td>
        <td>${esc(p.volume)||'—'}</td>
        <td>${esc(p.category)||'—'}</td>
        <td>${p.price?money2(p.price)+' ₸':'—'}</td>
        <td>${p.stock}</td>
        <td>
          <button class="secondary" onclick="editProduct(${p.id})">Изменить</button>
          <button class="secondary danger" onclick="sassDeleteProduct(${p.id})">Удалить</button>
        </td>
      </tr>`).join('');
  }

  window.renderProducts = patchRenderProducts;

  // Rebind stock buttons to improved modal.
  const receive = $('receiveBtn'), writeoff = $('writeoffBtn');
  if (receive) receive.onclick = () => sassStockMove(1);
  if (writeoff) writeoff.onclick = () => sassStockMove(-1);

  // Re-render sales with receipt-like item rows.
  window.renderSales = renderSassSales;

  // Keep scanner itself untouched. Only its callback is changed.
  // Existing camera implementation remains in place.

  // Existing functions were already declared before this file.
  // Replace the cash scan handler so the camera still uses the existing implementation.
  const originalScanBtn = $('scanBtn');
  if (originalScanBtn) originalScanBtn.onclick = () => scanBarcode((code) => window.sassAddByBarcode(code));


  // Rebind navigation so the existing camera/database remain untouched while
  // our custom renderers survive tab changes.
  document.querySelectorAll('.nav button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.nav button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelectorAll('.view').forEach(x => x.classList.remove('on'));
      const v = $(b.dataset.view);
      if (v) v.classList.add('on');
      sassRerender();
    };
  });

  // Ensure new sale resets the new cart as well.
  const newSale = $('newSaleBtn');
  if (newSale) newSale.onclick = () => {
    cart = [];
    selectedCustomerId = null;
    discount = {type:'percent',value:0};
    if ($('disc')) $('disc').value = '';
    renderSassCart();
  };

  installCashUI();
  installPaymentButtons();
  sassRerender();

  // The old price buttons / product grid are intentionally hidden.
  // Camera implementation is untouched.
})();
