// أدوات عامة: الهروب من HTML، تنسيق الفلوس والتواريخ، وحساب الكسور العشرية بالظبط.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// الأرقام العربي (٠-٩) والفاصلة العربي بتتحول لأرقام عادية قبل أي حساب.
function normDigits(s) {
  return String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/٫/g, '.').replace(/[٬,]/g, '').trim();
}

// رقم عشري كـ BigInt مضروب في 10^scale (عشان مفيش ولا قرش يضيع في كسور الكمبيوتر).
// بيرجّع null لو مش رقم أو فيه كسور أكتر من scale.
function parseScaled(s, scale) {
  const t = normDigits(s);
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [i, f = ''] = t.split('.');
  if (f.length > scale) return null;
  return BigInt(i + f.padEnd(scale, '0'));
}

function scaledToString(v, scale) {
  const neg = v < 0n; let s = (neg ? -v : v).toString().padStart(scale + 1, '0');
  const out = scale ? s.slice(0, -scale) + '.' + s.slice(-scale) : s;
  return (neg ? '-' : '') + out;
}

// إجمالي البند = الكمية × السعر مقرّب لأقرب قرش (نفس round() في Postgres: النص بيتقرّب لفوق).
function lineTotalScaled(qty3, price2) {
  return (qty3 * price2 + 500n) / 1000n;
}

function money(n) {
  const v = Number(n || 0);
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // السالب: علامة الناقص تفضل لازقة في الرقم من الشمال (-1,500.00) جوه كلام عربي
  return (v < 0 ? '⁦-' + s + '⁩' : s) + ' ج.م';
}
// رقم بإشارة (+10 / −10) جوه كلام عربي: الإشارة تفضل لازقة في الرقم من الشمال
const ltr = s => (s ? '⁦' + s + '⁩' : '');
function moneyHtml(n, cls = '') {
  return `<span class="money ${cls}">${esc(money(n))}</span>`;
}
function qtyText(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
}
// (sql/031) «الحصوة» لكل صنف — فاضي = «بدون» (ومبتتكتبش جنب الصنف)
const PEBBLES = ['ناعم', 'خشن', 'نص مللي', '1 مللي', '1.5 مللي', '2 مللي', '3 مللي'];
const pebbleOptions = sel => `<option value="">بدون</option>` + PEBBLES.map(p => `<option value="${p}"${p === sel ? ' selected' : ''}>${p}</option>`).join('');
const pebbleTag = p => p ? ` — حصوة ${p}` : '';

function fmtDateTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' });
}
function fmtDate(t) {
  if (!t) return '';
  return new Date(t).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(t) {
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return 'دلوقتي';
  if (s < 3600) return `من ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `من ${Math.floor(s / 3600)} ساعة`;
  return fmtDateTime(t);
}

function statusBadge(st) {
  return `<span class="badge st-${esc(st)}">${esc(STATUS_LABELS[st] || st)}</span>`;
}
function roleChips(roles) {
  return (roles || []).map(r => `<span class="role-chip">${esc(ROLE_LABELS[r] || r)}</span>`).join('');
}
