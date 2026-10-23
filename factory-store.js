// صفحة التصنيع — 🏬 مخزن المصنع: الكميات (من غير أسعار)، طلب خامات من مخزن الإدارة، «✅ تم الاستلام»، وفحص مرتجعات «مواصفات فنية».
// (نفس فورمات دفتر اميك — والعملية بتتسجل في الإدارة باسم موظف التصنيع)
const TRANSFER_STATUS_LABELS = { requested: 'مستني المبيعات تصرفه', issued: '🚚 في الطريق', received: '✅ اتستلم', rejected: 'مرفوض', cancelled: 'ملغي' };
const TRANSFER_STATUS_CLASS = { requested: 'st-pending', issued: 'st-approved', received: 'st-paid', rejected: 'st-rejected', cancelled: 'st-cancelled' };
const transferBadge = t => `<span class="badge ${TRANSFER_STATUS_CLASS[t.status] || ''}">${esc(TRANSFER_STATUS_LABELS[t.status] || t.status)}</span>${t.has_shortage ? ' <span class="badge st-rejected">⚠️ وصل ناقص</span>' : ''}`;
const unitQty = (isMat, q) => isMat ? qtyText(q) + ' كجم' : qtyText(q) + ' قطعة';
const lineQty = (l, q) => unitQty(l.unit === 'kg', q);
const transferOf = id => S().transfers.find(t => Number(t.id) === Number(id)) || null;
const isLowF = r => r.active && r.min != null && Number(r.qty) < Number(r.min);
// المرتجع: الكمية زي ما اترجعت (طن أو عبوات)
const retQtyText = l => l.unit === 'ton' ? `${qtyText(Number(l.kg) / 1000)} طن` : `${qtyText(l.count)} ${l.type} × ${qtyText(l.weight)} كجم`;

const STORE_TABS = [['materials', 'الخامات'], ['packaging', 'مستلزمات التعبئة'], ['leftovers', '♻️ الرواكد'], ['transfers', '🚚 التحويلات'], ['returns', '🔬 مرتجعات للفحص']];
Tabs.store = (el, params) => {
  const st = S(), tab = STORE_TABS.some(x => x[0] === params.tab) ? params.tab : 'materials';
  const count = { transfers: st.transfers.filter(t => t.status === 'issued').length, returns: st.returns.length,
    materials: st.materials.filter(isLowF).length, packaging: st.packaging.filter(isLowF).length };
  el.innerHTML = `<div class="panel"><div class="panel-head"><h2>🏬 مخزن المصنع</h2>
      <div class="tools">${tab === 'materials' || tab === 'packaging' ? `<input type="search" id="stSearch" placeholder="بحث بالاسم" style="width:220px" value="${esc(params.q || '')}">` : ''}
        <button type="button" class="primary" data-act="request">📥 طلب خامات من مخزن الإدارة</button></div></div>
      <div class="chips" id="stChips">${STORE_TABS.map(([k, l]) => `<button type="button" class="chip${k === tab ? ' active' : ''}" data-stab="${k}">${esc(l)}${count[k] ? ` <span class="nav-count">${count[k]}</span>` : ''}</button>`).join('')}</div>
      <div id="stBody" style="margin-top:12px"></div></div>`;
  const body = $('#stBody', el);
  if (tab === 'materials' || tab === 'packaging') {
    const isMat = tab === 'materials';
    const paint = () => {
      const q = normDigits(($('#stSearch', el) || {}).value || '').toLowerCase();
      const list = (isMat ? st.materials : st.packaging).filter(r => (r.active || Number(r.qty) || Number(r.transit)) && (!q || String(r.name).toLowerCase().includes(q)))
        .sort((a, b) => (isLowF(b) ? 1 : 0) - (isLowF(a) ? 1 : 0));
      body.innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>${isMat ? 'الخامة' : 'الصنف'}</th>${isMat ? '' : '<th>النوع</th>'}<th class="num">في مخزن المصنع</th><th class="num">🚚 في الطريق</th><th class="num">حد التنبيه</th></tr></thead><tbody>
        ${list.map(r => `<tr><td><b>${esc(r.name)}</b>${r.active ? '' : ` <span class="badge st-cancelled">${isMat ? 'متوقفة' : 'متوقف'}</span>`}${isLowF(r) ? ' <span class="badge st-rejected">قربت تخلص</span>' : ''}</td>
          ${isMat ? '' : `<td>${r.role === 'inner' ? 'مستلزم داخلي' : 'عبوة'}</td>`}
          <td class="num"><b class="${Number(r.qty) < 0 ? 'out' : ''}">${esc(unitQty(isMat, r.qty))}</b></td>
          <td class="num">${Number(r.transit) > 0 ? esc(unitQty(isMat, r.transit)) : '<span class="muted">—</span>'}</td>
          <td class="num">${r.min != null ? esc(unitQty(isMat, r.min)) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>
        <div class="muted" style="font-size:12px;margin-top:8px">الخامات بتتسحب من مخزن المصنع لما الباتش يتعلّم «تم التنفيذ» — وبتدخله لما تدوس «✅ تم الاستلام» على إذن التحويل.</div>`
        : '<div class="empty">مفيش أصناف هنا</div>';
    };
    paint();
    $('#stSearch', el).addEventListener('input', () => { F.params = { ...params, q: $('#stSearch', el).value }; paint(); });
  } else if (tab === 'leftovers') {
    const list = st.leftovers;
    body.innerHTML = `<div class="notice">الرواكد بتتسجل عند «تم التنفيذ» («فيه زيادة؟ كام كيلو») أو من فحص المرتجعات (اللي اتصلّح)، وبتتستخدم في أي باتش جديد من «♻️ رواكد داخلة في الباتش».</div>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>الرواكد</th><th class="num">الرصيد</th><th class="num">محجوز لباتشات</th><th class="num">متاح</th><th>اتسجلت</th></tr></thead><tbody>
        ${list.map(r => `<tr><td><b>${esc(r.name || r.product_name)}</b>${r.kind === 'return' ? ' <span class="badge st-approved">من مرتجع</span>' : ''}</td>
          <td class="num"><b>${esc(kgText(r.balance))}</b></td><td class="num">${Number(r.planned) ? esc(kgText(r.planned)) : '<span class="muted">—</span>'}</td>
          <td class="num">${esc(kgText(Math.max(0, Number(r.balance) - Number(r.planned))))}</td>
          <td class="nowrap">${esc(fmtDate(r.created_at))}${r.note ? `<div class="muted" style="font-size:12px">${esc(r.note)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">مفيش رواكد في مخزن المصنع</div>'}`;
  } else if (tab === 'transfers') {
    const pend = pendingOf('transfer_request').concat(pendingOf('transfer_receive'), pendingOf('transfer_cancel'));
    const list = st.transfers;
    const what = t => { const q = l => t.status === 'requested' ? l.requested : t.status === 'received' ? l.received : l.issued;
      const shown = t.lines.filter(l => Number(q(l)) > 0 || t.status === 'requested');
      return shown.slice(0, 3).map(l => `${l.name} ${lineQty(l, q(l))}`).join('، ') + (shown.length > 3 ? ` +${shown.length - 3}` : ''); };
    body.innerHTML = `${pend.length ? `<div class="notice warn">⏳ اتبعت ولسه الإدارة مسجّلتهوش: ${pend.map(opLabel).join('، ')}</div>` : ''}
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>رقم</th><th>الحالة</th><th>الأصناف</th><th>طلبه</th><th>خرج من مخزن الإدارة</th><th>اتستلم</th><th></th></tr></thead><tbody>
        ${list.map(t => `<tr class="row-click" data-tr="${t.id}"><td class="nowrap"><b>${esc(t.number)}</b></td><td>${transferBadge(t)}</td><td>${esc(what(t))}</td>
          <td class="nowrap">${t.requested_at ? `${esc(t.requested_by || '')}<div class="muted" style="font-size:12px">${esc(fmtDateTime(t.requested_at))}</div>` : '<span class="muted">—</span>'}</td>
          <td class="nowrap">${t.issued_at ? esc(fmtDateTime(t.issued_at)) : '<span class="muted">—</span>'}</td>
          <td class="nowrap">${t.received_at ? esc(fmtDateTime(t.received_at)) : '<span class="muted">—</span>'}</td>
          <td class="nowrap">${t.status === 'issued' ? `<button type="button" class="good small" data-recv="${t.id}">✅ تم الاستلام</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        <div class="muted" style="font-size:12px;margin-top:8px">هنا المفتوحة وآخر 14 يوم بس.</div>` : '<div class="empty">✅ مفيش تحويلات مفتوحة</div>'}`;
  } else {
    const list = st.returns, pend = pendingOf('return_inspect');
    body.innerHTML = `${pend.length ? `<div class="notice warn">⏳ اتبعت ولسه الإدارة مسجّلتهوش: ${pend.map(opLabel).join('، ')}</div>` : ''}
      ${list.length ? `<div class="notice">${list.length} مرتجع «مواصفات فنية» اتوافق عليه ومستني الفحص. افحص البضاعة ودوس «🔬 افحص»: كل صنف اتصلّح (بيدخل الرواكد) ولا تالف.</div>
      <div class="table-wrap"><table><thead><tr><th>المرتجع</th><th>الأصناف</th><th></th></tr></thead><tbody>
        ${list.map(r => `<tr><td><b>${esc(r.number)}</b> — ${esc(r.customer_name)}<div class="muted" style="font-size:12px">فاتورة ${esc(r.invoice_number)} — اتوافق ${esc(timeAgo(r.decided_at))}</div></td>
          <td>${(r.lines || []).map(l => `${esc(l.item)}${l.code ? ` <span class="muted">(${esc(l.code)})</span>` : ''} — ${esc(retQtyText(l))}${l.batch ? ` — <span class="batch-no">${esc(l.batch)}</span>` : ''}`).join('<br>')}
            <div class="muted" style="font-size:12px">السبب: ${esc(r.reason)}</div></td>
          <td class="nowrap"><button type="button" class="good small" data-insp="${r.id}">🔬 افحص</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">✓ مفيش مرتجعات مستنية الفحص</div>'}`;
  }
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-stab]'); if (c) return go('store', { tab: c.dataset.stab });
    if (e.target.closest('[data-act=request]')) return transferRequestForm();
    const rv = e.target.closest('[data-recv]'); if (rv) { e.stopPropagation(); const t = transferOf(rv.dataset.recv); return t && receiveTransferForm(t); }
    const tr = e.target.closest('tr[data-tr]'); if (tr) return showTransfer(+tr.dataset.tr);
    const ins = e.target.closest('[data-insp]'); if (ins) { const r = st.returns.find(x => Number(x.id) === +ins.dataset.insp); return r && inspectReturnForm(r); }
  });
};

// ---------- إذن التحويل
function transferLinesHtml(t) {
  const q = v => v == null ? '<span class="muted">—</span>' : esc(qtyText(v));
  const issued = t.issued_at != null, received = t.status === 'received';
  return `<table><thead><tr><th>#</th><th>الصنف</th><th class="num">المطلوب</th>${issued ? '<th class="num">خرج</th>' : ''}${received ? '<th class="num">وصل</th><th>الناقص</th>' : ''}</tr></thead><tbody>
    ${t.lines.map(l => `<tr><td>${l.line_no}</td><td>${esc(l.name)} <span class="muted">(${l.unit === 'kg' ? 'كجم' : 'قطعة'})</span></td><td class="num">${q(l.requested)}</td>
      ${issued ? `<td class="num"><b class="${Number(l.issued) !== Number(l.requested) ? 'out' : ''}">${q(l.issued)}</b></td>` : ''}
      ${received ? `<td class="num"><b class="${Number(l.received) !== Number(l.issued) ? 'out' : ''}">${q(l.received)}</b></td>
        <td>${Number(l.issued) > Number(l.received || 0) ? `<span class="out">${esc(qtyText(Number(l.issued) - Number(l.received || 0)))}</span> — ${esc(l.reason || '')}` : '<span class="muted">—</span>'}</td>` : ''}</tr>`).join('')}
    </tbody></table>`;
}
function transferSheetHtml(t) {
  const closed = ['rejected', 'cancelled'].includes(t.status);
  return `<div class="sheet${closed ? ' sheet-cancelled' : ''}">
    ${closed ? `<div class="sheet-watermark"><span>${t.status === 'rejected' ? 'مرفوض' : 'ملغي'}</span></div>` : ''}
    <div class="sheet-head"><div><div class="sheet-title">إذن تحويل</div><div class="sheet-sub">من مخزن الإدارة إلى مخزن المصنع</div></div>
      <div class="sheet-no"><small>رقم الإذن</small><b>${esc(t.number)}</b><small>${esc(TRANSFER_STATUS_LABELS[t.status] || t.status)}</small></div></div>
    <div class="sheet-info">
      <div><small>طلبه</small><b>${t.requested_at ? `${esc(t.requested_by || '')} — ${esc(fmtDateTime(t.requested_at))}` : '—'}</b></div>
      <div><small>خرج من مخزن الإدارة</small><b>${t.issued_at ? esc(fmtDateTime(t.issued_at)) : '—'}</b></div>
      <div><small>اتستلم في مخزن المصنع</small><b>${t.received_at ? esc(fmtDateTime(t.received_at)) : '—'}</b></div>
      <div><small>${t.closed_at ? (t.status === 'rejected' ? 'اترفض' : 'اتلغى') : 'ملاحظة'}</small><b>${esc(t.closed_at ? t.close_reason || '' : [t.note, t.issue_note].filter(Boolean).join(' — ') || '—')}</b></div>
    </div>
    ${transferLinesHtml(t).replace('<table>', '<table class="report-table">')}
    <div class="sheet-sign"><div>مخزن الإدارة<span></span></div><div>المستلم (السواق)<span></span></div><div>مخزن المصنع<span></span></div></div>
    <div class="sheet-foot">اتطبع ${esc(fmtDateTime(new Date().toISOString()))} — ${esc(S().actor)}</div></div>`;
}
function showTransfer(id) {
  const t = transferOf(id); if (!t) return;
  const mine = t.requested_by && t.requested_by === S().actor, acts = [];
  if (t.status === 'issued') acts.push('<button type="button" class="good" data-act="receive">✅ تم الاستلام</button>');
  if (t.status === 'requested' && mine) acts.push('<button type="button" class="danger" data-act="close">إلغاء الطلب</button>');
  acts.push('<button type="button" class="secondary" data-act="print">🖨️ طباعة</button>');
  const it = [];
  if (t.requested_at) it.push(`<li>📥 <b>${esc(t.requested_by || '')}</b> طلبه — ${esc(fmtDateTime(t.requested_at))}${t.note ? `<br><span class="muted">${esc(t.note)}</span>` : ''}</li>`);
  else if (t.note) it.push(`<li>📝 ${esc(t.note)}</li>`);
  if (t.issued_at) it.push(`<li>🚚 خرج من مخزن الإدارة — ${esc(fmtDateTime(t.issued_at))}${t.issue_note ? `<br><span class="muted">${esc(t.issue_note)}</span>` : ''}</li>`);
  if (t.received_at) it.push(`<li>✅ اتستلم في مخزن المصنع — ${esc(fmtDateTime(t.received_at))}</li>`);
  if (t.closed_at) it.push(`<li>🚫 ${t.status === 'rejected' ? 'اترفض' : 'اتلغى'} — ${esc(fmtDateTime(t.closed_at))}<br><span class="muted">${esc(t.close_reason || '')}</span></li>`);
  const m = openModal({
    title: 'إذن تحويل ' + t.number, small: 'من مخزن الإدارة إلى مخزن المصنع', wide: true,
    body: `${t.status === 'issued' ? '<div class="notice">🚚 الخامات خرجت من مخزن الإدارة وفي الطريق — مبتدخلش مخزن المصنع غير لما تدوس «✅ تم الاستلام».</div>' : ''}
      <div class="kv"><div><small>الحالة</small>${transferBadge(t)}</div></div>
      <div class="table-wrap">${transferLinesHtml(t)}</div>
      <h3>اللي حصل</h3><ul class="timeline">${it.join('')}</ul>
      <div class="modal-actions">${acts.join('')}</div>`,
  });
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'print') return printHtml(transferSheetHtml(t));
    if (b.dataset.act === 'receive') { m.close(); return receiveTransferForm(t); }
    if (b.dataset.act === 'close') {
      const why = await promptBox('إلغاء الطلب ' + t.number, 'السبب', { ok: 'إلغاء الطلب', cls: 'danger', hint: 'السبب هيوصل للمبيعات.' });
      if (why == null) return;
      await busy(b, async () => { const r = await submitOp({ op: 'transfer_cancel', transfer_id: String(t.id), reason: why, label: `🚫 إلغاء طلب التحويل ${t.number}` });
        if (r.state === 'failed') return showError(null, r.error); m.close(); afterSubmit(r, 'اتلغى الطلب'); });
    }
  });
}

// 📥 طلب خامات من مخزن الإدارة ← المبيعات بتعمل إذن التحويل
function transferRequestForm() {
  const st = S();
  const items = st.materials.filter(r => r.active).map(r => ({ key: 'm:' + r.id, id: r.id, mat: true, name: r.name, qty: r.qty, min: r.min }))
    .concat(st.packaging.filter(r => r.active).map(r => ({ key: 'p:' + r.id, id: r.id, mat: false, name: r.name, qty: r.qty, min: r.min })));
  const g = (mat, l) => { const list = items.filter(r => r.mat === mat); return list.length ? `<optgroup label="${l}">${list.map(r => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}</optgroup>` : ''; };
  const opts = '<option value="">اختار الصنف</option>' + g(true, 'الخامات (بالكيلو)') + g(false, 'مستلزمات التعبئة (بالقطعة)');
  const low = items.filter(r => r.min != null && Number(r.qty) < Number(r.min));
  const m = openModal({
    title: '📥 طلب خامات من مخزن الإدارة', wide: true,
    body: `<div class="notice">الطلب هيروح للمبيعات تعمل إذن التحويل. الخامات بتدخل مخزن المصنع لما توصل وتدوس «✅ تم الاستلام».</div>
      ${low.length ? `<div class="tools" style="margin-bottom:8px"><button type="button" class="secondary small" id="tfLow">➕ ضيف اللي قربت تخلص (${low.length})</button></div>` : ''}
      <div class="table-wrap"><table class="lines-edit"><thead><tr><th>الصنف</th><th class="col-qty">الكمية</th><th class="num">في مخزن المصنع</th><th class="col-x"></th></tr></thead><tbody id="tfRows"></tbody></table></div>
      <button type="button" class="secondary small" id="tfAdd" style="margin-top:8px">+ صنف</button>
      <label style="margin-top:12px">ملاحظة (اختياري)<input id="tfNote" maxlength="300" placeholder="مثلًا: لباتشات الأسبوع"></label>
      <div class="form-error hidden" id="tfErr"></div>
      <div class="modal-actions"><button type="button" class="primary" id="tfOk">📥 ابعت الطلب</button><button type="button" class="secondary" id="tfBack">رجوع</button></div>`,
  });
  const b = m.el, tbody = $('#tfRows', b);
  const itemOf = tr => items.find(r => r.key === $('[data-f=item]', tr).value) || null;
  const sync = tr => { const r = itemOf(tr);
    $('[data-fac]', tr).textContent = r ? unitQty(r.mat, r.qty) : '—';
    $('[data-f=qty]', tr).placeholder = r ? (r.mat ? 'كجم' : 'قطعة') : ''; };
  const add = key => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select data-f="item" aria-label="الصنف">${opts}</select></td><td><input data-f="qty" inputmode="decimal" dir="ltr" aria-label="الكمية"></td>
      <td class="num" data-fac>—</td><td><button type="button" class="danger small" data-del title="شيل">×</button></td>`;
    tbody.appendChild(tr); if (key) $('[data-f=item]', tr).value = key; sync(tr); return tr;
  };
  tbody.addEventListener('change', e => { const tr = e.target.closest('tr'); if (tr) sync(tr); });
  tbody.addEventListener('click', e => { if (!e.target.closest('[data-del]')) return; const tr = e.target.closest('tr');
    if ($$('tr', tbody).length > 1) tr.remove(); else { $('[data-f=item]', tr).value = ''; $('[data-f=qty]', tr).value = ''; sync(tr); } });
  $('#tfAdd', b).addEventListener('click', () => $('[data-f=item]', add()).focus());
  if ($('#tfLow', b)) $('#tfLow', b).addEventListener('click', e => {
    const have = new Set($$('[data-f=item]', tbody).map(s => s.value).filter(Boolean));
    $$('tr', tbody).filter(tr => !$('[data-f=item]', tr).value && !$('[data-f=qty]', tr).value.trim()).forEach(tr => tr.remove());
    low.filter(r => !have.has(r.key)).forEach(r => add(r.key));
    if (!$$('tr', tbody).length) add();
    e.currentTarget.disabled = true;
  });
  $('#tfBack', b).addEventListener('click', () => m.close());
  add();
  $('#tfOk', b).addEventListener('click', async e => {
    const btn = e.currentTarget, err = $('#tfErr', b); err.classList.add('hidden');
    const out = [], names = [], seen = new Set(); let problem = null;
    $$('tr', tbody).forEach((tr, i) => {
      if (problem) return;
      const r = itemOf(tr), raw = $('[data-f=qty]', tr).value.trim();
      if (!r && !raw) return;
      if (!r) { problem = `اختار الصنف في السطر رقم ${i + 1}`; return; }
      if (seen.has(r.key)) { problem = `«${r.name}» متكرر`; return; }
      seen.add(r.key);
      const q = parseScaled(raw, r.mat ? 3 : 0);
      if (q == null || q <= 0n) { problem = `كمية «${r.name}» مش مظبوطة${r.mat ? '' : ' (عدد صحيح)'}`; return; }
      out.push({ [r.mat ? 'material_id' : 'packaging_id']: r.id, qty: scaledToString(q, r.mat ? 3 : 0) });
      names.push(r.name);
    });
    if (!problem && !out.length) problem = 'اختار صنف واحد على الأقل';
    if (problem) return showError(err, problem);
    await busy(btn, async () => {
      const r = await submitOp({ op: 'transfer_request', lines: out, note: $('#tfNote', b).value.trim() || null,
        label: `📥 طلب خامات — ${names.slice(0, 3).join('، ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` });
      if (r.state === 'failed') return showError(err, r.error);
      m.close(); afterSubmit(r, r.result && r.result.number ? `📥 الطلب ${r.result.number} راح للمبيعات` : '📥 الطلب راح للمبيعات');
      if (F.tab === 'store') go('store', { tab: 'transfers' });
    });
  });
}

// «✅ تم الاستلام» — اللي وصل فعلًا من كل صنف، والناقص لازم سببه (بيوصل لمدير الحسابات)
function receiveTransferForm(t) {
  const out = t.lines.filter(l => Number(l.issued) > 0);
  const m = openModal({
    title: '✅ استلام إذن التحويل ' + t.number, small: 'في مخزن المصنع', wide: true,
    body: `<div class="notice">اكتب اللي وصل فعلًا. لو وصل كله سيبه زي ما هو. لو فيه ناقص لازم تكتب السبب — وبيوصل لمدير الحسابات.</div>
      <div class="table-wrap"><table class="lines-edit"><thead><tr><th>الصنف</th><th class="num">خرج</th><th class="col-qty">وصل</th><th>سبب الناقص</th></tr></thead><tbody id="rtRows">
        ${out.map(l => `<tr data-ln="${l.line_no}"><td>${esc(l.name)}</td><td class="num">${esc(lineQty(l, l.issued))}</td>
          <td><input data-f="got" inputmode="decimal" dir="ltr" value="${esc(String(Number(l.issued)))}" aria-label="وصل"></td>
          <td><input data-f="why" maxlength="200" placeholder="لو وصل أقل" aria-label="سبب الناقص"></td></tr>`).join('')}
      </tbody></table></div>
      <label style="margin-top:12px">ملاحظة (اختياري)<input id="rtNote" maxlength="300"></label>
      <div class="form-error hidden" id="rtErr"></div>
      <div class="modal-actions"><button type="button" class="good" id="rtOk">✅ تم الاستلام</button><button type="button" class="secondary" id="rtBack">رجوع</button></div>`,
  });
  const b = m.el;
  $('#rtBack', b).addEventListener('click', () => m.close());
  $('#rtOk', b).addEventListener('click', async e => {
    const btn = e.currentTarget, err = $('#rtErr', b); err.classList.add('hidden');
    let problem = null, short = 0;
    const res = $$('tr[data-ln]', b).map(tr => {
      const l = out.find(x => x.line_no === +tr.dataset.ln), sc = l.unit === 'kg' ? 3 : 0, raw = $('[data-f=got]', tr).value.trim(), why = $('[data-f=why]', tr).value.trim();
      const q = parseScaled(raw, sc), iss = parseScaled(String(Number(l.issued)), sc);
      if (!problem && q == null) problem = `اللي وصل من «${l.name}» مش مظبوط${sc ? '' : ' (عدد صحيح)'}`;
      else if (!problem && q > iss) problem = `اللي وصل من «${l.name}» أكتر من اللي خرج — راجع المبيعات`;
      else if (!problem && q < iss && why.length < 2) problem = `وصل من «${l.name}» أقل من اللي خرج — اكتب السبب`;
      if (q != null && q < iss) short++;
      return { line_no: l.line_no, received: q == null ? raw : scaledToString(q, sc), ...(why ? { reason: why } : {}) };
    });
    if (problem) return showError(err, problem);
    if (short && !await confirmBox('فيه ناقص', `${short} صنف وصل أقل من اللي خرج — الناقص هيتسجل بسببه ويوصل لمدير الحسابات.`, { ok: 'تم الاستلام' })) return;
    await busy(btn, async () => {
      const r = await submitOp({ op: 'transfer_receive', transfer_id: String(t.id), lines: res, note: $('#rtNote', b).value.trim() || null, label: `✅ استلام إذن التحويل ${t.number}${short ? ' (ناقص)' : ''}` });
      if (r.state === 'failed') return showError(err, r.error);
      m.close(); afterSubmit(r, '✅ دخل مخزن المصنع');
    });
  });
}

// ---------- 🔬 فحص مرتجع «مواصفات فنية»: كل صنف اتصلّح (بالكيلو اللي دخل الرواكد) ولا تالف — و«بيتشتري جاهز» سليم ولا تالف
function inspectReturnForm(r) {
  const condSel = l => l.goods
    ? `<option value="">اختار</option><option value="good">✓ سليم — يرجع المخزن</option><option value="damaged">✗ تالف</option>`
    : `<option value="">اختار</option><option value="repaired">♻️ اتصلّح — يدخل الرواكد</option><option value="damaged">✗ تالف</option>`;
  const m = openModal({
    title: '🔬 فحص المرتجع ' + r.number, small: `${r.customer_name || ''}${r.invoice_number ? ' — فاتورة ' + r.invoice_number : ''}`, wide: true,
    body: `<div class="notice">مرتجع «مواصفات فنية»: علّم كل صنف — <b>♻️ اتصلّح</b> واكتب الكيلوهات اللي اتصلّحت (بتدخل «♻️ الرواكد» في مخزن المصنع وتتستخدم في أي باتش)، أو <b>✗ تالف</b>.</div>
      <div class="muted" style="margin-bottom:8px">السبب: ${esc(r.reason || '')}</div>
      <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>النتيجة</th></tr></thead><tbody>
        ${r.lines.map(l => `<tr data-ln="${l.line_no}" data-total="${esc(String(l.total_kg))}"><td><b>${esc(l.item)}</b>${l.code ? ` <span class="muted">(${esc(l.code)})</span>` : ''}
            <div class="muted" style="font-size:12px">${l.goods ? esc(retQtyText(l)) : l.unit === 'ton' ? esc(kgText(l.total_kg)) : `${esc(retQtyText(l))} = ${esc(qtyText(l.total_kg))} كجم`}${l.batch ? ` — باتش <span class="batch-no">${esc(l.batch)}</span>` : ''}</div></td>
          <td><select data-cond style="width:auto" aria-label="نتيجة فحص ${esc(l.item)}">${condSel(l)}</select>
            ${l.goods ? '' : `<label class="hidden" data-kg-box style="margin-top:6px">اتصلّح كام كيلو<input data-kg inputmode="decimal" dir="ltr" style="width:110px" value="${esc(String(Number(l.total_kg)))}"></label>`}</td></tr>`).join('')}</tbody></table></div>
      <label style="margin-top:10px">ملاحظة (اختياري)<input id="riNote" maxlength="300" placeholder="زي: اتظبط اللون بإضافة صبغة"></label>
      <div class="form-error hidden" id="riErr"></div>
      <div class="modal-actions"><button type="button" class="good" id="riOk">🔬 تأكيد الفحص</button><button type="button" class="secondary" id="riBack">رجوع</button></div>`,
  });
  const b = m.el;
  b.addEventListener('change', e => {
    const s = e.target.closest('[data-cond]'); if (!s) return;
    const box = $('[data-kg-box]', s.closest('tr')); if (box) box.classList.toggle('hidden', s.value !== 'repaired');
  });
  $('#riBack', b).addEventListener('click', () => m.close());
  $('#riOk', b).addEventListener('click', async e => {
    const btn = e.currentTarget, err = $('#riErr', b);
    const lines = [];
    for (const tr of $$('tr[data-ln]', b)) {
      const cond = $('[data-cond]', tr).value, name = $('td b', tr).textContent;
      if (!cond) return showError(err, `«${name}»: علّم ${$('[data-kg-box]', tr) ? 'اتصلّح ولا تالف' : 'سليم ولا تالف'}`);
      const line = { line_no: +tr.dataset.ln, condition: cond };
      if (cond === 'repaired') {
        const raw = normDigits($('[data-kg]', tr).value).trim(), g = parseScaled(raw, 3), total = parseScaled(String(tr.dataset.total), 3);
        if (g == null || g <= 0n) return showError(err, `«${name}»: اكتب الكيلوهات اللي اتصلّحت (لحد 3 أرقام بعد العلامة)`);
        if (total != null && g > total) return showError(err, `«${name}»: اللي اتصلّح أكتر من اللي رجع (${kgText(tr.dataset.total)})`);
        line.kg = scaledToString(g, 3);
      }
      lines.push(line);
    }
    const rep = lines.filter(l => l.condition === 'repaired'), bad = lines.filter(l => l.condition === 'damaged').length, ok = lines.filter(l => l.condition === 'good').length;
    const repKg = rep.reduce((s, l) => s + Number(l.kg), 0);
    if (!await confirmBox('تأكيد فحص المرتجع ' + r.number, `اتصلّح ${rep.length}${rep.length ? ` (${esc(kgText(repKg))} للرواكد)` : ''}${ok ? ` — سليم ${ok}` : ''} — تالف ${bad}`, { ok: 'تأكيد', cls: 'good' })) return;
    await busy(btn, async () => {
      const res = await submitOp({ op: 'return_inspect', return_id: String(r.id), lines, note: $('#riNote', b).value.trim() || null, label: `🔬 فحص المرتجع ${r.number}` });
      if (res.state === 'failed') return showError(err, res.error);
      m.close(); afterSubmit(res, rep.length ? '✅ اتفحص — اللي اتصلّح دخل الرواكد' : '✅ اتفحص');
    });
  });
}
