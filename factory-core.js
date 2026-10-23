// صفحة التصنيع (sql/036) — بتترفع جنب صفحة المناديب على GitHub Pages (factory.html) وبتتفتح من كمبيوتر المصنع.
// بتكلّم Supabase بس، بحساب «صفحة التصنيع» (مش موظف):
//   - بتقرا «صورة التصنيع» (prod_link_state): التركيبات، الطلبات اللي محتاجة تصنيع، الباتشات وورقها، الخطط، مخزن المصنع (من غير أسعار)،
//     التحويلات والمرتجعات اللي مستنية الفحص، ونتيجة كل عملية اتبعتت (رقم الباتش مثلًا).
//   - بتبعت كل عملية (prod_link_submit) برقم من الصفحة (uid) — فلو اتبعتت مرتين مبتتكررش — والإدارة بتسجّلها باسم موظف التصنيع.
// اللي بيتعمل والنت قاطع بيستنى على الكمبيوتر (localStorage) ويتبعت لوحده أول ما النت يرجع.
// الملفات: factory-core (ده: الدخول والبيانات والإرسال والنوافذ والطباعة والرئيسية) ← factory-batches ← factory-formulas ← factory-store ← factory-boot.
const C = PORTAL_CONFIG;
const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'emek-factory-auth' } });
const F = { user: null, data: null, tab: 'home', params: {}, online: true };
document.documentElement.style.setProperty('--blue', '#C2185B');          // (نفس لون دفتر اميك الافتراضي)
document.documentElement.style.setProperty('--on-accent', '#ffffff');

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const toEmail = v => { const s = String(v || '').trim(); return s.includes('@') ? s : s.toLowerCase() + '@' + C.USERNAME_DOMAIN; };
const isNetwork = e => /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_|timed? ?out/i.test(String((e && (e.message || e)) || ''));
const kgText = kg => { const v = Number(kg); return qtyText(v) + ' كجم' + (v >= 100 ? ` (${qtyText(v / 1000)} طن)` : ''); };
const pct = qpt => qtyText(Number(qpt) / 10) + '%';
const gramsOf = v => parseScaled(String(v), 3) ?? 0n;
const cairoDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- اللي على الكمبيوتر: العمليات اللي لسه متبعتتش، وآخر صورة (عشان الصفحة تفتح من غير نت)
const lkey = k => `emek-factory-${k}:${F.user ? F.user.id : ''}`;
const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(lkey(k)) || 'null') ?? d; } catch (_) { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(lkey(k), JSON.stringify(v)); return true; } catch (_) { return false; } };
const outbox = () => readJson('outbox', []);
function saveOutbox(list) { if (!writeJson('outbox', list)) throw new Error('الكمبيوتر مش قادر يحفظ العملية (المساحة مليانة؟)'); }

// ---------- النوافذ والرسايل (زي دفتر اميك)
function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast ' + kind;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), kind === 'bad' ? 7000 : 3500);
}
function openModal({ title, small = '', body = '', wide = false, onClose } = {}) {
  const root = document.createElement('div');
  root.className = 'modal';
  root.innerHTML = `<div class="modal-backdrop"></div><div class="modal-card${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-title"><div>${small ? `<small>${esc(small)}</small>` : ''}<h3>${esc(title)}</h3></div><button type="button" class="modal-close" aria-label="إغلاق">×</button></div>
      <div class="modal-body">${body}</div></div>`;
  let closed = false;
  const close = () => { if (closed) return; closed = true; root.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
  const onKey = e => { if (e.key === 'Escape' && root === $('#modalRoot').lastElementChild) close(); };
  root.addEventListener('input', () => root.querySelectorAll('.form-error').forEach(x => x.classList.add('hidden')));
  root.querySelector('.modal-close').addEventListener('click', close);
  root.querySelector('.modal-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  $('#modalRoot').appendChild(root);
  const first = root.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return { el: root.querySelector('.modal-body'), card: root.querySelector('.modal-card'), close };
}
function confirmBox(title, html, { ok = 'تأكيد', cls = 'primary' } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const m = openModal({ title, body: `<div>${html}</div><div class="modal-actions"><button type="button" class="${cls}" data-ok>${esc(ok)}</button><button type="button" class="secondary" data-no>رجوع</button></div>`,
      onClose: () => { if (!answered) resolve(false); } });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
    m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
    setTimeout(() => m.el.querySelector('[data-ok]').focus(), 40);
  });
}
function promptBox(title, label, { ok = 'تأكيد', cls = 'primary', required = true, hint = '', value = '' } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const m = openModal({ title, body: `${hint ? `<div class="notice">${hint}</div>` : ''}<label>${esc(label)}<textarea data-v maxlength="300">${esc(value)}</textarea></label>
        <div class="form-error hidden" data-err></div>
        <div class="modal-actions"><button type="button" class="${cls}" data-ok>${esc(ok)}</button><button type="button" class="secondary" data-no>رجوع</button></div>`,
      onClose: () => { if (!answered) resolve(null); } });
    const v = m.el.querySelector('[data-v]');
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      const s = v.value.trim();
      if (required && !s) { const e = m.el.querySelector('[data-err]'); e.textContent = 'لازم تكتب ' + label; e.classList.remove('hidden'); v.focus(); return; }
      answered = true; m.close(); resolve(s);
    });
    m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
  });
}
async function busy(btn, fn) {
  if (btn && btn.disabled) return;
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ ' + old; }
  try { return await fn(); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}
function showError(target, err) {
  const msg = err?.message || String(err);
  if (target) { target.textContent = msg; target.classList.remove('hidden'); target.scrollIntoView({ block: 'nearest' }); }
  else toast(msg, 'bad');
}
// الطباعة: الورقة بتتحط في #printArea والباقي بيستخبى (print.css)
async function printHtml(html) {
  $('#printArea').innerHTML = html; document.body.classList.add('printing');
  try { window.print(); } finally { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; }
}

// ---------- الاتصال بالسحابة
async function rpc(name, args) {
  let r = await sb.rpc(name, args || {});
  if (r.error && /JWT|expired|401/i.test(r.error.message || '') && !isNetwork(r.error)) {
    const ref = await sb.auth.refreshSession();
    if (!ref.error) r = await sb.rpc(name, args || {});
  }
  if (r.error) {
    const e = new Error(r.error.message || 'حصل خطأ');
    e.network = isNetwork(r.error);
    e.auth = !e.network && /JWT|expired|401|مش حساب صفحة التصنيع|حساب صفحة التصنيع متوقف/i.test(r.error.message || '');
    throw e;
  }
  return r.data;
}
const signOutHere = () => sb.auth.signOut({ scope: 'local' }).catch(() => {});

// ---------- الدخول
function showLogin(msg) {
  unlockPage(); clearInterval(F.timer); clearInterval(F.lockTimer);
  $('#appShell').classList.add('hidden'); $('#loginScreen').classList.remove('hidden');
  if (msg) showError($('#loginError'), msg);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#loginError'), btn = $('#loginBtn');
  err.classList.add('hidden'); btn.disabled = true; btn.textContent = '⏳ دخول';
  try {
    const { data: d, error } = await sb.auth.signInWithPassword({ email: toEmail($('#loginUser').value), password: $('#loginPass').value });
    if (error) throw new Error(isNetwork(error) ? 'مفيش نت — اتأكد من النت وحاول تاني' : /Invalid login|invalid_grant|credentials/i.test(error.message) ? 'اسم الدخول أو الباسورد غلط' : /Too many|محاولات/i.test(error.message) ? 'محاولات كتير ورا بعض — استنى دقيقة وحاول تاني' : error.message);
    F.user = d.user;
    try { await rpc('prod_link_me'); }
    catch (ex) { await signOutHere(); F.user = null; throw new Error(/مش حساب صفحة التصنيع/.test(ex.message) ? 'الحساب ده مش حساب صفحة التصنيع — الصفحة دي لكمبيوتر المصنع بس' : ex.message); }
    $('#loginPass').value = '';
    await startApp(true);
  } catch (ex) { showError(err, ex); }
  finally { btn.disabled = false; btn.textContent = 'دخول'; }
});
$('#logoutBtn').addEventListener('click', async () => {
  const waiting = outbox().filter(x => x.state !== 'failed').length;
  if (!await confirmBox('خروج', waiting ? `<div class="notice warn">فيه ${waiting} عملية لسه متبعتتش — هتفضل على الكمبيوتر وهتتبعت لما تدخل تاني.</div>` : 'تخرج من صفحة التصنيع؟', { ok: 'خروج', cls: 'danger' })) return;
  await signOutHere();
  F.user = null; F.data = null; F.pin = null;
  showLogin();
});
$('#refreshBtn').addEventListener('click', e => busy(e.currentTarget, async () => { await sendOutbox(); await loadState(); }));

// ---------- 🔒 باسورد الفتح (sql/029): الصفحة بتتقفل لوحدها لو فضلت X دقيقة من غير حركة، وأول ما تتفتح والحساب لسه داخل
F.pin = null; F.lastAct = Date.now(); F.locked = false; F.mustUnlock = false; F.pinAt = 0;
const pinOn = () => !!(F.pin && F.pin.has_pin);
for (const ev of ['mousedown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => { if (!F.locked) F.lastAct = Date.now(); }, { passive: true, capture: true });
async function loadPin() {
  try { F.pin = await rpc('app_pin_state', { p_offline: true }); F.pinAt = Date.now(); writeJson('pin', F.pin); }
  catch (e) { if (!e.network && /app_pin_state|Could not find/i.test(e.message)) F.pin = null; }
  if (F.mustUnlock && pinOn() && !F.locked) lockPage();
  else if (!pinOn() && F.locked) unlockPage();
  if (!pinOn()) F.mustUnlock = false;
}
function checkIdle() {
  if (!F.user || F.locked) return;
  if (Date.now() - F.pinAt > 5 * 60e3 && document.visibilityState === 'visible') loadPin();
  if (pinOn() && Date.now() - F.lastAct >= (Number(F.pin.minutes) || 10) * 60e3) lockPage();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkIdle(); });
function lockPage() {
  F.locked = true; document.body.classList.add('locked');
  $('#lockWho').textContent = F.data && F.data.account ? F.data.account.name : '';
  $('#lockError').classList.add('hidden'); $('#lockPin').value = '';
  $('#lockScreen').classList.remove('hidden');
  setTimeout(() => $('#lockPin').focus(), 30);
}
function unlockPage() { F.locked = false; F.mustUnlock = false; F.lastAct = Date.now(); document.body.classList.remove('locked'); $('#lockScreen').classList.add('hidden'); }
const sha256Hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
async function verifyOffline(pin) {
  const s = readJson('pin', null);
  if (!s || !s.salt || !s.hash || !(crypto && crypto.subtle)) return { ok: false, nonet: true };
  const fails = Number(readJson('pinfail', 0)) || 0;
  if (await sha256Hex(s.salt + ':' + pin) === s.hash) { try { localStorage.removeItem(lkey('pinfail')); } catch (_) {} return { ok: true }; }
  if (fails + 1 >= 5) { try { localStorage.removeItem(lkey('pinfail')); } catch (_) {} return { ok: false, signout: true }; }
  writeJson('pinfail', fails + 1);
  return { ok: false, left: 5 - (fails + 1) };
}
async function lockedOut(msg) { await signOutHere(); F.user = null; F.data = null; F.pin = null; showLogin(msg); }
$('#lockPin').addEventListener('input', () => { $('#lockError').classList.add('hidden'); if (/^\d{6}$/.test(normDigits($('#lockPin').value))) $('#lockForm').requestSubmit(); });
$('#lockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#lockError'), btn = $('#lockBtn'), v = normDigits($('#lockPin').value);
  const fail = m => { showError(err, m); $('#lockPin').value = ''; $('#lockPin').focus(); };
  if (!/^\d{6}$/.test(v)) return fail('باسورد الفتح 6 أرقام');
  btn.disabled = true;
  try {
    let r;
    try { r = await rpc('verify_app_pin', { p_pin: v }); try { localStorage.removeItem(lkey('pinfail')); } catch (_) {} }
    catch (ex) { if (!ex.network) throw ex; r = await verifyOffline(v); }
    if (r.ok) return unlockPage();
    if (r.signout) return lockedOut('باسورد الفتح اتكتب غلط 5 مرات — ادخل باسم الدخول والباسورد تاني');
    if (r.nonet) return fail('مفيش نت — وصّل الكمبيوتر بالنت مرة وجرّب تاني');
    if (r.wait_until) return fail('محاولات غلط كتير — استنى 5 دقايق وجرّب تاني');
    fail(`باسورد الفتح غلط — فاضل ${r.left} ${r.left === 1 ? 'محاولة' : 'محاولات'} وبعدها الصفحة هتخرج من الحساب`);
  } catch (ex) { fail(ex.message); }
  finally { btn.disabled = false; }
});
$('#lockLogout').addEventListener('click', () => lockedOut());

// fresh: لسه داخل باسم الدخول والباسورد (مفيش قفل دلوقتي)
async function startApp(fresh) {
  $('#loginScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
  F.pin = readJson('pin', null); F.mustUnlock = !fresh; F.lastAct = Date.now();
  if (F.mustUnlock && pinOn()) lockPage();
  clearInterval(F.lockTimer); F.lockTimer = setInterval(checkIdle, 15000);
  F.data = readJson('state', null);
  render();
  loadPin();
  await loadState();
  sendOutbox();
  scheduleRefresh();
}
// كل دقيقة — وكل 15 ثانية لو فيه عمليات مستنية الإدارة تسجّلها (عشان رقم الباتش يبان على طول)
function scheduleRefresh() {
  clearInterval(F.timer);
  F.timer = setInterval(() => { if (document.visibilityState === 'visible' && F.user) { sendOutbox(); loadState(true); } }, waitingOps().length ? 15000 : 60000);
}

// ---------- البيانات من الإدارة
async function loadState(quiet) {
  try {
    const d = await rpc('prod_link_state');
    F.data = d; writeJson('state', d); setOnline(true);
  } catch (e) {
    if (e.network) setOnline(false);
    else if (e.auth) { await signOutHere(); return showLogin(/متوقف/.test(e.message) ? e.message : 'انتهت الجلسة — ادخل تاني'); }
    else if (!quiet) toast(e.message, 'bad');
  }
  // (النافذة المفتوحة — زي فورم أمر تصنيع بيتكتب — متتلمسش)
  if (!(quiet && $('#modalRoot').children.length)) render(); else paintHeader();
  scheduleRefresh();
}
const S = () => (F.data && F.data.state && !F.data.state.error ? F.data.state : null);
const logOf = uid => ((S() && S().log) || []).find(x => x.uid === uid) || null;

function setOnline(v) {
  F.online = v;
  const n = outbox().filter(x => x.state !== 'failed').length;
  const bar = $('#netBar');
  bar.textContent = !v ? `📵 مفيش نت${n ? ` — ${n} عملية مستنية على الكمبيوتر وهتتبعت لوحدها أول ما النت يرجع` : ' — بتشوف آخر بيانات اتحملت'}` : n ? `⏳ ${n} عملية بتتبعت دلوقتي…` : '';
  bar.classList.toggle('hidden', !bar.textContent);
}
function paintHeader() {
  const d = F.data;
  $('#whoami').textContent = d && d.account ? `${d.account.name}${S() ? ' — باسم ' + S().actor : ''}` : '';
  let line = '', bad = false;
  if (d) {
    if (d.mode === 'direct') line = '🟢 متصل بالإدارة';
    else if (d.factory_seen_at) {
      const mins = (Date.parse(d.server_time || new Date()) - Date.parse(d.factory_seen_at)) / 60000;
      bad = mins > 15;
      line = bad ? `⚠️ سيرفر الإدارة مش متصل من ${timeAgo(d.factory_seen_at)} — العمليات هتتسجل أول ما يرجع` : `🟢 الإدارة متصلة — آخر تحديث ${d.published_at ? timeAgo(d.published_at) : ''}`;
    } else line = '⏳ سيرفر الإدارة لسه متصلش';
  }
  $('#connStatus').textContent = line; $('#connStatus').classList.toggle('bad', bad);
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === F.tab));
  const st = S(), set = (k, v) => { const el = $(`[data-count="${k}"]`); if (el) { el.textContent = v; el.classList.toggle('hidden', !v); } };
  set('home', problemOps().length);
  set('orders', st ? (st.to_make || []).length : 0);
  set('run', st ? (st.batches || []).filter(b => b.status === 'in_progress').length : 0);
  set('store', st ? (st.transfers || []).filter(t => t.status === 'issued').length + (st.returns || []).length : 0);
}

// ---------- الإرسال: كل عملية بتتحفظ على الكمبيوتر الأول، وبعدين بتتبعت (ولو النت قاطع بتستنى)
// بيرجّع: { uid, state: 'done' (الإدارة سجّلتها) | 'server' (مستنية سيرفر الإدارة) | 'waiting' (مستنية النت) | 'failed', error }
async function submitOp(payload) {
  const it = { uid: uuid(), payload: { ...payload, at: new Date().toISOString() }, created_at: new Date().toISOString(), state: 'waiting' };
  saveOutbox(outbox().concat(it));
  await sendOutbox();
  const now = outbox().find(x => x.uid === it.uid);
  if (!now) { await loadState(true); const lg = logOf(it.uid); return { uid: it.uid, state: lg ? 'done' : 'server', result: lg ? lg.result : null }; }
  if (now.state === 'failed') { saveOutbox(outbox().filter(x => x.uid !== it.uid)); return { uid: it.uid, state: 'failed', error: now.error }; }
  return { uid: it.uid, state: 'waiting' };
}
let sendChain = Promise.resolve();
function sendOutbox() { const p = sendChain.then(doSend); sendChain = p.catch(() => {}); return p; }
async function doSend() {
  if (!F.user) return;
  for (const it of outbox().filter(x => x.state !== 'failed')) {
    try { await rpc('prod_link_submit', { p_uid: it.uid, p_payload: it.payload }); saveOutbox(outbox().filter(x => x.uid !== it.uid)); }
    catch (e) {
      if (e.network) { setOnline(false); break; }
      if (e.auth) break;
      saveOutbox(outbox().map(x => x.uid === it.uid ? { ...x, state: 'failed', error: e.message } : x));
    }
  }
  setOnline(F.online);
}
// مستنية: على الكمبيوتر (من غير نت) أو في الصندوق لسه الإدارة مسجّلتهاش
const waitingOps = () => outbox().filter(x => x.state !== 'failed').map(x => ({ ...x, where: 'local' }))
  .concat(((F.data && F.data.inbox) || []).filter(i => !i.delivered && !i.error).map(i => ({ uid: i.uid, payload: { op: i.op, label: i.label }, created_at: i.created_at, where: 'server' })));
// اترفضت (والسبب) — لحد ما تتشال من «تمام»
const problemOps = () => {
  const seen = new Set(readJson('seen', []));
  return outbox().filter(x => x.state === 'failed').map(x => ({ uid: x.uid, label: x.payload.label || x.payload.op, error: x.error, at: x.created_at, local: true }))
    .concat(((F.data && F.data.inbox) || []).filter(i => i.error && !seen.has(i.uid)).map(i => ({ uid: i.uid, label: i.label || i.op, error: i.error, at: i.created_at })));
};
// بعد ما العملية اتبعتت: رسالة على حسب حالتها
function afterSubmit(r, doneMsg) {
  if (r.state === 'failed') { showError(null, r.error); return false; }
  if (r.state === 'done') toast(doneMsg, 'good');
  else if (r.state === 'server') toast('📨 اتبعتت للإدارة — هتتسجل أول ما سيرفر الإدارة ياخدها (في خلال دقيقة لو متصل)', 'good');
  else toast('📵 مفيش نت — العملية اتحفظت على الكمبيوتر وهتتبعت لوحدها أول ما النت يرجع', 'good');
  render(); scheduleRefresh();
  return true;
}

// ---------- التبويبات
const Tabs = {};          // name → render(el, params)
function go(tab, params = {}) {
  F.tab = Tabs[tab] ? tab : 'home'; F.params = params;
  render();
  window.scrollTo(0, 0);
}
function render() {
  if (!F.user) return;
  paintHeader();
  const el = document.createElement('div');
  const d = F.data;
  if (!d) el.innerHTML = '<div class="empty">⏳ جاري التحميل…</div>';
  else if (!d.state) el.innerHTML = `<div class="panel"><div class="notice warn">${d.mode === 'direct' ? 'الإدارة لسه مشغّلتش صفحة التصنيع.' : '⏳ لسه مفيش بيانات من سيرفر الإدارة — أول ما يتصل بالنت البيانات هتظهر هنا لوحدها.'}</div></div>`;
  else if (d.state.error) el.innerHTML = `<div class="panel"><div class="notice bad">${esc(d.state.error)}</div><div class="muted">كلّم الإدارة. أول ما يتصلح البيانات هتظهر هنا لوحدها.</div></div>`;
  else {
    try { Tabs[F.tab](el, F.params); }
    catch (e) { el.innerHTML = `<div class="panel"><div class="notice bad">${esc(e.message || e)}</div></div>`; }
  }
  $('#page').replaceChildren(el);
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });

// ---------- الرئيسية: الأرقام، والعمليات اللي مستنية أو اترفضت، وتذكير الخطط
const opLabel = o => esc((o.payload && (o.payload.label || o.payload.op)) || o.label || '');
Tabs.home = (el) => {
  const st = S(), running = st.batches.filter(b => b.status === 'in_progress');
  const low = st.materials.concat(st.packaging).filter(x => x.active && x.min != null && Number(x.qty) < Number(x.min));
  const waiting = waitingOps(), probs = problemOps();
  const toSend = (st.plans || []).filter(p => p.printed_at && (p.batches || []).some(x => x.status === 'in_progress' && !x.started_at));
  const card = (label, val, hint, tab, params) => `<div class="card clickable" data-go="${tab}" data-params='${esc(JSON.stringify(params || {}))}'><small>${esc(label)}</small><strong>${val}</strong>${hint ? `<div class="mini">${esc(hint)}</div>` : ''}</div>`;
  el.innerHTML = `${toSend.map(p => `<div class="notice warn" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span>🔔 خطة ${esc(fmtDate(p.plan_date + 'T12:00:00'))} اتطبعت — ابعت للإدارة إنها «جاري التنفيذ» أول ما تبدأوا</span>
      <button type="button" class="good small" data-plan-send="${esc(p.plan_date)}">📤 ابعت للإدارة: جاري التنفيذ</button></div>`).join('')}
    <div class="grid">
      ${card('🏭 طلبات محتاجة تصنيع', st.to_make.length, 'طلبات العملاء المعتمدة', 'orders')}
      ${card('⚙️ باتشات بتتعمل', running.length, running.filter(b => b.started_at).length ? `منها ${running.filter(b => b.started_at).length} جاري التنفيذ` : '', 'run')}
      ${card('🚚 خامات في الطريق', st.transfers.filter(t => t.status === 'issued').length, 'أول ما توصل: «✅ تم الاستلام»', 'store', { tab: 'transfers' })}
      ${card('🔬 مرتجعات للفحص', st.returns.length, 'مواصفات فنية', 'store', { tab: 'returns' })}
      ${card('قربت تخلص في مخزن المصنع', `<span class="${low.length ? 'out' : ''}">${low.length}</span>`, 'اطلبها من مخزن الإدارة', 'store', { tab: 'materials' })}
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>📨 العمليات اللي اتبعتت</h2></div>
      ${probs.length ? `<div class="notice bad"><b>⛔ ${probs.length} عملية الإدارة مقبلتهاش:</b></div>
        <div class="table-wrap"><table><thead><tr><th>العملية</th><th>السبب</th><th>إمتى</th><th></th></tr></thead><tbody>
        ${probs.map(p => `<tr><td>${esc(p.label)}</td><td class="out">${esc(p.error)}</td><td class="nowrap">${esc(timeAgo(p.at))}</td>
          <td><button type="button" class="secondary small" data-seen="${esc(p.uid)}" data-local="${p.local ? 1 : ''}">تمام</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${waiting.length ? `<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>العملية</th><th>الحالة</th><th>إمتى</th></tr></thead><tbody>
        ${waiting.map(w => `<tr><td>${opLabel(w)}</td><td>${w.where === 'local' ? '<span class="badge st-pending">📵 مستنية النت</span>' : '<span class="badge st-approved">⏳ مستنية سيرفر الإدارة</span>'}</td><td class="nowrap">${esc(timeAgo(w.created_at))}</td></tr>`).join('')}</tbody></table></div>`
      : probs.length ? '' : '<div class="empty">✓ كل العمليات اتسجلت في الإدارة</div>'}
      <div class="muted" style="margin-top:8px;font-size:12px">كل عملية بتتعمل هنا بتتسجل في الإدارة باسم <b>${esc(st.actor)}</b> — بنفس قواعد البرنامج بالظبط. لو الإدارة رفضتها السبب بيظهر هنا.</div></div>`;
  el.addEventListener('click', async e => {
    const c = e.target.closest('[data-go]'); if (c) return go(c.dataset.go, JSON.parse(c.dataset.params || '{}'));
    const s = e.target.closest('[data-seen]');
    if (s) {
      if (s.dataset.local) saveOutbox(outbox().filter(x => x.uid !== s.dataset.seen));
      else writeJson('seen', [...new Set(readJson('seen', []).concat(s.dataset.seen))].slice(-300));
      return render();
    }
    const ps = e.target.closest('[data-plan-send]');
    if (ps) await busy(ps, async () => afterSubmit(await submitOp({ op: 'plan_started', date: ps.dataset.planSend, label: `📤 جاري التنفيذ — خطة ${fmtDate(ps.dataset.planSend + 'T12:00:00')}` }), '📤 اتبعت للإدارة: الباتشات «جاري التنفيذ»'));
  });
};
