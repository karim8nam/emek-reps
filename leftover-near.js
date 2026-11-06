// «💡 رواكد قريبة» في فورم أمر التصنيع (البرنامج + صفحة التصنيع — build-portal بينسخ الملف ده جنبها باسم leftover-near.js).
// لما التصنيع يكتب الكود اللي هيعمله، بنرتب الرواكد المتاحة: نفس الصنف بأنواعه الأول (الجرافيتو مع الجرافيتو والشيلد مع الشيلد)،
// والأصناف التانية في قايمة مقفولة عشان الكميات الصغيرة. الاقتراح بس — الإضافة بإيد التصنيع، والحساب والحفظ زي ما هم.
// الكود: R-511 = أصله 511 ومايل للأحمر (G أخضر، B أزرق). القرب: نفس الكود، ثم نفس الأصل، ثم فرق الدرجات (CIEDE2000).
// الدرجات من صور كتالوج 2025 (تقريبية، والمايل بنحسبه من أصله). الكود اللي مش في الكتالوج مالوش درجة: بيظهر في «شوفه بعينك».
const NEAR_CATALOG = [
  [501, 'c4ac7f 2a2c32 a7a9ab b7a480 f2e9db b8b9b7 55585d dec58e 7e5c3a dbc593 eae0c1 9a7e51 c9b392 c0a36a 6e5c49'],
  [401, '9e8e5d fff7d1 9b8055 d1d2d3 d0be9a 5c4635 9f966e 94989e ae7d58 a3a18f d9d2ab 4c5159 837353 e7e6e8 87643a'],
  [601, '563d2f eedcb2 936d5b b38c68 a9915a d2985c deb286 d9ba98 a45b3b d3b364 946e49 a06139 b59c7d 51261e d0b984'],
  [701, '876c36 c3d1db 163d8f b2a57f ceb271 152841 c1a573 554e2d 948266 a78541 3a563d 8a7c55 947746 8e7244 626e3b'],
  [901, 'bfc0b8 e4e1cb e0d7c0 e6e3d7 cbb48a c2b694 a68d6d 7a7a74 e7e5ce d3b96f dacc98 aa9c84 99947f a19e8c cfcab8'],
  [801, '807158 d8bf89 685f44 ddc7a6 cdb998 857456 c3b18c d8c39f a68c58 e0cfa9 ad987d 94856e cfc2b1 262528 a4a19b'],
];
const NEAR_HEX = new Map(NEAR_CATALOG.flatMap(([first, hex]) => hex.split(' ').map((h, i) => [String(first + i), h])));
const NEAR_FAMILIES = ['شيلد', 'جرافيتو', 'جرافينكس', 'ماربل'];
const NEAR_TINTS = { R: 'للأحمر', G: 'للأخضر', B: 'للأزرق' };
const NEAR_LEVELS = [[4, 'قريب جدًا', 'near-1'], [9, 'قريب', 'near-2'], [15, 'محتاج تظبيط', 'near-3']];

// الكود ← { key للمقارنة, base الرقم الأصلي, tint حروف الميل }: R-511 و r511 و R1-511 و 511-R و 511R و RB-511
function nearCodeParts(raw) {
  const s = normDigits(String(raw == null ? '' : raw)).trim().toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([RGB]{1,3})(?:\d+)?[-_/.](\d+)$/) || s.match(/^([RGB]{1,3})(\d+)$/);
  if (m) return { key: `${m[1]}-${m[2]}`, base: m[2], tint: m[1] };
  const r = s.match(/^(\d+)[-_/.]?([RGB]{1,3})$/);
  if (r) return { key: `${r[2]}-${r[1]}`, base: r[1], tint: r[2] };
  return { key: s, base: /^\d+$/.test(s) ? s : null, tint: '' };
}

function nearLab(hex) {
  const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = [0, 2, 4].map(i => lin(parseInt(hex.slice(i, i + 2), 16)));
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const nearSrgb = c => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
function nearHexOfLab([L, A, B]) {
  const fy = (L + 16) / 116, fx = A / 500 + fy, fz = fy - B / 200;
  const inv = t => t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787;
  const x = 0.95047 * inv(fx), y = inv(fy), z = 1.08883 * inv(fz);
  return [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z]
    .map(c => nearSrgb(c).toString(16).padStart(2, '0')).join('');
}
// درجة الكود من الكتالوج، والمايل: أصله متحرك شوية ناحية اللون (تقدير للترتيب والنقطة بس)
function nearColor(parts) {
  const hex = parts.base && NEAR_HEX.get(parts.base);
  if (!hex) return null;
  const lab = nearLab(hex);
  for (const t of parts.tint) { if (t === 'R') lab[1] += 7; else if (t === 'G') lab[1] -= 7; else lab[2] -= 7; }
  return { lab, hex: parts.tint ? nearHexOfLab(lab) : hex };
}
function nearDeltaE(a, b) {
  const rad = d => d * Math.PI / 180, deg = r => (r * 180 / Math.PI + 360) % 360;
  const C1 = Math.hypot(a[1], a[2]), C2 = Math.hypot(b[1], b[2]), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
  const a1 = a[1] * (1 + G), a2 = b[1] * (1 + G), c1 = Math.hypot(a1, a[2]), c2 = Math.hypot(a2, b[2]);
  const h1 = c1 ? deg(Math.atan2(a[2], a1)) : 0, h2 = c2 ? deg(Math.atan2(b[2], a2)) : 0;
  const dL = b[0] - a[0], dC = c2 - c1;
  let dh = 0;
  if (c1 && c2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(dh / 2));
  const Lm = (a[0] + b[0]) / 2, cm = (c1 + c2) / 2;
  let hm = h1 + h2;
  if (c1 && c2) hm = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2);
  const T = 1 - 0.17 * Math.cos(rad(hm - 30)) + 0.24 * Math.cos(rad(2 * hm)) + 0.32 * Math.cos(rad(3 * hm + 6)) - 0.2 * Math.cos(rad(4 * hm - 63));
  const SL = 1 + 0.015 * Math.pow(Lm - 50, 2) / Math.sqrt(20 + Math.pow(Lm - 50, 2)), SC = 1 + 0.045 * cm, SH = 1 + 0.015 * cm * T;
  const RT = -2 * Math.sqrt(Math.pow(cm, 7) / (Math.pow(cm, 7) + Math.pow(25, 7))) * Math.sin(rad(60 * Math.exp(-Math.pow((hm - 275) / 25, 2))));
  return Math.sqrt(Math.pow(dL / SL, 2) + Math.pow(dC / SC, 2) + Math.pow(dH / SH, 2) + RT * (dC / SC) * (dH / SH));
}
const nearTintText = t => t ? 'مايل ' + [...t].map(x => NEAR_TINTS[x]).join(' و') : '';
// عيلة الصنف: «جرافيتو 1 مللي» و«جرافيتو 2 مللي» واحد. صنف بره القايمة: بأول كلمة في اسمه.
function nearFamily(name) {
  const s = String(name || '').replace(/[أإآ]/g, 'ا').trim();
  return NEAR_FAMILIES.find(f => s.includes(f)) || s.split(/\s+/)[0] || '';
}

// lefts: [{ id, product_id, product_name, code, free }] ← { target, near, unknown, others, far }
function leftoverSuggest(code, product, lefts) {
  const t = nearCodeParts(code);
  if (!t.key) return null;
  const color = nearColor(t), fam = nearFamily(product.name), near = [], unknown = [], others = [];
  let far = 0;
  for (const l of lefts) {
    const mine = Number(l.product_id) === Number(product.id) || nearFamily(l.product_name) === fam;
    const lp = nearCodeParts(l.code), lc = nearColor(lp);
    let item = null;
    if (lp.key && lp.key === t.key) item = { score: -2, label: 'نفس الكود', cls: 'near-1' };
    else if (lp.base && lp.base === t.base) item = { score: -1, label: `نفس الأصل ${lp.base}${lp.tint ? ' — ' + nearTintText(lp.tint) : ''}`, cls: 'near-1' };
    else if (color && lc) {
      const d = nearDeltaE(color.lab, lc.lab), lv = NEAR_LEVELS.find(x => d <= x[0]);
      if (!lv) { far++; continue; }
      item = { score: d, label: lv[1], cls: lv[2] };
    } else item = { score: 1000, label: 'شوفه بعينك', cls: '', unknown: true };
    Object.assign(item, { left: l, hex: lc ? lc.hex : null });
    (mine ? (item.unknown ? unknown : near) : others).push(item);
  }
  const by = (x, y) => x.score - y.score;
  return { target: { ...t, hex: color ? color.hex : null }, near: near.sort(by), unknown, others: others.sort(by), far };
}

// box فاضي جوه الفورم. o: { code() نص الكود, product {id,name}, lefts, nameOf(l), isAdded(id), add(l) } ← { refresh }
function mountLeftoverNear(box, o) {
  let last = null, open = false;
  const dot = hex => `<span class="near-dot${hex ? '' : ' none'}"${hex ? ` style="background:#${hex}"` : ''}></span>`;
  const row = it => {
    const added = o.isAdded(it.left.id);
    return `<div class="near-row">${dot(it.hex)}<span class="near-name">${esc(o.nameOf(it.left))}</span><span class="badge ${it.cls}">${esc(it.label)}</span>
      <span class="near-kg">متاح <b>${esc(qtyText(it.left.free))}</b> كجم</span><button type="button" class="secondary small" data-near-add="${it.left.id}"${added ? ' disabled' : ''}>${added ? '✓ اتضافت' : '+ أضف'}</button></div>`;
  };
  const refresh = () => {
    const s = o.lefts.length ? leftoverSuggest(o.code(), o.product, o.lefts) : null;
    let html = '';
    if (s) {
      const tint = nearTintText(s.target.tint), empty = !s.near.length && !s.unknown.length;
      html = `<div class="near-box"><div class="near-head">${dot(s.target.hex)}<b>💡 رواكد قريبة من ${esc(o.code().trim())}</b>${tint ? `<span class="muted">${esc(tint)}</span>` : ''}</div>
        ${s.near.map(row).join('')}
        ${s.unknown.length ? `<div class="near-sub">كودها مش في الكتالوج — شوفها بعينك</div>${s.unknown.map(row).join('')}` : ''}
        ${empty ? '<div class="muted near-sub">مفيش رواكد قريبة من نفس الصنف.</div>' : ''}
        ${s.others.length ? `<details class="near-others"${open ? ' open' : ''}><summary>من أصناف تانية (${s.others.length})</summary>${s.others.map(row).join('')}</details>` : ''}
        ${s.far ? `<div class="muted near-sub">و${s.far} لونها بعيد — موجودين في «+ رواكد».</div>` : ''}
      </div>`;
    }
    if (html !== last) { box.innerHTML = html; last = html; }
  };
  box.addEventListener('toggle', e => { if (e.target.matches('.near-others')) open = e.target.open; }, true);
  box.addEventListener('click', e => {
    const a = e.target.closest('[data-near-add]'); if (!a) return;
    const l = o.lefts.find(x => Number(x.id) === +a.dataset.nearAdd);
    if (l && !o.isAdded(l.id)) o.add(l);
  });
  return { refresh };
}
