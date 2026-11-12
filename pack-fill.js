// (0.47.0) «📐 احسب عدد العبوات من الكمية» في جدول العبوات (أمر التصنيع في البرنامج + صفحة التصنيع — build-portal بينسخ الملف ده جنبها باسم pack-fill.js).
// تكتب الكمية بالطن، والعبوات بأوزانها: كل العبوات اللي عددها مكتوب بتتحسب زي ما هي، وآخر عبوة عددها فاضي (أو آخر عبوة لو كلهم مكتوبين)
// بياخد الباقي. لو القسمة مش مظبوطة: العدد بيتقرّب لتحت، والفرق بيظهر مع زرار «زوّد عبوة». الأرقام بالجرام (BigInt) عشان مفيش كسور ضايعة.

// total: الكمية بالجرام. rows: [{w: الوزن بالجرام أو null, c: العدد أو null}] ← {index, n, rest} أو {error}
function packFillCalc(total, rows) {
  const idx = rows.map((r, i) => i).filter(i => rows[i].w != null && rows[i].w > 0n);
  if (!idx.length) return { error: 'اكتب نوع ووزن العبوة الأول' };
  const empty = idx.filter(i => rows[i].c == null);
  if (empty.length > 1) return { error: 'اكتب عدد كل العبوات ما عدا عبوة واحدة (هي اللي هتاخد الباقي)' };
  const index = empty.length ? empty[0] : idx[idx.length - 1];
  let fixed = 0n;
  for (const i of idx) if (i !== index) fixed += rows[i].w * rows[i].c;
  const rem = total - fixed;
  if (rem <= 0n) return { error: 'العبوات اللي عددها مكتوب أكبر من الكمية (أو قدها) — مفيش باقي للعبوة الأخيرة' };
  const w = rows[index].w, n = rem / w;
  return { index, n, rest: rem - n * w, w };
}

// (sql/055) جدول «العدد الفعلي» لكل عبوة بعد التنفيذ (عجز / زيادة): lines = [{line_no, package_type, unit_weight_kg, count}] (العدد المسجّل)
function packActualHtml(lines) {
  return `<div class="table-wrap"><table class="lines-edit"><thead><tr><th>العبوة</th><th class="col-qty num">العدد المسجّل</th><th class="col-qty">العدد الفعلي</th><th class="col-qty num">الفرق</th><th>العبوات الفاضية (العجز)</th></tr></thead><tbody>
    ${lines.map(l => `<tr data-pl="${esc(String(l.line_no))}" data-cur="${esc(String(l.count))}"><td>${esc(l.package_type)} ${esc(qtyText(l.unit_weight_kg))} كجم</td><td class="num">${esc(qtyText(l.count))}</td>
      <td><input data-f="actual" inputmode="numeric" dir="ltr" value="${esc(String(l.count))}"></td><td class="num" data-f="diff">—</td>
      <td><label class="check hidden" data-f="backw"><input type="checkbox" data-f="back"> رجعت مخزن المصنع</label></td></tr>`).join('')}</tbody></table></div>`;
}
// بيرسم الفرق، وبيرجّع {rows: [{line_no, actual, back}] (اللي اتغيّر بس), bad}
function packActualRead(box) {
  const rows = []; let bad = null;
  $$('tr[data-pl]', box).forEach(tr => {
    const raw = normDigits($('[data-f=actual]', tr).value).trim(), cur = Number(tr.dataset.cur), a = raw === '' ? null : parseScaled(raw, 0);
    const ok = a != null && a >= 0n, d = ok ? Number(a) - cur : 0;
    $('[data-f=diff]', tr).innerHTML = !ok || d === 0 ? '—' : d < 0 ? `<span class="badge st-rejected">عجز ${esc(qtyText(-d))}</span>` : `<span class="badge st-approved">زيادة ${esc(qtyText(d))}</span>`;
    $('[data-f=backw]', tr).classList.toggle('hidden', !(d < 0));
    if (!ok) { bad = bad || 'اكتب العدد الفعلي لكل عبوة (رقم صحيح)'; return; }
    if (d !== 0) rows.push({ line_no: Number(tr.dataset.pl), actual: String(a), ...(d < 0 ? { back: $('[data-f=back]', tr).checked } : {}) });
  });
  return { rows, bad };
}

// box: مكان الأداة (فوق جدول العبوات)، tbody: سطور الجدول (data-f=weight / count)، onChange: إعادة الحساب
function attachPackFill(box, tbody, onChange) {
  box.innerHTML = `<div class="pack-fill"><label>📐 احسب عدد العبوات من الكمية<span class="tools"><input data-pf-ton inputmode="decimal" dir="ltr" placeholder="مثلًا 2" style="width:110px"><span class="muted">طن</span><button type="button" class="secondary small" data-pf-go>احسب</button></span></label><div data-pf-msg></div></div>`;
  const msg = $('[data-pf-msg]', box);
  const say = (html, cls = 'notice') => { msg.innerHTML = html ? `<div class="${cls}">${html}</div>` : ''; };
  const run = () => {
    const tonRaw = normDigits($('[data-pf-ton]', box).value).trim();
    const total = parseScaled(tonRaw, 6);               // (طن بـ6 كسور = جرام)
    if (total == null || total <= 0n) return say('اكتب الكمية بالطن (لحد 6 أرقام بعد العلامة)', 'form-error');
    const trs = $$('tr', tbody);
    const rows = trs.map(tr => {
      const w = parseScaled(normDigits($('[data-f=weight]', tr).value), 3), cRaw = normDigits($('[data-f=count]', tr).value).trim();
      return { w: w != null && w > 0n ? w : null, c: cRaw ? parseScaled(cRaw, 0) : null };
    });
    if (rows.some((r, i) => r.c != null && (r.c <= 0n) && r.w)) return say('فيه عدد مش مظبوط في الجدول', 'form-error');
    const r = packFillCalc(total, rows);
    if (r.error) return say(esc(r.error), 'form-error');
    const cell = $('[data-f=count]', trs[r.index]);
    const set = n => { cell.value = n.toString(); onChange && onChange(); };
    if (r.n === 0n) { set(1n); return say(`الباقي ${esc(qtyText(scaledToString(r.rest, 3)))} كجم أقل من عبوة واحدة — اتكتب 1`, 'notice warn'); }
    set(r.n);
    if (r.rest === 0n) return say(`✓ ${esc(r.n.toString())} عبوة — الإجمالي ${esc(qtyText(scaledToString(total, 3)))} كجم بالظبط`, 'notice good');
    say(`${esc(r.n.toString())} عبوة، وفاضل <b>${esc(qtyText(scaledToString(r.rest, 3)))} كجم</b> مش مكمّلين عبوة. <button type="button" class="secondary small" data-pf-plus>زوّد عبوة (${esc((r.n + 1n).toString())})</button>`, 'notice warn');
    $('[data-pf-plus]', msg).addEventListener('click', () => { set(r.n + 1n); say(`✓ ${esc((r.n + 1n).toString())} عبوة — الإجمالي زاد ${esc(qtyText(scaledToString(r.w - r.rest, 3)))} كجم عن الكمية`, 'notice good'); });
  };
  $('[data-pf-go]', box).addEventListener('click', run);
  $('[data-pf-ton]', box).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
}
