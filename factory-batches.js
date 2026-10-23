// صفحة التصنيع — أوامر التصنيع والتنفيذ (نفس فورم أمر التصنيع وورقة التصنيع وتعديل الصالة اللي في دفتر اميك، بس العملية بتتبعت للإدارة).
const BATCH_STATUS_LABELS = { in_progress: 'بيتعمل', done: 'تم التنفيذ', cancelled: 'ملغي' };
const BATCH_STATUS_CLASS = { in_progress: 'st-pending', done: 'st-paid', cancelled: 'st-cancelled' };
const batchBadge = st => `<span class="badge ${BATCH_STATUS_CLASS[st] || ''}">${esc(BATCH_STATUS_LABELS[st] || st)}</span>`;
const approvalBadge = b => b.approval_status === 'waiting' ? ' <span class="badge st-pending">⏳ مستني المالية</span>' : b.approval_status === 'approved' ? ' <span class="badge st-paid">✓ المالية وافقت</span>' : '';
const startedBadge = b => b.status === 'in_progress' && b.started_at ? ' <span class="badge st-approved">🏭 جاري التنفيذ</span>' : '';
const productOf = id => S().products.find(p => Number(p.id) === Number(id)) || null;
const batchOf = id => S().batches.find(b => Number(b.id) === Number(id)) || null;
const lineQtyText = r => r.price_unit === 'ton' ? `${qtyText(Number(r.quantity_kg) / 1000)} طن` : `${qtyText(r.package_count)} ${r.package_type} × ${qtyText(r.unit_weight_kg)} كجم`;
// العمليات اللي اتبعتت ولسه الإدارة مسجّلتهاش (عشان تبان في مكانها كـ«مستنية»)
const pendingOf = op => waitingOps().filter(w => w.payload && w.payload.op === op);

// ---------- 🏭 أوامر التصنيع: الطلبات المحتاجة تصنيع + أوامر التصنيع (آخر 30 يوم واللي بيتعمل)
Tabs.orders = (el, params) => {
  const st = S(), q = (params.q || '').trim().toLowerCase(), status = params.status || 'all';
  const peb = (oid, ln) => (st.pebbles.find(x => Number(x.order_id) === Number(oid) && Number(x.line_no) === Number(ln)) || {}).pebble || null;
  const list = st.batches.filter(b => (status === 'all' || b.status === status) && (!q || [b.number, b.code, b.product_name, b.customer].some(v => String(v || '').toLowerCase().includes(q))));
  const pend = pendingOf('batch_create');
  el.innerHTML = `${st.to_make.length ? `<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>🏭 طلبات محتاجة تصنيع (${st.to_make.length})</h2></div>
      <div class="notice">طلبات العملاء المعتمدة. «🏭 أمر تصنيع» بيعمل الباتش محجوز للطلب وعميله، ولما يتعلّم «تم التنفيذ» بيظهر للمبيعات في «جاهز للتسليم».</div>
      <div class="table-wrap"><table><thead><tr><th>الطلب</th><th>العميل</th><th>الصنف</th><th>المطلوب</th><th class="num">اتعمل له</th><th class="num">فاضل يتصنع</th><th></th></tr></thead><tbody>
        ${st.to_make.map((r, i) => { const pb = peb(r.order_id, r.line_no); return `<tr><td class="nowrap"><b>${esc(r.order_number)}</b><div class="muted" style="font-size:12px">${esc(fmtDate(r.approved_at))}</div></td><td>${esc(r.customer_name)}</td>
          <td>${esc(r.product_name)}${r.code || pb ? `<div class="muted" style="font-size:12px">${esc([r.code, pb ? 'حصوة ' + pb : ''].filter(Boolean).join(' — '))}</div>` : ''}</td><td class="nowrap">${esc(lineQtyText(r))}</td>
          <td class="num">${Number(r.made_kg) + Number(r.other_out_kg) ? esc(kgText(Number(r.made_kg) + Number(r.other_out_kg))) : '<span class="muted">—</span>'}</td>
          <td class="num"><b>${esc(kgText(r.left_kg))}</b></td><td class="nowrap"><button type="button" class="primary small" data-make="${i}">🏭 أمر تصنيع</button></td></tr>`; }).join('')}
      </tbody></table></div></div>` : ''}
    <div class="panel"><div class="panel-head"><h2>أوامر التصنيع (الباتشات)</h2>
      <div class="tools"><input type="search" id="baSearch" placeholder="بحث بالكود أو رقم الباتش أو المنتج أو العميل" style="width:300px" value="${esc(params.q || '')}">
        <button type="button" class="secondary" data-act="plan">📋 خطة الإنتاج</button><button type="button" class="primary" data-act="new">🏭 أمر تصنيع جديد</button></div></div>
      ${pend.length ? `<div class="notice warn">⏳ ${pend.length} أمر تصنيع اتبعت ولسه الإدارة مسجّلتهوش — رقمه هيظهر هنا أول ما يتسجل: ${pend.map(opLabel).join('، ')}</div>` : ''}
      <div class="chips" id="baChips">${[['all', 'الكل'], ['in_progress', 'بيتعمل'], ['done', 'تم التنفيذ'], ['cancelled', 'ملغي']].map(([k, l]) => `<button type="button" class="chip${k === status ? ' active' : ''}" data-st="${k}">${esc(l)} (${st.batches.filter(b => k === 'all' || b.status === k).length})</button>`).join('')}</div>
      <div class="table-wrap" style="margin-top:12px">${batchesTable(list)}</div>
      <div class="muted" style="font-size:12px;margin-top:8px">هنا الباتشات اللي بتتعمل وآخر 30 يوم بس — الأقدم في البرنامج عند الإدارة.</div></div>`;
  $('#baSearch', el).addEventListener('input', debounce(e => { F.params = { ...params, q: e.target.value }; render(); setTimeout(() => { const s = $('#baSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 0); }, 300));
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-st]'); if (c) return go('orders', { ...params, status: c.dataset.st });
    const tr = e.target.closest('tr[data-id]'); if (tr) return showBatch(+tr.dataset.id);
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act === 'new') return pickProduct();
    if (a && a.dataset.act === 'plan') return planForm();
    const mk = e.target.closest('[data-make]');
    if (mk) {
      const r = st.to_make[+mk.dataset.make], p = productOf(r.product_id);
      if (!p) return showError(null, 'المنتج ده مش في التركيبات — حدّث الصفحة');
      if (!p.active) return showError(null, `المنتج «${p.name}» متوقف — شغّله من «🧪 التركيبات»`);
      const pb = peb(r.order_id, r.line_no);
      batchForm(p, { order: { id: r.order_id, line_no: r.line_no, number: r.order_number }, customer: r.customer_name, code: r.code || '', pebble: pb, lockPebble: true,
        packages: r.price_unit === 'package' ? [{ type: r.package_type, weight: qtyText(r.unit_weight_kg).replace(/,/g, ''), count: String(Math.ceil(Number(r.left_kg) / Number(r.unit_weight_kg))) }] : [],
        quantity_kg: r.price_unit === 'ton' ? String(Number(r.left_kg)) : null });
    }
  });
};

function batchesTable(list) {
  if (!list.length) return '<div class="empty">مفيش أوامر تصنيع هنا</div>';
  return `<table><thead><tr><th>رقم الباتش</th><th>الكود</th><th>التاريخ</th><th>المنتج</th><th class="num">الكمية</th><th>العميل / الطلبية</th><th>الحالة</th><th>أصدره</th></tr></thead><tbody>
    ${list.map(r => `<tr class="row-click" data-id="${r.id}"><td class="nowrap"><b class="batch-no">${esc(r.number)}</b>${r.continues_number ? `<div class="muted" style="font-size:12px">🔁 كمالة على ${esc(r.continues_number)}</div>` : ''}</td>
      <td class="nowrap">${r.code ? `<b>${esc(r.code)}</b>` : '<span class="muted">—</span>'}</td><td class="nowrap">${esc(fmtDate(r.created_at))}</td>
      <td>${esc(r.product_name)}${r.pebble ? `<div class="muted" style="font-size:12px">حصوة ${esc(r.pebble)}</div>` : ''}</td><td class="num">${esc(kgText(r.quantity_kg))}</td>
      <td>${esc(r.customer || '—')}${r.order_number ? `<div class="muted" style="font-size:12px">طلب ${esc(r.order_number)}</div>` : ''}</td>
      <td class="nowrap">${batchBadge(r.status)}${r.status === 'in_progress' ? approvalBadge(r) + startedBadge(r) : ''}${r.revisions ? ' <span class="badge st-pending">✏️ معدّل</span>' : ''}</td>
      <td class="nowrap">${esc(r.created_by || '')}</td></tr>`).join('')}</tbody></table>`;
}

function pickProduct() {
  const list = S().products.filter(p => p.active);
  if (!list.length) return showError(null, 'مفيش منتجات شغالة — ضيف منتج من «🧪 التركيبات»');
  const m = openModal({ title: '🏭 أمر تصنيع جديد', small: 'اختار المنتج',
    body: `<label>المنتج<select id="ppP"><option value="">اختار المنتج</option>${list.map(p => `<option value="${p.id}">${esc(p.name)} — إصدار ${esc(p.formula_version)}</option>`).join('')}</select></label>
      <div class="form-error hidden" id="ppErr"></div><div class="modal-actions"><button type="button" class="primary" id="ppOk">التالي</button><button type="button" class="secondary" id="ppBack">رجوع</button></div>` });
  $('#ppBack', m.el).addEventListener('click', () => m.close());
  $('#ppOk', m.el).addEventListener('click', () => {
    const p = productOf($('#ppP', m.el).value);
    if (!p) return showError($('#ppErr', m.el), 'اختار المنتج');
    m.close(); batchForm(p);
  });
}

// ---------- أمر تصنيع (نفس حساب السيرفر بالظبط: الجرامات متقرّبة لتحت، والباقي جرام جرام للكسور الأكبر)
function splitBatch(lines, kgScaled3) {
  const rows = lines.map(l => { const q = parseScaled(String(l.qty_per_ton), 3), prod = q * kgScaled3; return { ...l, g: prod / 1000000n, rem: prod % 1000000n }; });
  let left = kgScaled3 - rows.reduce((s, r) => s + r.g, 0n);
  [...rows].sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.line_no - b.line_no)).forEach(r => { if (left > 0n) { r.g += 1n; left -= 1n; } });
  return rows.map(r => ({ ...r, kg: scaledToString(r.g, 3) }));
}
const PACKAGE_TYPES = ['شكارة', 'بستلة', 'جالون', 'برميل', 'كرتونة'];
const PACKAGE_WEIGHTS = ['3', '5', '10', '12', '14', '15', '20', '25', '34'];
const normPk = s => String(s || '').trim().toLowerCase();
const stContainers = () => S().packaging.filter(x => x.role === 'container');
const stInners = () => S().packaging.filter(x => x.role === 'inner' && x.active);
const innerName = x => x ? x.name : '';
const containerChoices = (containers, productId, type, weight) => containers.filter(c => c.active && normPk(c.package_type) === normPk(type)
  && (c.unit_weight_kg == null || Number(c.unit_weight_kg) === Number(weight)) && (!c.product_id || Number(c.product_id) === Number(productId)))
  .sort((a, b) => (a.product_id ? 0 : 1) - (b.product_id ? 0 : 1) || Number(a.id) - Number(b.id));
function containerDefault(containers, prodPk, productId, type, weight) {
  const t = normPk(type), w = Number(weight), pid = Number(productId);
  const act = containers.filter(c => c.active && normPk(c.package_type) === t);
  const pp = (prodPk || []).find(x => normPk(x.package_type) === t && Number(x.unit_weight_kg) === w && x.container_id);
  if (pp && act.some(c => Number(c.id) === Number(pp.container_id))) return Number(pp.container_id);
  for (const ok of [c => Number(c.product_id) === pid && Number(c.unit_weight_kg) === w, c => Number(c.product_id) === pid && c.unit_weight_kg == null,
                    c => !c.product_id && c.unit_weight_kg != null && Number(c.unit_weight_kg) === w, c => !c.product_id && c.unit_weight_kg == null]) {
    const l = act.filter(ok);
    if (l.length) return l.length === 1 ? Number(l[0].id) : null;
  }
  return null;
}
// جدول العبوات: النوع + الوزن + العدد + الشكارة اللي هتتسحب + الكيس الداخلي وعدده — والإجمالي بالجرام
function packagesEditor(box, initial, onChange, prodPk, productId) {
  const conts = stContainers(), inners = stInners();
  box.innerHTML = `<datalist id="pkTypes">${PACKAGE_TYPES.map(t => `<option value="${t}"></option>`).join('')}</datalist>
    <datalist id="pkWeights">${PACKAGE_WEIGHTS.map(w => `<option value="${w}"></option>`).join('')}</datalist>
    <div class="table-wrap"><table class="lines-edit"><thead><tr><th>العبوة</th><th class="col-qty">الوزن (كجم)</th><th class="col-qty">العدد</th><th class="col-cont">الشكارة اللي هتتسحب</th>${inners.length ? '<th>الكيس الداخلي (وعدده لكل عبوة)</th>' : ''}<th class="col-total num">الإجمالي</th><th class="col-x"></th></tr></thead><tbody data-pk></tbody></table></div>
    <button type="button" class="secondary small" data-pk-add style="margin-top:8px">+ عبوة</button>`;
  const tbody = $('[data-pk]', box);
  const fillCont = tr => {
    const s = $('[data-f=cont]', tr), type = $('[data-f=type]', tr).value, w = normDigits($('[data-f=weight]', tr).value);
    const list = type.trim() && Number(w) > 0 ? containerChoices(conts, productId, type, w) : [];
    let sel = tr.dataset.cman === '1' && list.some(c => Number(c.id) === Number(s.value || tr.dataset.cid)) ? Number(s.value || tr.dataset.cid) : null;
    if (!sel) { tr.dataset.cman = ''; sel = type.trim() && Number(w) > 0 ? containerDefault(conts, prodPk, productId, type, w) : null; }
    s.innerHTML = `<option value="">${!type.trim() || !(Number(w) > 0) ? '—' : list.length ? '— اختار الشكارة —' : 'مفيش شكارة متسجلة للعبوة دي'}</option>`
      + list.map(c => `<option value="${c.id}"${Number(c.id) === sel ? ' selected' : ''}>${esc(c.name)} — في المصنع ${esc(qtyText(c.qty))}</option>`).join('');
  };
  const innerSel = sel => `<select data-f="inner"><option value="">—</option>${inners.map(x => `<option value="${x.id}"${Number(sel) === Number(x.id) ? ' selected' : ''}>${esc(innerName(x))}</option>`).join('')}</select>`;
  const countSel = (n, inner) => `<select data-f="inner_n" style="width:70px" aria-label="عدد الأكياس لكل عبوة">${[0, 1, 2].map(k => `<option value="${k}"${k === (inner ? (n == null ? 1 : Number(n)) : 0) ? ' selected' : ''}>× ${k}</option>`).join('')}</select>`;
  const add = (v = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input data-f="type" list="pkTypes" maxlength="30" value="${esc(v.type || '')}" placeholder="شكارة / بستلة / جالون"></td>
      <td><input data-f="weight" list="pkWeights" inputmode="decimal" dir="ltr" value="${esc(v.weight || '')}"></td>
      <td><input data-f="count" inputmode="numeric" dir="ltr" value="${esc(v.count || '')}"></td>
      <td><select data-f="cont" aria-label="الشكارة اللي هتتسحب"></select></td>
      ${inners.length ? `<td><span class="tools" style="flex-wrap:nowrap">${innerSel(v.inner_id)}${countSel(v.inner_count, v.inner_id)}</span></td>` : ''}
      <td class="num" data-total>—</td><td><button type="button" class="danger small" data-del title="شيل العبوة">×</button></td>`;
    if (v.container_id) { tr.dataset.cman = '1'; tr.dataset.cid = String(v.container_id); }
    tbody.appendChild(tr); fillCont(tr);
    return tr;
  };
  const fromProduct = tr => {
    const inn = $('[data-f=inner]', tr); if (!inn || inn.value) return;
    const t = normPk($('[data-f=type]', tr).value), w = Number(normDigits($('[data-f=weight]', tr).value));
    const pp = (prodPk || []).find(x => normPk(x.package_type) === t && Number(x.unit_weight_kg) === w);
    if (pp && pp.inner_id) { inn.value = String(pp.inner_id); $('[data-f=inner_n]', tr).value = String(pp.inner_count); }
  };
  tbody.addEventListener('change', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.matches('[data-f=type], [data-f=weight]')) { fromProduct(tr); fillCont(tr); }
    if (e.target.matches('[data-f=cont]')) { tr.dataset.cman = e.target.value ? '1' : ''; tr.dataset.cid = e.target.value; }
    if (e.target.matches('[data-f=inner]')) { const nn = $('[data-f=inner_n]', tr); if (nn) nn.value = e.target.value ? (nn.value === '0' ? '1' : nn.value) : '0'; }
    if (e.target.matches('[data-f=inner_n]') && e.target.value === '0') $('[data-f=inner]', tr).value = '';
  });
  const read = () => {
    let total = 0n, bad = null; const rows = [];
    $$('tr', tbody).forEach((tr, i) => {
      const type = $('[data-f=type]', tr).value.trim(), wRaw = $('[data-f=weight]', tr).value, cRaw = $('[data-f=count]', tr).value, cell = $('[data-total]', tr);
      if (!type && !wRaw.trim() && !cRaw.trim()) { cell.textContent = '—'; return; }
      const w = parseScaled(wRaw, 3), c = parseScaled(cRaw, 0);
      if (!type) bad = bad || `العبوة رقم ${i + 1} من غير نوع (شكارة، بستلة...)`;
      if (w == null || w <= 0n) bad = bad || `وزن العبوة رقم ${i + 1} مش مظبوط (بالكيلو)`;
      if (c == null || c <= 0n) bad = bad || `عدد العبوة رقم ${i + 1} لازم يكون رقم صحيح أكبر من صفر`;
      if (w != null && w > 0n && c != null && c > 0n) {
        total += w * c; cell.textContent = qtyText(scaledToString(w * c, 3)) + ' كجم';
        const inn = $('[data-f=inner]', tr), nn = $('[data-f=inner_n]', tr), cs = $('[data-f=cont]', tr);
        if (!cs.value && containerChoices(conts, productId, type, scaledToString(w, 3)).length > 1) bad = bad || `اختار الشكارة اللي هتتسحب للعبوة رقم ${i + 1}`;
        rows.push({ type, weight: scaledToString(w, 3), count: c.toString(), ...(inn && inn.value ? { inner_id: +inn.value, inner_count: nn ? nn.value : '1' } : {}), ...(cs.value ? { container_id: +cs.value } : {}) });
      } else cell.textContent = '—';
    });
    return { rows, total, bad };
  };
  tbody.addEventListener('input', () => onChange && onChange());
  tbody.addEventListener('change', () => onChange && onChange());
  tbody.addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return;
    if ($$('tr', tbody).length > 1) e.target.closest('tr').remove(); else $$('input', e.target.closest('tr')).forEach(i => i.value = '');
    onChange && onChange();
  });
  $('[data-pk-add]', box).addEventListener('click', () => { $('[data-f=type]', add()).focus(); });
  (initial && initial.length ? initial : [{}]).forEach(v => add(v));
  return { read };
}
const pkForEditor = list => (list || []).map(x => ({ type: x.type, weight: qtyText(x.weight).replace(/,/g, ''), count: String(x.count), inner_id: x.inner_id || null, inner_count: x.inner_count, container_id: x.container_id || null }));
const pkText = rows => rows.map(r => { const c = stContainers().find(x => Number(x.id) === Number(r.container_id)), i = stInners().find(x => Number(x.id) === Number(r.inner_id));
  return `${qtyText(r.count)} ${esc(r.type)} × ${qtyText(r.weight)} كجم${c ? ` (${esc(c.name)})` : ''}${i ? ' + ' + esc(innerName(i)) + (Number(r.inner_count) > 1 ? ' × ' + r.inner_count : '') : ''}`; }).join(' — ');
const leftName = l => l.name || l.product_name;

// prefill: { code, customer, pebble, lockPebble, packages, quantity_kg, note, continues: باتش (للكمالة), order: { id, line_no, number } }
function batchForm(p, prefill = {}) {
  const st = S(), order = prefill.order || null;
  const lefts = st.leftovers.map(l => ({ ...l, free: Number(l.balance) - Number(l.planned) })).filter(l => l.free > 0.0005);
  const prodPk = p.packaging || [];
  let continues = prefill.continues || null;
  const m = openModal({
    title: (continues ? '🔁 أمر تصنيع كمالة — ' : '🏭 أمر تصنيع — ') + p.name, small: `التركيبة إصدار ${p.formula_version} — ${p.lines.length} خامة${order ? ` — للطلب ${order.number}` : ''}`, wide: true,
    body: `${order ? `<div class="notice">📦 للطلب ${esc(order.number)} (السطر ${esc(order.line_no)}) — الباتش هيبقى محجوز للطلب ده وعميله، ولما يتعلّم «تم التنفيذ» يظهر في «جاهز للتسليم».</div>` : ''}<div id="boCont"></div>
      <datalist id="boCodes">${(st.codes || []).map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      <div class="form">
        <label>الكود<input id="boCode" maxlength="60" list="boCodes" dir="auto" value="${esc(prefill.code || '')}" placeholder="كود العميل أو اللون"></label>
        <label>العميل / الطلبية<input id="boCustomer" maxlength="120" value="${esc(prefill.customer || '')}"${order ? ' disabled' : ''}></label>
        <label>الحصوة<select id="boPebble"${prefill.lockPebble ? ' disabled title="زي الطلب"' : ''}>${pebbleOptions(prefill.pebble || null)}</select></label>
        <label>ملاحظات للصالة (اختياري)<input id="boNote" maxlength="300" value="${esc(prefill.note || '')}"></label>
      </div>
      <div id="boCodeHint"></div>
      <label class="check"><input type="checkbox" id="boNoFormula"> من غير تركيبة (رواكد + بنود بالإيد بس)</label>
      <h3>♻️ رواكد داخلة في الباتش <span class="muted" style="font-size:13px;font-weight:normal">— اختياري، أي لون، بالكيلو</span></h3>
      <div class="table-wrap"><table class="lines-edit"><thead><tr><th>الرواكد</th><th class="col-qty">الكمية (كجم)</th><th class="col-x"></th></tr></thead><tbody id="boLefts"></tbody></table></div>
      <button type="button" class="secondary small" id="boLeftAdd" style="margin-top:8px"${lefts.length ? '' : ' disabled title="مفيش رواكد في مخزن المصنع"'}>+ رواكد</button>
      <h3>بنود زيادة <span class="muted" style="font-size:13px;font-weight:normal">— خامة بالإيد فوق التركيبة (أو كل البنود لو من غير تركيبة)</span></h3>
      <datalist id="boMaterials">${st.materials.map(x => `<option value="${esc(x.name)}"></option>`).join('')}</datalist>
      <div class="table-wrap"><table class="lines-edit"><thead><tr><th class="col-mat">الخامة</th><th class="col-qty">الكمية (كجم)</th><th>ملاحظات</th><th class="col-x"></th></tr></thead><tbody id="boExtras"></tbody></table></div>
      <button type="button" class="secondary small" id="boExtraAdd" style="margin-top:8px">+ بند</button>
      <h3>العبوات <span class="muted" style="font-size:13px;font-weight:normal">— كمية الباتش بتتحسب منها</span></h3>
      <div id="boPk"></div>
      <h3 id="boQtyTitle">كمية التركيبة</h3>
      <div id="boQtyAuto" class="summary hidden"><span id="boQtyAutoLabel">التركيبة = العبوات − الرواكد − البنود</span><strong id="boQtyAutoVal"></strong></div>
      <div id="boQtyManual">
        <div class="chips" id="boQuick" style="margin-bottom:10px">${[['0.5', '½ طن'], ['1', '1 طن'], ['2', '2 طن'], ['5', '5 طن']].map(([v, l]) => `<button type="button" class="chip" data-t="${v}">${l}</button>`).join('')}</div>
        <div class="form"><label>لو مفيش عبوات: اكتب كمية التركيبة<span class="tools"><input id="boQty" inputmode="decimal" dir="ltr" style="flex:1"><select id="boUnit" style="width:110px"><option value="ton">طن</option><option value="kg">كيلو</option></select></span></label></div>
      </div>
      <h3>الكميات المطلوبة</h3>
      <div class="table-wrap" id="boPreview"></div>
      <div class="notice">رقم الباتش بيتحدد في الإدارة لما الأمر يتسجل، ومبيتكررش. لو اتعمل غلط تقدر تلغيه بسبب، ورقمه بيفضل متسجل.</div>
      <label class="check"><input type="checkbox" id="boFinance"> ابعته لمسؤول المالية يوافق قبل التنفيذ</label>
      <div class="form-error hidden" id="boErr"></div>
      <div class="modal-actions"><button type="button" class="primary" id="boOk">🏭 إصدار أمر التصنيع</button><button type="button" class="secondary" id="boBack">رجوع</button></div>`,
  });
  const b = m.el;
  const paintCont = () => {
    $('#boCont', b).innerHTML = continues ? `<div class="notice">🔁 <b>كمالة على باتش ${esc(continues.number)}</b> (${esc(fmtDate(continues.created_at))})${continues.code ? ` — كود <b>${esc(continues.code)}</b>` : ''}${continues.customer ? ` — ${esc(continues.customer)}` : ''} <button type="button" class="secondary small" id="boContOff">مش كمالة</button></div>` : '';
    if (continues) $('#boContOff', b).addEventListener('click', () => { continues = null; paintCont(); paintHint(); });
  };
  // الكود اتعمل قبل كده لنفس المنتج (في الباتشات اللي عندك هنا) ← نعرض نخليه كمالة
  const paintHint = () => {
    const code = $('#boCode', b).value.trim().toLowerCase();
    const prev = !continues && code ? st.batches.filter(x => x.status !== 'cancelled' && Number(x.product_id) === Number(p.id) && String(x.code || '').trim().toLowerCase() === code).sort((x, y) => y.id - x.id)[0] : null;
    $('#boCodeHint', b).innerHTML = prev ? `<div class="notice warn">الكود ده اتعمل قبل كده في <b>باتش ${esc(prev.number)}</b>${prev.customer ? ` لـ ${esc(prev.customer)}` : ''} (${esc(fmtDate(prev.created_at))}). <button type="button" class="secondary small" id="boMakeCont">اعتبره كمالة على ${esc(prev.number)}</button></div>` : '';
    if (prev) $('#boMakeCont', b).addEventListener('click', () => {
      continues = prev;
      if (!$('#boCustomer', b).value.trim() && prev.customer) $('#boCustomer', b).value = prev.customer;
      if (!prefill.lockPebble) $('#boPebble', b).value = prev.pebble || '';
      paintCont(); paintHint();
    });
  };
  const kgManual = () => { const v = $('#boQty', b).value; return $('#boUnit', b).value === 'ton' ? parseScaled(v, 6) : parseScaled(v, 3); };
  let pk;
  const leftRow = (v = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select data-f="left"><option value="">اختار الرواكد</option>${lefts.map(l => `<option value="${l.id}"${Number(v.leftover_id) === Number(l.id) ? ' selected' : ''}>${esc(leftName(l))} — متاح ${esc(qtyText(l.free))} كجم</option>`).join('')}</select></td>
      <td><input data-f="kg" inputmode="decimal" dir="ltr" value="${esc(v.kg || '')}"></td><td><button type="button" class="danger small" data-del title="شيل">×</button></td>`;
    $('#boLefts', b).appendChild(tr); return tr;
  };
  const extraRow = (v = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input data-f="material" list="boMaterials" maxlength="80" value="${esc(v.material || '')}"></td>
      <td><input data-f="kg" inputmode="decimal" dir="ltr" value="${esc(v.qty_kg || '')}"></td><td><input data-f="note" maxlength="200" value="${esc(v.note || '')}"></td>
      <td><button type="button" class="danger small" data-del title="شيل">×</button></td>`;
    $('#boExtras', b).appendChild(tr); return tr;
  };
  const readLefts = () => {
    let total = 0n, bad = null; const rows = [], seen = new Set();
    $$('#boLefts tr', b).forEach((tr, i) => {
      const id = +$('[data-f=left]', tr).value, raw = $('[data-f=kg]', tr).value.trim();
      if (!id && !raw) return;
      const g = parseScaled(raw, 3), l = lefts.find(x => Number(x.id) === id);
      if (!l) bad = bad || `الرواكد رقم ${i + 1}: اختار الرواكد`;
      else if (seen.has(id)) bad = bad || `«${leftName(l)}» مكتوبة مرتين`;
      else if (g == null || g <= 0n) bad = bad || `الرواكد رقم ${i + 1}: اكتب الكمية بالكيلو`;
      else if (Number(scaledToString(g, 3)) > l.free + 0.0005) bad = bad || `«${leftName(l)}» المتاح ${qtyText(l.free)} كجم بس`;
      else { seen.add(id); total += g; rows.push({ leftover_id: id, kg: scaledToString(g, 3), name: leftName(l) }); }
    });
    return { rows, total, bad };
  };
  const readExtras = () => {
    let total = 0n, bad = null; const rows = [], seen = new Set();
    $$('#boExtras tr', b).forEach((tr, i) => {
      const mat = $('[data-f=material]', tr).value.trim(), raw = $('[data-f=kg]', tr).value.trim(), note = $('[data-f=note]', tr).value.trim();
      if (!mat && !raw && !note) return;
      const g = parseScaled(raw, 3), k = mat.replace(/\s+/g, ' ').toLowerCase();
      if (!mat) bad = bad || `البند رقم ${i + 1} من غير اسم خامة`;
      else if (seen.has(k)) bad = bad || `الخامة «${mat}» مكتوبة مرتين`;
      else if (g == null || g <= 0n) bad = bad || `كمية «${mat}» مش مظبوطة (بالكيلو)`;
      else { seen.add(k); total += g; rows.push({ material: mat, qty_kg: scaledToString(g, 3), note }); }
    });
    return { rows, total, bad };
  };
  const current = () => {
    const pkg = pk.read(), L = readLefts(), E = readExtras(), nf = $('#boNoFormula', b).checked;
    const fromPk = pkg.rows.length > 0 || !!pkg.bad;
    let f = null, total = null, bad = pkg.bad || L.bad || E.bad;
    if (!bad) {
      if (nf) {
        total = L.total + E.total; f = 0n;
        if (total <= 0n) bad = 'من غير تركيبة: اختار رواكد أو اكتب بنود';
        else if (fromPk && pkg.total !== total) bad = `مجموع العبوات (${qtyText(scaledToString(pkg.total, 3))} كجم) مش زي الرواكد + البنود (${qtyText(scaledToString(total, 3))} كجم)`;
      } else {
        f = fromPk ? pkg.total - L.total - E.total : kgManual();
        if (f == null || f <= 0n) bad = fromPk ? 'العبوات أقل من الرواكد والبنود — علّم «من غير تركيبة» لو مفيش تركيبة' : 'اكتب العبوات أو كمية التركيبة (لو بالطن لحد 6 أرقام بعد العلامة، ولو بالكيلو لحد 3)';
        else total = f + L.total + E.total;
      }
    }
    if (!bad && total > 1000000000n) bad = 'الكمية كبيرة جدًا (الحد 1000 طن)';
    return { pkg, fromPk, L, E, nf, f, total, bad };
  };
  const paint = () => {
    const c = current();
    $('#boQtyAuto', b).classList.toggle('hidden', !c.fromPk || c.nf);
    $('#boQtyManual', b).classList.toggle('hidden', c.fromPk || c.nf);
    $('#boQtyTitle', b).classList.toggle('hidden', c.nf);
    $('#boQtyAutoLabel', b).textContent = c.L.total || c.E.total ? 'التركيبة = العبوات − الرواكد − البنود' : 'الكمية من العبوات';
    $('#boQtyAutoVal', b).textContent = c.f != null && c.f > 0n ? kgText(scaledToString(c.f, 3)) : '—';
    if (c.bad) { $('#boPreview', b).innerHTML = `<div class="empty">${esc(c.bad)}</div>`; return; }
    const rows = c.nf ? [] : splitBatch(p.lines, c.f);
    const stockOf = name => { const x = st.materials.find(mm => mm.name.toLowerCase() === String(name).toLowerCase()); return x ? Number(x.qty) : null; };
    const shortCls = (name, kg) => { const s = stockOf(name); return s != null && s < Number(kg) ? ` <span class="badge st-rejected" title="في مخزن المصنع ${qtyText(s)} كجم">ناقص في المصنع</span>` : ''; };
    $('#boPreview', b).innerHTML = `<table><thead><tr><th>#</th><th>الخامة</th><th class="num">النسبة</th><th class="num">الكمية (كجم)</th><th>ملاحظات</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.line_no}</td><td>${esc(r.material)}${shortCls(r.material, r.kg)}</td><td class="num">${esc(pct(r.qty_per_ton))}</td><td class="num"><b>${esc(qtyText(r.kg))}</b></td><td class="muted">${esc(r.note || '')}</td></tr>`).join('')}
      ${c.E.rows.map(r => `<tr><td>+</td><td>${esc(r.material)}${shortCls(r.material, r.qty_kg)}</td><td class="num">—</td><td class="num"><b>${esc(qtyText(r.qty_kg))}</b></td><td class="muted">بند زيادة${r.note ? ' — ' + esc(r.note) : ''}</td></tr>`).join('')}
      ${c.L.rows.map(r => `<tr><td>♻️</td><td>${esc(r.name)}</td><td class="num">—</td><td class="num"><b>${esc(qtyText(r.kg))}</b></td><td class="muted">رواكد</td></tr>`).join('')}
      </tbody><tfoot><tr><td></td><td>المجموع</td><td class="num">${c.nf ? '' : c.L.total || c.E.total ? '' : '100%'}</td><td class="num">${esc(qtyText(scaledToString(c.total, 3)))}</td><td></td></tr></tfoot></table>`;
  };
  $('#boLeftAdd', b).addEventListener('click', () => { $('[data-f=left]', leftRow()).focus(); });
  $('#boExtraAdd', b).addEventListener('click', () => { $('[data-f=material]', extraRow()).focus(); });
  ['#boLefts', '#boExtras'].forEach(s => {
    $(s, b).addEventListener('input', paint); $(s, b).addEventListener('change', paint);
    $(s, b).addEventListener('click', e => { if (e.target.closest('[data-del]')) { e.target.closest('tr').remove(); paint(); } });
  });
  $('#boNoFormula', b).addEventListener('change', paint);
  pk = packagesEditor($('#boPk', b), prefill.packages, paint, prodPk, p.id);
  if (prefill.quantity_kg && !(prefill.packages && prefill.packages.length)) { $('#boUnit', b).value = 'kg'; $('#boQty', b).value = String(Number(prefill.quantity_kg)); }
  $('#boQty', b).addEventListener('input', paint);
  $('#boUnit', b).addEventListener('change', paint);
  $('#boCode', b).addEventListener('input', debounce(paintHint, 250));
  $('#boQuick', b).addEventListener('click', e => { const c = e.target.closest('[data-t]'); if (!c) return; $('#boUnit', b).value = 'ton'; $('#boQty', b).value = c.dataset.t; paint(); });
  $('#boBack', b).addEventListener('click', () => m.close());
  paintCont(); paintHint(); paint();

  $('#boOk', b).addEventListener('click', async e => {
    const btn = e.currentTarget, err = $('#boErr', b); err.classList.add('hidden');
    const c = current(); paint();
    if (c.bad) return showError(err, c.bad);
    const kg = scaledToString(c.total, 3), code = $('#boCode', b).value.trim(), pebble = $('#boPebble', b).value || null;
    const parts = [c.nf ? 'من غير تركيبة' : `تركيبة ${qtyText(scaledToString(c.f, 3))} كجم`, c.L.total ? `رواكد ${qtyText(scaledToString(c.L.total, 3))} كجم` : '', c.E.total ? `بنود ${qtyText(scaledToString(c.E.total, 3))} كجم` : ''].filter(Boolean).join(' + ');
    if (!await confirmBox(continues ? 'إصدار أمر تصنيع كمالة' : 'إصدار أمر تصنيع',
      `<b>${esc(p.name)}</b>${code ? ` — كود <b>${esc(code)}</b>` : ''} — حصوة <b>${esc(pebble || 'بدون')}</b>${continues ? `<div class="notice">🔁 كمالة على باتش ${esc(continues.number)}</div>` : ''}
       ${c.fromPk ? `<div class="muted" style="margin-top:6px">${pkText(c.pkg.rows)}</div>` : ''}${c.L.total || c.E.total || c.nf ? `<div class="muted" style="margin-top:6px">${esc(parts)}</div>` : ''}
       <div class="summary"><span>الكمية</span><strong>${esc(kgText(kg))}</strong></div>`, { ok: 'إصدار' })) return;
    await busy(btn, async () => {
      const batch = {
        product_id: p.id, formula_kg: c.nf ? null : scaledToString(c.f, 3), no_formula: c.nf,
        leftovers: c.L.rows.map(r => ({ leftover_id: r.leftover_id, kg: r.kg })), lines: c.E.rows,
        packages: c.fromPk ? c.pkg.rows : null, code: code || null, note: $('#boNote', b).value.trim() || null, pebble,
        customer: order ? null : ($('#boCustomer', b).value.trim() || null), continues_batch_id: continues ? continues.id : null,
        ...(order ? { order_id: order.id, order_line_no: order.line_no } : {}),
      };
      const r = await submitOp({ op: 'batch_create', label: `🏭 أمر تصنيع — ${p.name}${code ? ' — ' + code : ''} — ${kgText(kg)}${order ? ' — طلب ' + order.number : ''}`, batch, finance: $('#boFinance', b).checked ? 'true' : 'false' });
      if (r.state === 'failed') return showError(err, r.error);
      m.close();
      afterSubmit(r, r.result && r.result.number ? `✅ اتعمل أمر التصنيع — باتش ${r.result.number}` : '✅ اتعمل أمر التصنيع');
      if (r.state === 'done' && r.result && r.result.batch_id && batchOf(r.result.batch_id)) showBatch(r.result.batch_id);
    });
  });
}

// ---------- بيان التصنيع (نفس ورقة دفتر اميك) — مفيهوش أي سعر
function diffText(now, was) { const d = gramsOf(now) - gramsOf(was); if (d === 0n) return ''; return (d > 0n ? '+' : '−') + qtyText(scaledToString(d > 0n ? d : -d, 3)); }
const innerN = p => p.inner_id ? (p.inner_count == null ? 1 : Number(p.inner_count)) : 0;
function batchSheetHtml(b) {
  const cur = b.lines || [], used = b.leftovers || [], pks = b.packages || [], last = b.revision;
  const total = cur.reduce((s, l) => s + gramsOf(l.qty_kg), 0n) + used.reduce((s, l) => s + gramsOf(l.kg), 0n);
  const pctOf = l => l.qty_per_ton == null ? '—' : Number(l.qty_per_ton) === 0 ? 'زيادة' : pct(l.qty_per_ton);
  const pkTotal = pks.reduce((s, p) => s + gramsOf(p.weight) * BigInt(p.count), 0n);
  const blank = (n, cols) => Array.from({ length: n }, () => `<tr>${'<td></td>'.repeat(cols)}</tr>`).join('');
  const contShort = p => p.cont_name ? String(p.cont_name).split(' — ').slice(1).join(' — ') : '';
  return `<div class="sheet${b.status === 'cancelled' ? ' sheet-cancelled' : ''}">
    ${b.status === 'cancelled' ? '<div class="sheet-watermark"><span>ملغي</span></div>' : ''}
    <div class="sheet-head">
      <div><div class="sheet-title">بيان تصنيع</div><div class="sheet-sub">${esc(b.product_name + pebbleTag(b.pebble))}</div>
        ${b.continues_number ? `<div class="sheet-tag">🔁 كمالة على باتش ${esc(b.continues_number)} (${esc(fmtDate(b.continues_at))})</div>` : ''}
        ${b.no_formula ? '<div class="sheet-tag">من غير تركيبة (رواكد + بنود)</div>' : used.length ? `<div class="sheet-tag">♻️ فيه رواكد ${esc(qtyText(scaledToString(used.reduce((s, l) => s + gramsOf(l.kg), 0n), 3)))} كجم</div>` : ''}
        ${last ? `<div class="sheet-tag sheet-tag-warn">✏️ معدّل — تعديل رقم ${esc(last.rev_no)}: ${esc(last.reason)}</div>` : ''}</div>
      <div class="sheet-no"><small>رقم الباتش</small><b>${esc(b.number)}</b>${b.code ? `<small>الكود</small><b class="sheet-code">${esc(b.code)}</b>` : ''}</div>
    </div>
    <div class="sheet-info">
      <div><small>الكمية</small><b>${esc(kgText(scaledToString(total, 3)))}</b></div>
      <div><small>التاريخ</small><b>${esc(fmtDate(b.created_at))}</b></div>
      <div><small>العميل / الطلبية</small><b>${esc(b.customer || '—')}</b></div>
      <div><small>إصدار التركيبة</small><b>${esc(b.formula_version)}</b></div>
    </div>
    <table class="sheet-table"><thead><tr><th>#</th><th>الخامة</th><th class="num">النسبة</th><th class="num">الكمية (كجم)</th><th class="sheet-notes">ملاحظات / الفرق</th><th class="sheet-check">✓</th></tr></thead><tbody>
      ${cur.map(l => {
        const dt = l.planned_kg == null ? 'خامة مضافة' : diffText(l.qty_kg, l.planned_kg);
        return `<tr><td>${l.line_no}</td><td>${esc(l.material)}</td><td class="num">${esc(pctOf(l))}</td>
          <td class="num"><b>${esc(qtyText(l.qty_kg))}</b>${last && dt && l.planned_kg != null ? `<div class="sheet-was">كانت ${esc(qtyText(l.planned_kg))}</div>` : ''}</td>
          <td class="sheet-notes">${last && dt ? `<b>${esc(ltr(dt))}</b> ` : ''}${esc(l.note || '')}</td><td class="sheet-check"></td></tr>`;
      }).join('')}
      ${(b.removed || []).map(l => `<tr class="sheet-removed"><td></td><td>${esc(l.material)}</td><td class="num">${esc(pctOf(l))}</td><td class="num">0<div class="sheet-was">كانت ${esc(qtyText(l.qty_kg))}</div></td><td class="sheet-notes"><b>اتشالت</b></td><td></td></tr>`).join('')}
      ${used.map(l => `<tr><td>♻️</td><td>${esc(l.name)}</td><td class="num">رواكد</td><td class="num"><b>${esc(qtyText(l.kg))}</b></td><td class="sheet-notes"></td><td class="sheet-check"></td></tr>`).join('')}
    </tbody><tfoot><tr><td></td><td>المجموع</td><td class="num">${last || used.length || b.no_formula || cur.some(l => Number(l.qty_per_ton) === 0) ? '' : '100%'}</td><td class="num">${esc(qtyText(scaledToString(total, 3)))}</td><td></td><td></td></tr></tfoot></table>
    ${b.note ? `<div class="sheet-note"><b>ملاحظات:</b> ${esc(b.note)}</div>` : ''}
    <div class="sheet-boxes">
      <div><h4>إضافات اللون (يدوي)</h4><table class="sheet-blank"><thead><tr><th>الصبغة</th><th>الكمية</th></tr></thead><tbody>${blank(4, 2)}</tbody></table></div>
      <div><h4>التعبئة</h4><table class="sheet-blank"><thead><tr><th>العبوة</th><th class="num">الوزن</th><th class="num">العدد</th><th class="num">الإجمالي</th></tr></thead><tbody>
        ${pks.map(p => `<tr><td>${esc(p.type)}${contShort(p) ? `<div class="sheet-was">${esc(contShort(p))}</div>` : ''}${p.inner_name ? `<div class="sheet-was">+ ${esc(p.inner_name)}${innerN(p) > 1 ? ' × ' + innerN(p) : ''}</div>` : ''}</td><td class="num">${esc(qtyText(p.weight))} كجم</td><td class="num"><b>${esc(qtyText(p.count))}</b></td><td class="num">${esc(qtyText(scaledToString(gramsOf(p.weight) * BigInt(p.count), 3)))} كجم</td></tr>`).join('')}
        ${blank(pks.length ? 1 : 4, 4)}</tbody>
        ${pks.length ? `<tfoot><tr><td colspan="3">مجموع العبوات</td><td class="num">${esc(qtyText(scaledToString(pkTotal, 3)))} كجم</td></tr></tfoot>` : ''}</table></div>
    </div>
    <div class="sheet-sign"><div>مسؤول التصنيع<span></span></div><div>المراجعة<span></span></div><div>تاريخ التنفيذ<span></span></div></div>
    <div class="sheet-foot">أصدره ${esc(b.created_by || '')} — ${esc(fmtDateTime(b.created_at))}${last ? ` — آخر تعديل: ${esc(last.by)} ${esc(fmtDateTime(last.at))}` : ''}</div>
  </div>`;
}

// ---------- الباتش: الورقة + الإجراءات (كل إجراء بيتبعت للإدارة)
function showBatch(id) {
  const b = batchOf(id);
  if (!b) return showError(null, 'الباتش ده مش موجود هنا (الأقدم من 30 يوم في البرنامج عند الإدارة)');
  const waiting = b.status === 'in_progress' && b.approval_status === 'waiting';
  const open = b.status === 'in_progress';
  const pendingHere = waitingOps().filter(w => w.payload && String(w.payload.batch_id || '') === String(b.id));
  const m = openModal({
    title: 'باتش ' + b.number + (b.code ? ' — ' + b.code : ''), small: b.product_name, wide: true,
    body: `<div class="tools" style="margin-bottom:14px">${batchBadge(b.status)}${open ? approvalBadge(b) + startedBadge(b) : ''}
        <button type="button" class="primary" data-act="print">🖨️ طباعة</button>
        ${b.status !== 'cancelled' && productOf(b.product_id) && productOf(b.product_id).active ? '<button type="button" class="secondary" data-act="continue">🔁 أمر تصنيع كمالة</button>' : ''}
        ${open && !b.opening ? '<button type="button" class="secondary" data-act="revise">✏️ تعديل (الصالة عدّلت)</button>' : ''}
        ${open && !b.approval_status ? '<button type="button" class="secondary" data-act="to-finance">📤 ابعته للمالية توافق</button>' : ''}
        ${b.status === 'done' && !b.opening && b.made_leftover_kg == null ? '<button type="button" class="secondary" data-act="leftover">♻️ سجّل رواكد</button>' : ''}
        ${open ? `${waiting ? '' : '<button type="button" class="good" data-act="done">✅ تم التنفيذ</button>'}<button type="button" class="danger" data-act="cancel">إلغاء الباتش</button>` : ''}</div>
      ${pendingHere.length ? `<div class="notice warn">⏳ فيه عملية على الباتش ده اتبعتت ولسه الإدارة مسجّلتهاش: ${pendingHere.map(opLabel).join('، ')}</div>` : ''}
      ${waiting ? '<div class="notice warn">⏳ الباتش ده مستني موافقة مسؤول المالية — «تم التنفيذ» بيظهر بعد الموافقة.</div>' : ''}
      <ul class="timeline" style="margin-bottom:12px"><li>🏭 <b>${esc(b.created_by || '')}</b> أصدره — ${esc(fmtDateTime(b.created_at))}${b.order_number ? ` — للطلب ${esc(b.order_number)}` : ''}</li>
        ${b.revision ? `<li>✏️ <b>${esc(b.revision.by)}</b> عدّله (تعديل رقم ${esc(b.revision.rev_no)}) — ${esc(fmtDateTime(b.revision.at))}<br><span class="muted">${esc(b.revision.reason)}</span></li>` : ''}
        ${b.started_at ? `<li>🏭 اتبعت للإدارة «جاري التنفيذ» — ${esc(fmtDateTime(b.started_at))}</li>` : ''}
        ${b.done_at ? `<li>✅ اتعلّم «تم التنفيذ» — ${esc(fmtDateTime(b.done_at))}</li>` : ''}
        ${b.made_leftover_kg != null ? `<li>♻️ طلع منه رواكد <b>${esc(qtyText(b.made_leftover_kg))} كجم</b></li>` : ''}
        ${b.cancelled_at ? `<li>🚫 اتلغى — ${esc(fmtDateTime(b.cancelled_at))}<br><span class="muted">${esc(b.cancel_reason || '')}</span></li>` : ''}</ul>
      <div class="sheet-preview">${batchSheetHtml(b)}</div>`,
  });
  m.el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'print') return printHtml(batchSheetHtml(b));
    if (act === 'continue') { m.close(); return batchForm(productOf(b.product_id), { code: b.code, customer: b.customer, pebble: b.pebble || null, packages: pkForEditor(b.packages), continues: b }); }
    if (act === 'revise') { m.close(); return reviseBatchForm(b); }
    let payload = null, done = '';
    if (act === 'done' || act === 'leftover') {
      const r = await leftoverBox(b, act === 'done'); if (!r) return;
      payload = act === 'done' ? { op: 'batch_done', batch_id: String(b.id), leftover_kg: r.kg, leftover_note: r.note, label: `✅ تم التنفيذ — باتش ${b.number}${r.kg ? ` (رواكد ${qtyText(r.kg)} كجم)` : ''}` }
        : { op: 'leftover_record', batch_id: String(b.id), kg: r.kg, note: r.note, label: `♻️ رواكد ${qtyText(r.kg)} كجم — باتش ${b.number}` };
      done = act === 'done' ? (r.kg ? `✅ اتعلّم «تم التنفيذ» — واتسجل ${qtyText(r.kg)} كجم رواكد` : '✅ اتعلّم «تم التنفيذ»') : `♻️ اتسجل ${qtyText(r.kg)} كجم رواكد`;
    } else if (act === 'cancel') {
      const why = await promptBox('إلغاء الباتش ' + b.number, 'سبب الإلغاء', { ok: 'إلغاء الباتش', cls: 'danger', hint: 'رقم الباتش هيفضل متسجل كـ«ملغي» ومش هيتكرر.' });
      if (why == null) return;
      payload = { op: 'batch_cancel', batch_id: String(b.id), reason: why, label: `⛔ إلغاء باتش ${b.number}` }; done = 'اتلغى الباتش';
    } else if (act === 'to-finance') {
      const note = await promptBox('ابعت الباتش ' + b.number + ' للمالية', 'ملاحظة لمسؤول المالية (اختياري)', { ok: '📤 إرسال', required: false, hint: '«تم التنفيذ» هيتقفل لحد ما المالية توافق.' });
      if (note == null) return;
      payload = { op: 'batch_approval', batch_id: String(b.id), note: note || null, label: `📤 للمالية — باتش ${b.number}` }; done = '✅ راح للمالية';
    } else return;
    await busy(btn, async () => { const r = await submitOp(payload); if (r.state === 'failed') return showError(null, r.error); m.close(); afterSubmit(r, done); });
  });
}
// «✅ تم التنفيذ» (أو «♻️ سجّل رواكد» بعدها): «فيه زيادة؟ كام كيلو» ← { kg, note } أو null لو رجع
function leftoverBox(b, isDone) {
  return new Promise(resolve => {
    let res = null;
    const m = openModal({
      title: (isDone ? 'تم تنفيذ الباتش ' : '♻️ رواكد الباتش ') + b.number, small: `${b.product_name}${b.code ? ' — ' + b.code : ''} — ${kgText(b.quantity_kg)}`, onClose: () => resolve(res),
      body: `<div class="form">
          <label>${isDone ? 'فيه زيادة (رواكد)؟ كام كيلو — فاضي لو مفيش' : 'كمية الزيادة (رواكد) بالكيلو'}<input id="lbKg" inputmode="decimal" dir="ltr" placeholder="${isDone ? 'مفيش' : ''}"></label>
          <label>ملاحظة (اختياري)<input id="lbNote" maxlength="200" placeholder="زي: فضلة الخلاط"></label></div>
        <div class="notice">الرواكد بتدخل مخزن المصنع بلون الباتش ده، وتقدر تستخدمها في أي باتش جديد. ${isDone ? 'الخامات والعبوات بتتسحب من مخزن المصنع لما الإدارة تسجّل «تم التنفيذ».' : 'بتتسجل مرة واحدة للباتش.'}</div>
        <div class="form-error hidden" id="lbErr"></div>
        <div class="modal-actions"><button type="button" class="${isDone ? 'good' : 'primary'}" id="lbOk">${isDone ? '✅ تم التنفيذ' : '♻️ سجّل الرواكد'}</button><button type="button" class="secondary" id="lbBack">رجوع</button></div>`,
    });
    $('#lbBack', m.el).addEventListener('click', () => m.close());
    $('#lbOk', m.el).addEventListener('click', () => {
      const raw = normDigits($('#lbKg', m.el).value).trim(), err = $('#lbErr', m.el), g = raw ? parseScaled(raw, 3) : null;
      const problem = raw && (g == null || g <= 0n) ? 'الكمية لازم تكون رقم أكبر من صفر (لحد 3 أرقام بعد العلامة)'
        : !raw && !isDone ? 'اكتب كمية الزيادة بالكيلو'
        : g != null && g > (parseScaled(String(b.quantity_kg), 3) || 0n) ? 'الزيادة أكبر من الباتش نفسه — راجع الكمية' : null;
      if (problem) return showError(err, problem);
      res = { kg: g != null ? scaledToString(g, 3) : null, note: $('#lbNote', m.el).value.trim() || null };
      m.close();
    });
  });
}

// تعديل الصالة: كل الخامات والكميات الفعلية + العبوات + السبب ← نسخة جديدة في الإدارة (الأصل محفوظ)
function reviseBatchForm(bt) {
  const planned = (bt.lines || []).filter(l => l.planned_kg != null).map(l => ({ material: l.material, qty_kg: l.planned_kg })).concat((bt.removed || []).map(l => ({ material: l.material, qty_kg: l.qty_kg })));
  const prod = productOf(bt.product_id), prodPk = prod ? prod.packaging || [] : [];
  const m = openModal({
    title: '✏️ تعديل الباتش ' + bt.number, small: 'الأصل محفوظ، والتعديل بيتسجل في الإدارة كنسخة جديدة', wide: true,
    body: `<datalist id="rvMaterials">${S().materials.map(l => `<option value="${esc(l.name)}"></option>`).join('')}</datalist>
      <div class="table-wrap"><table class="lines-edit"><thead><tr><th class="col-mat">الخامة</th><th class="col-qty num">الأصلي (كجم)</th><th class="col-qty">الفعلي (كجم)</th><th class="col-qty num">الفرق</th><th>ملاحظات</th><th class="col-x"></th></tr></thead><tbody id="rvLines"></tbody></table></div>
      <button type="button" class="secondary small" id="rvAdd" style="margin-top:8px">+ خامة (لو الصالة زوّدت خامة)</button>
      <div class="summary" id="rvSum"><span id="rvSumNote"></span><strong id="rvSumVal"></strong></div>
      <h3>العبوات</h3><div id="rvPk"></div>
      <label style="margin-top:12px">سبب التعديل (إيه اللي الصالة غيّرته)<textarea id="rvReason" maxlength="300"></textarea></label>
      <div class="form-error hidden" id="rvErr"></div>
      <div class="modal-actions"><button type="button" class="primary" id="rvOk">حفظ التعديل</button><button type="button" class="secondary" id="rvBack">رجوع</button></div>`,
  });
  const b = m.el, tbody = $('#rvLines', b);
  const plannedOf = name => planned.find(l => l.material.toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase());
  const plannedTotal = planned.reduce((s, l) => s + gramsOf(l.qty_kg), 0n);
  const add = (v = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input data-f="material" list="rvMaterials" maxlength="80" value="${esc(v.material || '')}"></td><td class="num muted" data-was>—</td>
      <td><input data-f="qty_kg" inputmode="decimal" dir="ltr" value="${esc(v.qty_kg != null ? qtyText(v.qty_kg).replace(/,/g, '') : '')}"></td>
      <td class="num" data-diff></td><td><input data-f="note" maxlength="200" value="${esc(v.note || '')}"></td>
      <td><button type="button" class="danger small" data-del title="شيل الخامة">×</button></td>`;
    tbody.appendChild(tr); return tr;
  };
  const recalc = () => {
    let total = 0n;
    $$('tr', tbody).forEach(tr => {
      const o = plannedOf($('[data-f=material]', tr).value), q = parseScaled($('[data-f=qty_kg]', tr).value, 3);
      $('[data-was]', tr).textContent = o ? qtyText(o.qty_kg) : 'جديدة';
      const dt = o && q != null ? diffText(scaledToString(q, 3), o.qty_kg) : '';
      const cell = $('[data-diff]', tr); cell.textContent = ltr(dt); cell.className = 'num ' + (dt.startsWith('+') ? 'in' : dt ? 'out' : '');
      if (q != null) total += q;
    });
    const dt = diffText(scaledToString(total, 3), scaledToString(plannedTotal, 3));
    $('#rvSumNote', b).textContent = `المجموع الفعلي — الأصلي ${qtyText(scaledToString(plannedTotal, 3))} كجم${dt ? ' (الفرق ' + ltr(dt) + ')' : ''}`;
    $('#rvSumVal', b).textContent = qtyText(scaledToString(total, 3)) + ' كجم';
  };
  (bt.lines || []).forEach(l => add(l));
  recalc();
  const pk = packagesEditor($('#rvPk', b), pkForEditor(bt.packages), () => {}, prodPk, bt.product_id);
  tbody.addEventListener('input', recalc);
  tbody.addEventListener('click', e => { if (e.target.closest('[data-del]') && $$('tr', tbody).length > 1) { e.target.closest('tr').remove(); recalc(); } });
  $('#rvAdd', b).addEventListener('click', () => { $('[data-f=material]', add()).focus(); recalc(); });
  $('#rvBack', b).addEventListener('click', () => m.close());
  $('#rvOk', b).addEventListener('click', async e => {
    const btn = e.currentTarget, err = $('#rvErr', b); err.classList.add('hidden');
    const rows = $$('tr', tbody).map(tr => ({ material: $('[data-f=material]', tr).value.trim(), qty_kg: normDigits($('[data-f=qty_kg]', tr).value), note: $('[data-f=note]', tr).value.trim() }))
      .filter(r => r.material || r.qty_kg || r.note);
    const names = rows.map(r => r.material.replace(/\s+/g, ' ').toLowerCase());
    const pkg = pk.read(), reason = $('#rvReason', b).value.trim(), badQty = rows.find(r => parseScaled(r.qty_kg, 3) == null);
    const problem = !rows.length ? 'لازم خامة واحدة على الأقل' : rows.some(r => !r.material) ? 'فيه سطر من غير اسم خامة'
      : badQty ? `كمية «${badQty.material}» مش مظبوطة (رقم، لحد 3 أرقام بعد العلامة)` : names.some((n, i) => names.indexOf(n) !== i) ? 'فيه خامة مكتوبة مرتين'
      : pkg.bad ? pkg.bad : reason.length < 2 ? 'اكتب سبب التعديل (إيه اللي الصالة غيّرته)' : null;
    if (problem) return showError(err, problem);
    await busy(btn, async () => {
      const r = await submitOp({ op: 'batch_revise', batch_id: String(bt.id), reason, lines: rows, packages: pkg.rows.length ? pkg.rows : null, label: `✏️ تعديل الصالة — باتش ${bt.number}` });
      if (r.state === 'failed') return showError(err, r.error);
      m.close(); afterSubmit(r, r.result && r.result.rev_no ? `✅ اتسجل التعديل رقم ${r.result.rev_no}` : '✅ اتسجل التعديل');
    });
  });
}

// ---------- ✅ التنفيذ: اللي بيتعمل (بالأوامر) + خطة الإنتاج + اللي اتنفذ قريب
Tabs.run = (el) => {
  const st = S(), running = st.batches.filter(b => b.status === 'in_progress').sort((a, b) => a.id - b.id);
  const recent = st.batches.filter(b => b.status === 'done').sort((a, b) => Date.parse(b.done_at || 0) - Date.parse(a.done_at || 0)).slice(0, 30);
  const plans = (st.plans || []).slice().sort((a, b) => String(a.plan_date).localeCompare(String(b.plan_date)));
  el.innerHTML = `<div class="panel"><div class="panel-head"><h2>⚙️ باتشات بتتعمل (${running.length})</h2>
      <div class="tools"><button type="button" class="primary" data-act="plan">📋 خطة الإنتاج</button></div></div>
      ${running.length ? `<div class="table-wrap"><table><thead><tr><th>الباتش</th><th>المنتج</th><th>العميل / الطلبية</th><th class="num">الكمية</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${running.map(b => `<tr><td class="nowrap"><b class="batch-no">${esc(b.number)}</b>${b.code ? `<div class="muted" style="font-size:12px">${esc(b.code)}</div>` : ''}</td>
          <td>${esc(b.product_name + pebbleTag(b.pebble))}</td><td>${esc(b.customer || '—')}</td><td class="num">${esc(kgText(b.quantity_kg))}</td>
          <td class="nowrap">${b.started_at ? '<span class="badge st-approved">🏭 جاري التنفيذ</span>' : '<span class="badge">بيتعمل</span>'}${approvalBadge(b)}${b.revisions ? ' <span class="badge st-pending">✏️ معدّل</span>' : ''}</td>
          <td class="nowrap"><button type="button" class="secondary small" data-print="${b.id}">🖨️ الورقة</button>
            ${b.approval_status === 'waiting' ? '' : `<button type="button" class="good small" data-done="${b.id}">✅ تم التنفيذ</button>`}
            <button type="button" class="secondary small" data-open="${b.id}">التفاصيل</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">مفيش باتشات بتتعمل دلوقتي</div>'}</div>
    <div class="panel"><div class="panel-head"><h2>📋 خطط الإنتاج</h2></div>
      ${plans.length ? `<div class="table-wrap"><table><thead><tr><th>اليوم</th><th>الباتشات</th><th>اتطبعت</th><th>للإدارة</th><th></th></tr></thead><tbody>
        ${plans.map(p => `<tr><td class="nowrap"><b>${esc(fmtDate(p.plan_date + 'T12:00:00'))}</b>${p.note ? `<div class="muted" style="font-size:12px">${esc(p.note)}</div>` : ''}</td>
          <td>${(p.batches || []).map(x => `<span class="batch-no">${esc(x.number)}</span>`).join('، ') || '—'}</td>
          <td class="nowrap">${p.printed_at ? esc(timeAgo(p.printed_at)) : '<span class="muted">لسه</span>'}</td><td class="nowrap">${p.sent_at ? '📤 ' + esc(timeAgo(p.sent_at)) : '<span class="muted">لسه</span>'}</td>
          <td class="nowrap"><button type="button" class="secondary small" data-plan="${esc(p.plan_date)}">فتح</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">مفيش خطط في الأسبوعين دول — «📋 خطة الإنتاج» تعمل خطة بكرة</div>'}</div>
    <div class="panel"><div class="panel-head"><h2>✓ اتنفذ قريب</h2></div>
      ${recent.length ? `<div class="table-wrap"><table><thead><tr><th>الباتش</th><th>المنتج</th><th>العميل / الطلبية</th><th class="num">الكمية</th><th>اتنفذ</th><th class="num">رواكد</th><th></th></tr></thead><tbody>
        ${recent.map(b => `<tr class="row-click" data-open="${b.id}"><td class="nowrap"><b class="batch-no">${esc(b.number)}</b></td><td>${esc(b.product_name)}</td><td>${esc(b.customer || '—')}</td>
          <td class="num">${esc(kgText(b.quantity_kg))}</td><td class="nowrap">${esc(timeAgo(b.done_at))}</td><td class="num">${b.made_leftover_kg != null ? esc(qtyText(b.made_leftover_kg)) + ' كجم' : '<span class="muted">—</span>'}</td>
          <td class="nowrap"><button type="button" class="secondary small" data-print="${b.id}">🖨️</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">مفيش</div>'}</div>`;
  el.addEventListener('click', async e => {
    const pr = e.target.closest('[data-print]'); if (pr) { e.stopPropagation(); const b = batchOf(pr.dataset.print); return b && printHtml(batchSheetHtml(b)); }
    const dn = e.target.closest('[data-done]');
    if (dn) {
      const b = batchOf(dn.dataset.done), r = await leftoverBox(b, true); if (!r) return;
      return busy(dn, async () => afterSubmit(await submitOp({ op: 'batch_done', batch_id: String(b.id), leftover_kg: r.kg, leftover_note: r.note, label: `✅ تم التنفيذ — باتش ${b.number}${r.kg ? ` (رواكد ${qtyText(r.kg)} كجم)` : ''}` }),
        r.kg ? `✅ اتعلّم «تم التنفيذ» — واتسجل ${qtyText(r.kg)} كجم رواكد` : '✅ اتعلّم «تم التنفيذ»'));
    }
    const op = e.target.closest('[data-open]'); if (op) return showBatch(+op.dataset.open);
    const pl = e.target.closest('[data-plan]'); if (pl) return planForm(pl.dataset.plan);
    if (e.target.closest('[data-act=plan]')) return planForm();
  });
};

// ---------- 📋 خطة الإنتاج: اختيار باتشات اليوم ← حفظ ← طباعة ← «📤 ابعت للإدارة: جاري التنفيذ» (كله بالتاريخ)
function planSheetHtml(date, rows, note) {
  return `<div class="sheet"><div class="sheet-head"><div><div class="sheet-title">خطة الإنتاج</div><div class="sheet-sub">${esc(fmtDate(date + 'T12:00:00'))}</div></div>
      <div class="sheet-no"><small>عدد الباتشات</small><b>${rows.length}</b></div></div>
    ${note ? `<div class="sheet-note"><b>ملاحظات:</b> ${esc(note)}</div>` : ''}
    <table class="sheet-table"><thead><tr><th>#</th><th>الباتش</th><th>المنتج</th><th>الكود</th><th>العميل / الطلب</th><th class="num">الكمية</th><th>العبوات</th><th class="sheet-check">✓</th></tr></thead><tbody>
      ${rows.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.number)}</b></td><td>${esc(x.product_name)}${x.pebble ? `<div class="sheet-was">حصوة ${esc(x.pebble)}</div>` : ''}</td><td>${esc(x.code || '—')}</td>
        <td>${esc(x.customer || '—')}${x.order_number ? `<div class="sheet-was">طلب ${esc(x.order_number)}</div>` : ''}</td><td class="num">${esc(kgText(x.quantity_kg))}</td>
        <td>${(x.packages || []).map(p => `${esc(qtyText(p.count))} ${esc(p.type)} ${esc(qtyText(p.weight))} كجم`).join('<br>') || '—'}</td><td class="sheet-check"></td></tr>`).join('')}
    </tbody></table>
    <div class="sheet-sign"><div>مسؤول التصنيع<span></span></div><div>المراجعة<span></span></div><div>التاريخ<span></span></div></div>
    <div class="sheet-foot">اتطبعت ${esc(fmtDateTime(new Date().toISOString()))} — ${esc(S().actor)}</div></div>`;
}
function planForm(date) {
  date = date || cairoDay(1);
  const st = S(), plan = (st.plans || []).find(p => p.plan_date === date) || null;
  const inPlan = new Map((plan ? plan.batches : []).map((x, i) => [Number(x.id), i]));
  const inprog = st.batches.filter(b => b.status === 'in_progress');
  const rows = inprog.slice().sort((a, b) => (inPlan.has(a.id) ? inPlan.get(a.id) : 1e9 + a.id) - (inPlan.has(b.id) ? inPlan.get(b.id) : 1e9 + b.id));
  const m = openModal({
    title: '📋 خطة الإنتاج', small: 'اختار الباتشات اللي هتتعمل اليوم ده واطبعها — وبعدها «📤 ابعت للإدارة: جاري التنفيذ»', wide: true,
    body: `<div class="form"><label>اليوم<input type="date" id="plDate" value="${esc(date)}" min="${esc(cairoDay(0))}"></label>
        <label>ملاحظات على الخطة (بتطبع)<input id="plNote" maxlength="300" value="${esc(plan ? plan.note || '' : '')}"></label></div>
      ${plan ? `<div class="notice">${plan.printed_at ? `🖨️ اتطبعت ${esc(fmtDateTime(plan.printed_at))}` : 'لسه متطبعتش'}${plan.sent_at ? ` — 📤 اتبعت للإدارة ${esc(fmtDateTime(plan.sent_at))}` : ''}</div>` : ''}
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th class="col-x"></th><th>الباتش</th><th>المنتج</th><th>الكود</th><th>العميل / الطلب</th><th class="num">الكمية</th><th>الحالة</th></tr></thead><tbody id="plRows">
        ${rows.map(x => `<tr><td><input type="checkbox" data-b="${x.id}"${inPlan.has(x.id) ? ' checked' : ''} aria-label="الباتش ${esc(x.number)}"></td><td class="nowrap"><b class="batch-no">${esc(x.number)}</b></td>
          <td>${esc(x.product_name + pebbleTag(x.pebble))}</td><td class="nowrap">${esc(x.code || '—')}</td><td>${esc(x.customer || '—')}</td><td class="num">${esc(kgText(x.quantity_kg))}</td>
          <td class="nowrap">${x.started_at ? '<span class="badge st-approved">🏭 جاري التنفيذ</span>' : x.approval_status === 'waiting' ? '<span class="badge st-pending">⏳ مستني المالية</span>' : '<span class="badge">بيتعمل</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">مفيش أوامر تصنيع لسه بتتعمل</div>'}
      <div class="form-error hidden" id="plErr"></div>
      <div class="modal-actions">${rows.length ? '<button type="button" class="primary" id="plPrint">🖨️ حفظ وطباعة الخطة</button><button type="button" class="secondary" id="plSave">💾 حفظ</button>' : ''}
        ${plan && plan.printed_at ? '<button type="button" class="good" id="plSend">📤 ابعت للإدارة: جاري التنفيذ</button>' : ''}<button type="button" class="secondary" id="plBack">رجوع</button></div>`,
  });
  const b = m.el, err = $('#plErr', b);
  $('#plBack', b).addEventListener('click', () => m.close());
  $('#plDate', b).addEventListener('change', e => { const v = e.target.value; if (!v) return; m.close(); planForm(v); });
  const picked = () => $$('#plRows [data-b]', b).filter(c => c.checked).map(c => +c.dataset.b);
  const dayText = fmtDate(date + 'T12:00:00');
  const save = async () => {
    const ids = picked();
    if (!ids.length) { showError(err, 'اختار الباتشات اللي هتتعمل اليوم ده'); return null; }
    if (date < cairoDay(0)) { showError(err, 'اليوم ده فات'); return null; }
    const r = await submitOp({ op: 'plan_save', date, batch_ids: ids.map(String), note: $('#plNote', b).value.trim() || null, label: `📋 خطة ${dayText} (${ids.length} باتش)` });
    if (r.state === 'failed') { showError(err, r.error); return null; }
    return { r, ids };
  };
  if ($('#plSave', b)) $('#plSave', b).addEventListener('click', e => busy(e.currentTarget, async () => { const s = await save(); if (s) { m.close(); afterSubmit(s.r, '✅ اتحفظت الخطة'); } }));
  if ($('#plPrint', b)) $('#plPrint', b).addEventListener('click', e => busy(e.currentTarget, async () => {
    const s = await save(); if (!s) return;
    const sel = s.ids.map(id => batchOf(id)).filter(Boolean);
    await printHtml(planSheetHtml(date, sel, $('#plNote', b).value.trim() || null));
    // (الحفظ ولو لسه في الصندوق: العمليات بتتسجل بالترتيب — «اتطبعت» بعد «حفظ»)
    const r2 = await submitOp({ op: 'plan_printed', date, label: `🖨️ اتطبعت خطة ${dayText}` });
    m.close();
    if (r2.state === 'failed') return showError(null, r2.error);
    afterSubmit(r2, '🖨️ اتطبعت الخطة');
    if (await confirmBox('ابعت للإدارة «جاري التنفيذ»؟', 'الخطة اتطبعت. أول ما تبدأوا ابعت للإدارة إن الباتشات دي «جاري التنفيذ» — المبيعات والمدير بيعرفوا، والطلبات بتبقى «قيد التنفيذ» لوحدها.<div class="notice">لو لسه مبدأتوش: «رجوع» — والتذكير هيفضل في الرئيسية لحد ما تبعت.</div>', { ok: '📤 ابعت دلوقتي', cls: 'good' })) {
      afterSubmit(await submitOp({ op: 'plan_started', date, label: `📤 جاري التنفيذ — خطة ${dayText}` }), '📤 اتبعت للإدارة: الباتشات «جاري التنفيذ»');
    }
  }));
  if ($('#plSend', b)) $('#plSend', b).addEventListener('click', e => busy(e.currentTarget, async () => {
    const r = await submitOp({ op: 'plan_started', date, label: `📤 جاري التنفيذ — خطة ${dayText}` });
    if (r.state === 'failed') return showError(err, r.error);
    m.close(); afterSubmit(r, '📤 اتبعت للإدارة: الباتشات «جاري التنفيذ»');
  }));
}
