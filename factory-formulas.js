// صفحة التصنيع — 🧪 التركيبات: عرض وتعديل (نفس فورم «تعديل التركيبة» في دفتر اميك — الكميات بالكيلو لكل طن، والمجموع طن بالظبط).
Tabs.formulas = (el, params) => {
  const st = S(), pend = pendingOf('formula_save');
  el.innerHTML = `<div class="panel"><div class="panel-head"><h2>🧪 المنتجات والتركيبات</h2>
      <div class="tools"><input type="search" id="prSearch" placeholder="بحث باسم المنتج أو الخامة" style="width:240px" value="${esc(params.q || '')}">
        <button type="button" class="primary" id="prNew">+ منتج جديد</button></div></div>
      ${pend.length ? `<div class="notice warn">⏳ ${pend.length} تعديل تركيبة اتبعت ولسه الإدارة مسجّلتهوش: ${pend.map(opLabel).join('، ')}</div>` : ''}
      ${st.products.length ? '' : '<div class="empty">مفيش منتجات لسه. ابدأ بـ «+ منتج جديد» واكتب خامات التركيبة بالكيلو لكل طن.</div>'}
      <div class="table-wrap" id="prTable"></div></div>`;
  const paint = () => {
    const q = normDigits($('#prSearch', el).value).toLowerCase();
    const list = st.products.filter(p => !q || p.name.toLowerCase().includes(q) || p.lines.some(l => String(l.material).toLowerCase().includes(q)));
    $('#prTable', el).innerHTML = list.length ? `<table><thead><tr><th>المنتج</th><th>الخامات</th><th>إصدار التركيبة</th><th>آخر تعديل</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr><td><b>${esc(p.name)}</b>${p.notes ? `<div class="muted" style="font-size:12px">${esc(p.notes)}</div>` : ''}</td>
        <td>${p.lines.length} خامة</td><td>${esc(p.formula_version)}</td>
        <td class="nowrap">${esc(p.updated_by || '')}<div class="muted" style="font-size:12px">${esc(fmtDate(p.updated_at))}</div></td>
        <td>${p.active ? '<span class="badge st-paid">شغال</span>' : '<span class="badge st-cancelled">متوقف</span>'}</td>
        <td class="nowrap"><button type="button" class="secondary small" data-view="${p.id}">عرض</button>
          <button type="button" class="secondary small" data-edit="${p.id}">تعديل التركيبة</button>
          ${p.active ? `<button type="button" class="primary small" data-batch="${p.id}">🏭 أمر تصنيع</button>` : ''}</td></tr>`).join('')}
      </tbody></table>` : (st.products.length ? '<div class="empty">مفيش نتايج</div>' : '');
  };
  paint();
  $('#prSearch', el).addEventListener('input', () => { F.params = { ...params, q: $('#prSearch', el).value }; paint(); });
  $('#prNew', el).addEventListener('click', () => productForm(null));
  el.addEventListener('click', e => {
    const v = e.target.closest('[data-view]'); if (v) return formulaView(productOf(v.dataset.view));
    const ed = e.target.closest('[data-edit]'); if (ed) return productForm(productOf(ed.dataset.edit));
    const bt = e.target.closest('[data-batch]'); if (bt) return batchForm(productOf(bt.dataset.batch));
  });
};

// عرض التركيبة + طباعتها
function formulaSheetHtml(p) {
  return `<div class="sheet"><div class="sheet-head"><div><div class="sheet-title">تركيبة</div><div class="sheet-sub">${esc(p.name)}</div></div>
      <div class="sheet-no"><small>إصدار التركيبة</small><b>${esc(p.formula_version)}</b></div></div>
    <table class="sheet-table"><thead><tr><th>#</th><th>الخامة</th><th class="num">كجم لكل طن</th><th class="num">النسبة</th><th class="sheet-notes">ملاحظات</th></tr></thead><tbody>
      ${p.lines.map(l => `<tr><td>${l.line_no}</td><td>${esc(l.material)}</td><td class="num"><b>${esc(qtyText(l.qty_per_ton))}</b></td><td class="num">${esc(pct(l.qty_per_ton))}</td><td class="sheet-notes">${esc(l.note || '')}</td></tr>`).join('')}
    </tbody><tfoot><tr><td></td><td>المجموع</td><td class="num">1,000</td><td class="num">100%</td><td></td></tr></tfoot></table>
    <div class="sheet-foot">آخر تعديل ${esc(p.updated_by || '')} — ${esc(fmtDateTime(p.updated_at))} — اتطبعت ${esc(fmtDateTime(new Date().toISOString()))}</div></div>`;
}
function formulaView(p) {
  if (!p) return showError(null, 'المنتج ده مش موجود — حدّث الصفحة');
  const m = openModal({
    title: p.name, small: `التركيبة — إصدار ${p.formula_version}`, wide: true,
    body: `<div class="table-wrap"><table><thead><tr><th>#</th><th>الخامة</th><th class="num">كجم لكل طن</th><th class="num">النسبة</th><th>ملاحظات</th></tr></thead><tbody>
      ${p.lines.map(l => `<tr><td>${l.line_no}</td><td>${esc(l.material)}</td><td class="num">${esc(qtyText(l.qty_per_ton))}</td><td class="num">${esc(pct(l.qty_per_ton))}</td><td>${esc(l.note || '')}</td></tr>`).join('')}
      </tbody><tfoot><tr><td></td><td>المجموع</td><td class="num">1,000</td><td class="num">100%</td><td></td></tr></tfoot></table></div>
      <div class="muted" style="font-size:12px;margin-top:8px">آخر تعديل: ${esc(p.updated_by || '')} — ${esc(fmtDateTime(p.updated_at))}</div>
      <div class="modal-actions"><button type="button" class="secondary" data-act="print">🖨️ طباعة</button><button type="button" class="primary" data-act="edit">تعديل التركيبة</button>
        ${p.active ? '<button type="button" class="secondary" data-act="batch">🏭 أمر تصنيع</button>' : ''}</div>`,
  });
  m.el.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'print') return printHtml(formulaSheetHtml(p));
    m.close();
    if (a.dataset.act === 'edit') productForm(p); else batchForm(p);
  });
}

// ---------- إضافة / تعديل منتج (التعديل بيتسجل في الإدارة: إصدار جديد للتركيبة، والباتشات القديمة مش بتتأثر)
function productForm(p) {
  const isNew = !p, materials = S().materials;
  const m = openModal({
    title: isNew ? 'منتج جديد' : 'تعديل «' + p.name + '»', small: isNew ? '' : `التركيبة دلوقتي إصدار ${p.formula_version} — لو غيّرت الكميات هتبقى إصدار ${Number(p.formula_version) + 1}، والباتشات القديمة مش هتتأثر`, wide: true,
    body: `<label>اسم المنتج<input id="pfName" maxlength="120" value="${esc(p ? p.name : '')}" placeholder="مثلًا: معجون أكريليك أبيض"></label>
      <h3>التركيبة — الكميات بالكيلو لكل 1 طن</h3>
      <datalist id="pfMaterials">${materials.map(x => `<option value="${esc(x.name)}"></option>`).join('')}</datalist>
      <div class="table-wrap"><table class="lines-edit"><thead><tr><th>#</th><th class="col-mat">الخامة</th><th class="col-qty">كجم لكل طن</th><th class="col-pct num">النسبة</th><th>ملاحظات (مثلًا: الصالة عدّلت كام)</th><th class="col-x"></th></tr></thead><tbody id="pfLines"></tbody></table></div>
      <button type="button" class="secondary small" id="pfAdd" style="margin-top:8px">+ خامة</button>
      <div class="summary" id="pfSumBox"><span id="pfSumNote"></span><strong id="pfSum"></strong></div>
      ${isNew ? '' : `<label class="check"><input type="checkbox" id="pfActive" ${p.active ? 'checked' : ''}> المنتج شغال (لو اتشالت العلامة، مينفعش يتعمله أوامر تصنيع جديدة)</label>`}
      <div class="form-error hidden" id="pfErr"></div>
      <div class="modal-actions"><button type="button" class="primary" id="pfOk">حفظ التركيبة</button><button type="button" class="secondary" id="pfBack">رجوع</button></div>`,
  });
  const b = m.el, tbody = $('#pfLines', b);
  const addLine = (v = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="muted" data-no></td><td><input data-f="material" list="pfMaterials" maxlength="80" value="${esc(v.material || '')}"></td>
      <td><input data-f="qty_per_ton" inputmode="decimal" dir="ltr" value="${esc(v.qty_per_ton != null ? qtyText(v.qty_per_ton).replace(/,/g, '') : '')}"></td>
      <td class="num" data-pct>—</td><td><input data-f="note" maxlength="200" value="${esc(v.note || '')}"></td>
      <td><button type="button" class="danger small" data-del title="شيل الخامة">×</button></td>`;
    tbody.appendChild(tr); recalc();
    return tr;
  };
  // المجموع بالجرام (أرقام صحيحة) عشان 1000 تبقى 1000 بالظبط
  const recalc = () => {
    let total = 0n, bad = false;
    $$('tr', tbody).forEach((tr, i) => {
      $('[data-no]', tr).textContent = i + 1;
      const q = parseScaled($('[data-f=qty_per_ton]', tr).value, 3);
      $('[data-pct]', tr).textContent = q == null ? '—' : qtyText(Number(scaledToString(q, 3)) / 10) + '%';
      if (q == null) bad = true; else total += q;
    });
    const diff = 1000000n - total, box = $('#pfSumBox', b);
    $('#pfSum', b).textContent = qtyText(Number(scaledToString(total, 3))) + ' كجم';
    $('#pfSumNote', b).textContent = diff === 0n && !bad ? '✅ المجموع طن بالظبط' : diff > 0n ? `المجموع — ناقص ${qtyText(Number(scaledToString(diff, 3)))} كجم عشان يكمل طن` : diff < 0n ? `المجموع — زيادة ${qtyText(Number(scaledToString(-diff, 3)))} كجم عن الطن` : 'المجموع';
    box.classList.toggle('sum-ok', diff === 0n && !bad); box.classList.toggle('sum-bad', diff !== 0n);
    return { total, bad };
  };
  tbody.addEventListener('input', recalc);
  tbody.addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return;
    if ($$('tr', tbody).length > 1) { e.target.closest('tr').remove(); recalc(); }
    else $$('input', e.target.closest('tr')).forEach(i => i.value = '');
  });
  $('#pfAdd', b).addEventListener('click', () => $('[data-f=material]', addLine()).focus());
  $('#pfBack', b).addEventListener('click', () => m.close());
  (p && p.lines.length ? p.lines : [{}, {}, {}]).forEach(l => addLine(l));

  $('#pfOk', b).addEventListener('click', async e => {
    const btn = e.currentTarget, err = $('#pfErr', b); err.classList.add('hidden');
    const name = $('#pfName', b).value.trim();
    const rows = $$('tr', tbody).map(tr => ({ material: $('[data-f=material]', tr).value.trim(), qty_per_ton: normDigits($('[data-f=qty_per_ton]', tr).value), note: $('[data-f=note]', tr).value.trim() }))
      .filter(r => r.material || r.qty_per_ton || r.note);
    const names = rows.map(r => r.material.replace(/\s+/g, ' ').toLowerCase());
    const { total } = recalc();
    const badQty = rows.find(r => parseScaled(r.qty_per_ton, 3) == null || parseScaled(r.qty_per_ton, 3) <= 0n);
    const problem = name.length < 2 ? 'اكتب اسم المنتج'
      : !rows.length ? 'اكتب خامات التركيبة'
      : rows.findIndex(r => !r.material) >= 0 ? `السطر رقم ${rows.findIndex(r => !r.material) + 1} من غير اسم خامة`
      : badQty ? `كمية «${badQty.material}» مش مظبوطة (رقم أكبر من صفر، لحد 3 أرقام بعد العلامة)`
      : names.some((n, i) => names.indexOf(n) !== i) ? `الخامة «${rows[names.findIndex((n, i) => names.indexOf(n) !== i)].material}» مكتوبة مرتين`
      : total !== 1000000n ? 'مجموع التركيبة لازم يبقى 1000 كجم (طن) بالظبط' : null;
    if (problem) return showError(err, problem);
    await busy(btn, async () => {
      const r = await submitOp({ op: 'formula_save', product_id: p ? String(p.id) : null, name, notes: p ? p.notes || null : null,
        active: isNew ? 'true' : String($('#pfActive', b).checked), lines: rows, label: `🧪 ${isNew ? 'منتج جديد' : 'تعديل تركيبة'} — ${name}` });
      if (r.state === 'failed') return showError(err, r.error);
      m.close(); afterSubmit(r, '✅ اتحفظت التركيبة');
    });
  });
}
