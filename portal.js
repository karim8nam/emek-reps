// صفحة المناديب على الموبايل (بتترفع على GitHub Pages). بتكلّم Supabase بس — بحساب المندوب (مش موظف):
//   - بتقرا «صورة المندوب» من المصنع (portal_my_state): عملاؤه وأرصدتهم، الأسعار، طلباته وحالتها، بلاغاته، والكشف الشهري.
//   - بتبعت طلب أو بلاغ تحصيل (portal_submit) — كل واحد ليه رقم (uid) من الموبايل، فلو اتبعت مرتين مبيتكررش.
// اللي بيتكتب والنت قاطع بيستنى على الموبايل (localStorage) ويتبعت لوحده أول ما النت يرجع.
// المندوب مبيشوفش نسبة العمولة ولا مبلغها — ولا أي حاجة تانية في البرنامج.
(() => {
  const C = PORTAL_CONFIG;
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'emek-portal-auth' } });
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const normDigits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/[٬,]/g, '').trim();
  // رقم عشري بالظبط (BigInt × 10^scale) — null لو مش رقم أو فيه كسور أكتر من المسموح
  const parseScaled = (s, scale) => { const t = normDigits(s); if (!/^\d+(\.\d+)?$/.test(t)) return null; const [i, f = ''] = t.split('.'); if (f.length > scale) return null; return BigInt(i + f.padEnd(scale, '0')); };
  const scaledToString = (v, scale) => { let s = v.toString().padStart(scale + 1, '0'); return scale ? s.slice(0, -scale) + '.' + s.slice(-scale) : s; };
  const money = n => { const v = Number(n || 0); const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (v < 0 ? '-' : '') + s + ' ج.م'; };
  const moneyHtml = (n, cls = '') => `<span class="money ${cls}">${esc(money(n))}</span>`;
  const qty = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const tons = kg => qty(Number(kg || 0) / 1000) + ' طن';
  const fmtDate = t => t ? new Date(t).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short' }) : '';
  const fmtDateTime = t => t ? new Date(t).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const ago = t => { const s = Math.max(0, (Date.now() - Date.parse(t)) / 1000); return s < 90 ? 'دلوقتي' : s < 3600 ? `من ${Math.round(s / 60)} دقيقة` : s < 86400 ? `من ${Math.round(s / 3600)} ساعة` : fmtDateTime(t); };
  const monthName = ym => { const [y, m] = String(ym).split('-').map(Number); return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
  const toEmail = v => { const s = String(v || '').trim(); return s.includes('@') ? s : s.toLowerCase() + '@' + C.USERNAME_DOMAIN; };
  const isNetwork = e => /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_|timed? ?out/i.test(String((e && (e.message || e)) || ''));

  let user = null, data = null, tab = 'home', online = true, sending = false, refreshTimer = null, orderDraft = null;

  // ---------- اللي على الموبايل: الطلبات اللي لسه متبعتتش، وآخر صورة من المصنع (عشان الصفحة تفتح من غير نت)
  const key = k => `emek-portal-${k}:${user ? user.id : ''}`;
  const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(key(k)) || 'null') ?? d; } catch (_) { return d; } };
  const outbox = () => readJson('outbox', []);
  function saveOutbox(list) {
    try { localStorage.setItem(key('outbox'), JSON.stringify(list)); }
    catch (_) { throw new Error('الموبايل مش قادر يحفظ الطلب (المساحة مليانة؟) — جرّب من غير صورة'); }
  }
  const dropOut = uid => saveOutbox(outbox().filter(x => x.uid !== uid));

  function toast(msg, kind = '') {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast ' + kind;
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), kind === 'bad' ? 6500 : 3200);
  }
  function setOnline(v) {
    online = v;
    const n = outbox().filter(x => x.state !== 'failed').length;
    const bar = $('#netBar');
    bar.textContent = !v ? `📵 مفيش نت${n ? ` — ${n} حاجة مستنية على الموبايل وهتتبعت لوحدها أول ما النت يرجع` : ' — بتشوف آخر بيانات اتحملت'}` : n ? `⏳ ${n} حاجة بتتبعت دلوقتي…` : '';
    bar.classList.toggle('hidden', !bar.textContent);
  }

  async function rpc(name, args) {
    let r = await sb.rpc(name, args || {});
    if (r.error && /JWT|expired|401/i.test(r.error.message || '') && !isNetwork(r.error)) {
      const ref = await sb.auth.refreshSession();
      if (!ref.error) r = await sb.rpc(name, args || {});
    }
    if (r.error) {
      const e = new Error(r.error.message || 'حصل خطأ');
      e.network = isNetwork(r.error);
      e.auth = !e.network && /JWT|expired|401|مش حساب مندوب/i.test(r.error.message || '');
      throw e;
    }
    return r.data;
  }

  // ---------- الشيت اللي بيطلع من تحت
  function openSheet(title, body, { onClose } = {}) {
    const root = document.createElement('div');
    root.className = 'sheet';
    root.innerHTML = `<div class="sheet-back"></div><div class="sheet-card" role="dialog" aria-modal="true"><div class="sheet-title"><h2>${esc(title)}</h2><button type="button" class="x" aria-label="إغلاق">×</button></div><div class="sheet-body">${body}</div></div>`;
    let closed = false;
    const close = () => { if (closed) return; closed = true; root.remove(); if (onClose) onClose(); };
    root.querySelector('.x').onclick = close; root.querySelector('.sheet-back').onclick = close;
    $('#sheetRoot').appendChild(root);
    return { el: root.querySelector('.sheet-body'), close };
  }
  function confirmSheet(title, html, okText, cls = 'primary') {
    return new Promise(resolve => {
      let answered = false;
      const s = openSheet(title, `${html}<div class="actions"><button type="button" class="${cls}" data-ok>${esc(okText)}</button><button type="button" class="secondary" data-no>رجوع</button></div>`, { onClose: () => { if (!answered) resolve(false); } });
      $('[data-ok]', s.el).onclick = () => { answered = true; s.close(); resolve(true); };
      $('[data-no]', s.el).onclick = () => s.close();
    });
  }
  const showErr = (box, msg) => { box.textContent = msg; box.classList.remove('hidden'); box.scrollIntoView({ block: 'nearest' }); };

  // ---------- الدخول
  // الخروج من الموبايل ده بس — المكتبة لوحدها بتخرّج كل أجهزة الحساب (scope=global)، والمندوب ممكن يبقى داخل من موبايلين
  const signOutHere = () => sb.auth.signOut({ scope: 'local' }).catch(() => {});
  function showLogin(msg) {
    $('#appScreen').classList.add('hidden'); $('#loginScreen').classList.remove('hidden');
    if (msg) showErr($('#loginError'), msg);
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#loginError'), btn = $('#loginBtn');
    err.classList.add('hidden'); btn.disabled = true; btn.textContent = '⏳ دخول';
    try {
      const { data: d, error } = await sb.auth.signInWithPassword({ email: toEmail($('#loginUser').value), password: $('#loginPass').value });
      if (error) throw new Error(isNetwork(error) ? 'مفيش نت — اتأكد من النت وحاول تاني' : /Invalid login|invalid_grant|credentials/i.test(error.message) ? 'اسم الدخول أو الباسورد غلط' : /Too many|محاولات/i.test(error.message) ? 'محاولات كتير ورا بعض — استنى دقيقة وحاول تاني' : error.message);
      user = d.user;
      try { await rpc('portal_me'); }
      catch (ex) { await signOutHere(); user = null; throw new Error(/مش حساب مندوب/.test(ex.message) ? 'الحساب ده مش حساب مندوب — صفحة المناديب للمناديب بس' : ex.message); }
      $('#loginPass').value = '';
      await startApp();
    } catch (ex) { showErr(err, ex.message); }
    finally { btn.disabled = false; btn.textContent = 'دخول'; }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    const waiting = outbox().filter(x => x.state !== 'failed').length;
    if (!await confirmSheet('خروج', waiting ? `<div class="note warn">فيه ${waiting} حاجة لسه متبعتتش — هتفضل على الموبايل وهتتبعت لما تدخل تاني.</div>` : 'تخرج من الصفحة؟', 'خروج', 'danger')) return;
    clearInterval(refreshTimer);
    await signOutHere();
    user = null; data = null;
    showLogin();
  });

  async function startApp() {
    $('#loginScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden');
    data = readJson('state', null);
    render();
    await loadState();
    sendOutbox();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') { sendOutbox(); loadState(true); } }, 60000);
  }

  // ---------- البيانات من المصنع
  async function loadState(quiet) {
    try {
      const d = await rpc('portal_my_state');
      data = d;
      try { localStorage.setItem(key('state'), JSON.stringify(d)); } catch (_) {}
      setOnline(true);
    } catch (e) {
      if (e.network) setOnline(false);
      else if (e.auth) { await signOutHere(); return showLogin(/متوقف/.test(e.message) ? e.message : 'انتهت الجلسة — ادخل تاني'); }
      else if (!quiet) toast(e.message, 'bad');
    }
    // (الفورم اللي بيتكتب أو الشيت المفتوح ميتلمسوش)
    if (!(quiet && (tab === 'order' || $('#sheetRoot').children.length))) render();
    else paintHeader();
  }
  const st = () => (data && data.state) || null;
  const productName = id => ((st() && st().products) || []).find(p => Number(p.id) === Number(id))?.name || 'صنف';
  const customerById = id => ((st() && st().customers) || []).find(c => Number(c.id) === Number(id));

  function paintHeader() {
    $('#repName').textContent = data && data.rep ? data.rep.name : '';
    let line = '';
    if (data) {
      if (data.mode === 'direct') line = '🟢 متصل بالمصنع';
      else if (data.factory_seen_at) {
        const mins = (Date.parse(data.server_time || new Date()) - Date.parse(data.factory_seen_at)) / 60000;
        line = mins > 15 ? `⚠️ المصنع مش متصل من ${ago(data.factory_seen_at)} — طلباتك هتوصل أول ما يرجع` : `🟢 المصنع متصل — آخر تحديث ${data.published_at ? ago(data.published_at) : ''}`;
      } else line = '⏳ المصنع لسه متصلش';
    }
    $('#factoryLine').textContent = line;
    $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }

  // ---------- الإرسال: كل حاجة بتتحفظ على الموبايل الأول، وبعدين بتتبعت (ولو النت قاطع بتستنى)
  // بيرجّع: 'sent' اتبعت / 'waiting' مستني النت على الموبايل / { error } المصنع رفضه (بيتشال من الموبايل عشان يتصلح ويتبعت تاني)
  async function queue(kind, payload) {
    const it = { uid: uuid(), kind, payload: { ...payload, phone_at: new Date().toISOString() }, created_at: new Date().toISOString(), state: 'waiting' };
    saveOutbox(outbox().concat(it));
    await sendOutbox();
    const now = outbox().find(x => x.uid === it.uid);
    if (!now) return 'sent';
    if (now.state === 'failed') { dropOut(it.uid); return { error: now.error }; }
    return 'waiting';
  }
  // واحدة ورا التانية (الإرسال من الزرار ومن التحديث كل دقيقة مبيدخلوش في بعض)
  let sendChain = Promise.resolve();
  function sendOutbox() { const p = sendChain.then(doSend); sendChain = p.catch(() => {}); return p; }
  async function doSend() {
    if (!user) return false;
    sending = true;
    let changed = false;
    try {
      for (const it of outbox().filter(x => x.state !== 'failed')) {
        try {
          await rpc('portal_submit', { p_uid: it.uid, p_kind: it.kind, p_payload: it.payload });
          dropOut(it.uid); changed = true;
        } catch (e) {
          if (e.network) { setOnline(false); break; }
          if (e.auth) break;
          // المصنع رفضه (العميل اتنقل، الصنف وقف…): بيفضل ظاهر بالسبب لحد ما المندوب يمسحه
          saveOutbox(outbox().map(x => x.uid === it.uid ? { ...x, state: 'failed', error: e.message } : x)); changed = true;
        }
      }
    } finally { sending = false; }
    setOnline(online);
    if (changed) await loadState(true);
    return changed;
  }
  window.addEventListener('online', () => { sendOutbox(); loadState(true); });
  window.addEventListener('offline', () => setOnline(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && user) { sendOutbox(); loadState(true); } });

  // ---------- الطلبات: اللي على الموبايل + في الطريق + في المصنع + طلبات عملاؤه التانية
  // حالة التصنيع لكل صنف (لو اتعمله أمر تصنيع)
  const batchText = l => !l.batch ? '' : ` — 🏭 ${l.batch_status === 'done' ? 'اتصنع' : l.batch_status === 'cancelled' ? 'اتلغى أمر التصنيع' : 'بيتصنع'} (باتش ${l.batch})`;
  const lineText = l => `${l.item || productName(l.product_id)} — ${l.unit === 'ton' ? tons(l.kg ?? l.quantity_kg) : `${qty(l.count)} ${l.type || l.package_type} × ${qty(l.weight)} كجم`}${l.code ? ' — ' + l.code : ''}${batchText(l)}`;
  function stageOf(g) {
    const live = g.filter(d => d.type === 'invoice' && !['cancelled', 'rejected'].includes(d.status)).pop() || g[g.length - 1];
    const ex = g.find(d => d.exit_no);
    if (ex) return [`✅ خرج من المصنع ${fmtDate(ex.exit_at)}`, 'good'];
    if (live.status === 'cancelled') return ['اتلغى', 'bad'];
    if (live.status === 'rejected') return ['المصنع رفضه', 'bad'];
    if (live.track && live.status === 'approved') return [live.track, ''];
    if (live.type === 'invoice') return live.status === 'approved' ? ['فاتورة معتمدة — بتتجهز', ''] : ['فاتورة مستنية الموافقة', 'warn'];
    return live.status === 'approved' ? ['عرض سعر معتمد', ''] : ['عرض سعر مستني الموافقة', 'warn'];
  }
  function orderCards() {
    const s = st(); if (!s) return [];
    const inbox = (data.inbox || []).filter(i => i.kind === 'order'), out = outbox().filter(x => x.kind === 'order');
    const groups = new Map();
    for (const d of [...s.docs].sort((a, b) => a.id - b.id)) { const r = Number(d.root); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(d); }
    const cards = [], used = new Set(), known = new Set(s.orders.map(o => o.uid));
    for (const o of out) cards.push({ at: o.created_at, customer: o.payload.customer_id ? (customerById(o.payload.customer_id) || {}).name : o.payload.new_customer_name,
      stage: o.state === 'failed' ? ['مقبلش: ' + o.error, 'bad'] : ['على الموبايل — لسه متبعتش', 'gray'], lines: o.payload.lines.map(l => ({ ...l, kg: l.quantity_kg })), out: o });
    for (const i of inbox) {
      if (known.has(i.uid) || out.some(x => x.uid === i.uid)) continue;
      const p = i.payload || {};
      cards.push({ at: i.created_at, customer: p.customer_id ? (customerById(p.customer_id) || {}).name : p.new_customer_name,
        stage: i.error ? ['مقبلش: ' + i.error, 'bad'] : i.delivered ? ['وصل المصنع', 'warn'] : ['اتبعت — مستني المصنع يستلمه', 'gray'], lines: (p.lines || []).map(l => ({ ...l, kg: l.quantity_kg })) });
    }
    for (const o of s.orders) {
      let g = null;
      if (o.doc_id) { const d = s.docs.find(x => Number(x.id) === Number(o.doc_id)); if (d) { g = groups.get(Number(d.root)); used.add(Number(d.root)); } }
      const stage = o.status === 'rejected' ? ['اترفض: ' + (o.reason || ''), 'bad'] : o.status === 'pending' ? (o.lines.some(l => l.batch) ? ['وصل المصنع — بيتصنع', 'warn'] : ['وصل المصنع — بيتراجع', 'warn']) : g ? stageOf(g) : ['اتسجل', ''];
      const liveDoc = g ? (g.filter(d => d.type === 'invoice').pop() || g[g.length - 1]) : null;
      cards.push({ at: o.created_at, customer: o.customer, stage, lines: liveDoc ? liveDoc.lines : o.lines, number: liveDoc ? `${liveDoc.type === 'quote' ? 'عرض' : 'فاتورة'} ${liveDoc.number}` : 'طلب ' + o.id, mine: true, invoice: exitedInvoice(g) });
    }
    for (const [r, g] of groups) {
      if (used.has(r)) continue;
      const liveDoc = g.filter(d => d.type === 'invoice').pop() || g[g.length - 1];
      cards.push({ at: g[0].created_at, customer: liveDoc.customer, stage: stageOf(g), lines: liveDoc.lines, number: `${liveDoc.type === 'quote' ? 'عرض' : 'فاتورة'} ${liveDoc.number}`, invoice: exitedInvoice(g) });
    }
    return cards.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  // الفاتورة اللي خرجت (عشان «⚠️ مشكلة في الطلب» لو وصل ناقص أو لونه غلط)
  const exitedInvoice = g => (g || []).filter(d => d.type === 'invoice' && d.status === 'approved' && d.exit_no).pop() || null;
  const complaintsOn = docId => complaintCards().filter(k => Number(k.doc_id) === Number(docId));
  const orderCardHtml = c => {
    const ks = c.invoice ? complaintsOn(c.invoice.id) : [];
    return `<div class="item"><div class="item-head"><b>${esc(c.customer || '—')}</b><span class="chip ${c.stage[1]}">${esc(c.stage[0])}</span></div>
    <div class="item-sub">${c.number ? esc(c.number) + ' — ' : ''}${esc(fmtDateTime(c.at))}</div>
    <ul class="lines">${(c.lines || []).map(l => `<li>${esc(lineText(l))}</li>`).join('')}</ul>
    ${ks.map(k => `<div class="item-sub">⚠️ ${esc(COMPLAINT_KIND[k.kind] || '')}: <span class="chip ${k.stage[1]}">${esc(k.stage[0])}</span></div>`).join('')}
    ${c.out && c.out.state === 'failed' ? `<div class="actions"><button type="button" class="danger" data-drop="${esc(c.out.uid)}">امسحه</button></div>` : ''}
    ${c.invoice ? `<div class="actions"><button type="button" class="secondary" data-complain="${c.invoice.id}">⚠️ مشكلة في الطلب (ناقص / لون غلط)</button></div>` : ''}</div>`;
  };

  // ---------- الشكاوى وطلبات الاستبدال
  const COMPLAINT_KIND = { short: 'وصل ناقص', wrong_color: 'لونه غلط', damaged: 'وصل تالف', other: 'مشكلة تانية' };
  const COMPLAINT_STATE = { new: ['وصلت المصنع', 'warn'], in_progress: ['بيجهّزوا البديل', ''], done: ['خلصت', 'good'], rejected: ['اترفضت', 'bad'] };
  function complaintCards() {
    const s = st(); if (!s) return [];
    const list = s.complaints || [], out = outbox().filter(x => x.kind === 'complaint'), known = new Set(list.map(k => k.uid));
    const inbox = (data.inbox || []).filter(i => i.kind === 'complaint' && !known.has(i.uid) && !out.some(x => x.uid === i.uid));
    const docNo = id => (s.docs.find(d => Number(d.id) === Number(id)) || {}).number || '';
    const docCust = id => (s.docs.find(d => Number(d.id) === Number(id)) || {}).customer || '';
    const linesOf = (id, ls) => { const d = s.docs.find(x => Number(x.id) === Number(id)); return (ls || []).map(l => ({ item: ((d && d.lines.find(x => Number(x.line_no) === Number(l.line_no))) || {}).item || 'صنف', qty: l.qty })); };
    return [
      ...out.map(o => ({ at: o.created_at, doc_id: o.payload.doc_id, number: docNo(o.payload.doc_id), customer: docCust(o.payload.doc_id), kind: o.payload.kind, replacement: o.payload.replacement,
        stage: o.state === 'failed' ? ['مقبلش: ' + o.error, 'bad'] : ['على الموبايل — لسه متبعتش', 'gray'], lines: linesOf(o.payload.doc_id, o.payload.lines), out: o })),
      ...inbox.map(i => ({ at: i.created_at, doc_id: i.payload.doc_id, number: docNo(i.payload.doc_id), customer: docCust(i.payload.doc_id), kind: i.payload.kind, replacement: i.payload.replacement,
        stage: i.error ? ['مقبلش: ' + i.error, 'bad'] : ['اتبعت — مستني المصنع يستلمها', 'gray'], lines: linesOf(i.payload.doc_id, i.payload.lines) })),
      ...list.map(k => ({ at: k.created_at, doc_id: k.doc_id, number: k.doc_number, customer: k.customer, kind: k.kind, replacement: k.replacement, note: k.status_note,
        stage: COMPLAINT_STATE[k.status] || [k.status, ''], lines: k.lines.map(l => ({ ...l, unit: null })) })),
    ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  const complaintCardHtml = k => `<div class="item"><div class="item-head"><b>⚠️ ${esc(COMPLAINT_KIND[k.kind] || '')} — ${esc(k.customer || '')}</b><span class="chip ${k.stage[1]}">${esc(k.stage[0])}</span></div>
    <div class="item-sub">فاتورة ${esc(k.number || '')}${k.replacement ? ' — طلب استبدال' : ''} — ${esc(fmtDateTime(k.at))}</div>
    <ul class="lines">${(k.lines || []).map(l => `<li>${esc(l.item)}${l.code ? ' — ' + esc(l.code) : ''}${l.qty ? ' — ' + esc(l.qty) : ''}${esc(batchText(l))}</li>`).join('')}</ul>
    ${k.note ? `<div class="item-sub">${esc(k.note)}</div>` : ''}
    ${k.out && k.out.state === 'failed' ? `<div class="actions"><button type="button" class="danger" data-drop="${esc(k.out.uid)}">امسحه</button></div>` : ''}</div>`;
  function complaintForm(docId) {
    const s = st(), d = s.docs.find(x => Number(x.id) === Number(docId));
    if (!d) return toast('الفاتورة دي مش موجودة — حدّث الصفحة', 'bad');
    const sh = openSheet('⚠️ مشكلة في الطلب', `<div class="note">${esc(d.customer)} — فاتورة ${esc(d.number)}${d.exit_at ? ' — خرجت ' + esc(fmtDate(d.exit_at)) : ''}. المبيعات هتشوفها على طول، ولو طلبت استبدال بيتعمل أمر تصنيع للبديل.</div>
      <div class="seg" id="kpKind"><button type="button" data-k="short" class="on">ناقص</button><button type="button" data-k="wrong_color">لون غلط</button><button type="button" data-k="damaged">تالف</button><button type="button" data-k="other">حاجة تانية</button></div>
      <h3>الأصناف اللي فيها المشكلة</h3>
      <div class="list">${d.lines.map(l => `<div class="item"><label class="check-line"><input type="checkbox" data-ln="${l.line_no}"> ${esc(lineText(l))}</label>
        <input data-q="${l.line_no}" maxlength="40" placeholder="الكمية اللي فيها المشكلة (زي «5 شكاير»)" class="hidden"></div>`).join('')}</div>
      <label class="check-line mt12"><input type="checkbox" id="kpRepl" checked> عايز استبدال (البديل يتصنع ويتبعت)</label>
      <label class="mt12">اكتب المشكلة<textarea id="kpNote" maxlength="500" placeholder="مثلًا: اللون أغمق من العينة / ناقص 5 شكاير"></textarea></label>
      <label>صورة (اختياري)<input id="kpPhoto" type="file" accept="image/*"></label>
      <img id="kpPrev" class="photo-prev hidden" alt="صورة المشكلة">
      <div class="error hidden" id="kpErr"></div>
      <button type="button" class="primary big" id="kpSend">📤 ابعت للمصنع</button>`);
    const b = sh.el;
    let kind = 'short', image = null;
    $('#kpKind', b).onclick = e => { const k = e.target.closest('[data-k]'); if (!k) return; kind = k.dataset.k; $$('#kpKind button', b).forEach(x => x.classList.toggle('on', x === k)); };
    b.addEventListener('change', e => { const c = e.target.closest('[data-ln]'); if (c) $(`[data-q="${c.dataset.ln}"]`, b).classList.toggle('hidden', !c.checked); });
    $('#kpPhoto', b).onchange = async e => {
      const f = e.target.files && e.target.files[0]; image = null; $('#kpPrev', b).classList.add('hidden');
      if (!f) return;
      try { image = await shrinkImage(f); $('#kpPrev', b).src = image; $('#kpPrev', b).classList.remove('hidden'); }
      catch (ex) { showErr($('#kpErr', b), ex.message); e.target.value = ''; }
    };
    $('#kpSend', b).onclick = async e => {
      const btn = e.currentTarget, err = $('#kpErr', b); err.classList.add('hidden');
      const lines = $$('[data-ln]', b).filter(c => c.checked).map(c => ({ line_no: Number(c.dataset.ln), ...($(`[data-q="${c.dataset.ln}"]`, b).value.trim() ? { qty: $(`[data-q="${c.dataset.ln}"]`, b).value.trim() } : {}) }));
      if (!lines.length) return showErr(err, 'علّم على الأصناف اللي فيها المشكلة');
      const note = $('#kpNote', b).value.trim();
      if (kind === 'other' && !note) return showErr(err, 'اكتب المشكلة');
      const payload = { doc_id: d.id, kind, replacement: $('#kpRepl', b).checked, lines, ...(note ? { note } : {}), ...(image ? { image } : {}) };
      if (!await confirmSheet('ابعت للمصنع؟', `<div class="item"><b>⚠️ ${esc(COMPLAINT_KIND[kind])}${payload.replacement ? ' — طلب استبدال' : ''}</b><div class="item-sub">${esc(d.customer)} — فاتورة ${esc(d.number)} — ${lines.length} صنف</div></div>`, '📤 ابعت')) return;
      btn.disabled = true;
      try {
        const r = await queue('complaint', payload);
        if (r.error) return showErr(err, 'المصنع مقبلهاش: ' + r.error);
        sh.close(); render();
        toast(r === 'sent' ? '✅ اتبعتت للمصنع' : '📱 اتحفظت على الموبايل — هتتبعت لوحدها أول ما النت يرجع', r === 'sent' ? 'good' : '');
      } catch (ex) { showErr(err, ex.message); }
      finally { if (btn.isConnected) btn.disabled = false; }
    };
  }

  // ---------- العينات (مجانية)
  const SAMPLE_STATE = { new: ['وصلت المصنع', 'warn'], preparing: ['بتتجهز', ''], ready: ['✅ جاهزة', 'good'], delivered: ['اتسلّمت', 'gray'], rejected: ['اترفضت', 'bad'] };
  function sampleCards() {
    const s = st(); if (!s) return [];
    const list = s.samples || [], out = outbox().filter(x => x.kind === 'sample'), known = new Set(list.map(x => x.uid));
    const inbox = (data.inbox || []).filter(i => i.kind === 'sample' && !known.has(i.uid) && !out.some(x => x.uid === i.uid));
    const who = p => p.customer_id ? (customerById(p.customer_id) || {}).name : p.prospect_name;
    const ls = p => (p.lines || []).map(l => ({ item: productName(l.product_id), code: l.code, qty: l.qty }));
    return [
      ...out.map(o => ({ at: o.created_at, customer: who(o.payload), prospect: !o.payload.customer_id, stage: o.state === 'failed' ? ['مقبلش: ' + o.error, 'bad'] : ['على الموبايل — لسه متبعتش', 'gray'], lines: ls(o.payload), out: o })),
      ...inbox.map(i => ({ at: i.created_at, customer: who(i.payload), prospect: !i.payload.customer_id, stage: i.error ? ['مقبلش: ' + i.error, 'bad'] : ['اتبعت — مستني المصنع يستلمه', 'gray'], lines: ls(i.payload) })),
      ...list.map(x => ({ at: x.created_at, customer: x.customer, prospect: x.prospect, stage: SAMPLE_STATE[x.status] || [x.status, ''], lines: x.lines, note: x.status_note })),
    ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  const sampleCardHtml = x => `<div class="item"><div class="item-head"><b>🧪 ${esc(x.customer || '—')}${x.prospect ? ' <span class="chip gray">بيجرّب</span>' : ''}</b><span class="chip ${x.stage[1]}">${esc(x.stage[0])}</span></div>
    <div class="item-sub">${esc(fmtDateTime(x.at))}</div>
    <ul class="lines">${(x.lines || []).map(l => `<li>${esc(l.item)}${l.code ? ' — ' + esc(l.code) : ''}${l.qty ? ' — ' + esc(l.qty) : ''}</li>`).join('')}</ul>
    ${x.note ? `<div class="item-sub">${esc(x.note)}</div>` : ''}
    ${x.out && x.out.state === 'failed' ? `<div class="actions"><button type="button" class="danger" data-drop="${esc(x.out.uid)}">امسحه</button></div>` : ''}</div>`;
  function renderSamples(v) {
    const cards = sampleCards();
    v.innerHTML = `<h2>العينات</h2>
      <div class="note">العينات مجانية. اطلبها لعميل من عملاءك، أو لعميل لسه بيجرّب (اسمه بيتحفظ باسمك ومش لازم يتسجل غير لما يطلب منتج).</div>
      <button type="button" class="primary big" id="smNew">➕ طلب عينة</button>
      <h3>طلبات العينات</h3>
      <div class="list">${cards.map(sampleCardHtml).join('') || '<div class="empty">لسه مفيش طلبات عينات</div>'}</div>`;
    $('#smNew', v).onclick = () => sampleForm();
  }
  function sampleForm(pre = {}) {
    const s = st();
    const sh = openSheet('🧪 طلب عينة', `<label>العميل<select id="sfCustomer"><option value="">— اختار —</option>${s.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        <option value="new">عميل لسه بيجرّب (مش متسجل)</option></select></label>
      <div id="sfNew" class="hidden"><div class="row"><label>اسمه<input id="sfName" maxlength="120" list="sfProspects"></label><label>تليفونه<input id="sfPhone" dir="ltr" inputmode="tel" maxlength="15"></label></div></div>
      <datalist id="sfProspects">${(s.prospects || []).map(p => `<option value="${esc(p.name)}"></option>`).join('')}</datalist>
      <div id="sfLines"></div>
      <button type="button" class="secondary big" id="sfAdd">+ عينة تانية</button>
      <label class="mt12">ملاحظة (اختياري)<textarea id="sfNote" maxlength="500"></textarea></label>
      <div class="error hidden" id="sfErr"></div>
      <button type="button" class="primary big" id="sfSend">📤 ابعت طلب العينة</button>`);
    const b = sh.el, box = $('#sfLines', b);
    const prodOpts = '<option value="">— اختار الصنف —</option>' + s.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    const addLine = () => {
      const d = document.createElement('div'); d.className = 'oline';
      d.innerHTML = `<div class="oline-head"><span data-n></span><button type="button" class="x" data-del aria-label="شيل العينة">×</button></div>
        <label>الصنف<select data-f="product">${prodOpts}</select></label>
        <div class="row"><label>الكود / اللون<input data-f="code" maxlength="60"></label><label>الكمية<input data-f="qty" maxlength="40" placeholder="علبة 1 كيلو"></label></div>`;
      box.appendChild(d);
      $$('.oline', box).forEach((x, i) => { $('[data-n]', x).textContent = 'العينة ' + (i + 1); });
    };
    addLine();
    box.onclick = e => { if (e.target.closest('[data-del]') && $$('.oline', box).length > 1) { e.target.closest('.oline').remove(); $$('.oline', box).forEach((x, i) => { $('[data-n]', x).textContent = 'العينة ' + (i + 1); }); } };
    $('#sfAdd', b).onclick = () => { if ($$('.oline', box).length >= 30) return toast('الحد 30 عينة', 'bad'); addLine(); };
    const sel = $('#sfCustomer', b);
    sel.onchange = () => $('#sfNew', b).classList.toggle('hidden', sel.value !== 'new');
    $('#sfName', b).oninput = () => { const p = (s.prospects || []).find(x => x.name === $('#sfName', b).value.trim()); if (p && p.phone && !$('#sfPhone', b).value) $('#sfPhone', b).value = p.phone; };
    if (pre.customer_id) sel.value = String(pre.customer_id);
    if (pre.prospect) { sel.value = 'new'; $('#sfName', b).value = pre.prospect.name || ''; $('#sfPhone', b).value = pre.prospect.phone || ''; }
    sel.onchange();
    $('#sfSend', b).onclick = async e => {
      const btn = e.currentTarget, err = $('#sfErr', b); err.classList.add('hidden');
      const payload = { lines: [] };
      let who;
      if (!sel.value) return showErr(err, 'اختار العميل');
      if (sel.value === 'new') {
        const nm = $('#sfName', b).value.trim().replace(/\s+/g, ' '), ph = normDigits($('#sfPhone', b).value).replace(/[^0-9+]/g, '');
        if (nm.length < 2) return showErr(err, 'اكتب اسم العميل');
        if (ph && (ph.length < 7 || ph.length > 15)) return showErr(err, 'رقم التليفون مش مظبوط');
        payload.prospect_name = nm; if (ph) payload.prospect_phone = ph; who = nm + ' (بيجرّب)';
      } else { payload.customer_id = Number(sel.value); who = (customerById(sel.value) || {}).name; }
      for (const [i, d] of $$('.oline', box).entries()) {
        const pid = $('[data-f=product]', d).value;
        if (!pid) return showErr(err, `العينة ${i + 1}: اختار الصنف`);
        const code = $('[data-f=code]', d).value.trim(), q = $('[data-f=qty]', d).value.trim();
        payload.lines.push({ product_id: Number(pid), ...(code ? { code } : {}), ...(q ? { qty: q } : {}) });
      }
      const note = $('#sfNote', b).value.trim(); if (note) payload.note = note;
      if (!await confirmSheet('ابعت طلب العينة؟', `<div class="item"><b>${esc(who)}</b><ul class="lines">${payload.lines.map(l => `<li>${esc(productName(l.product_id))}${l.code ? ' — ' + esc(l.code) : ''}${l.qty ? ' — ' + esc(l.qty) : ''}</li>`).join('')}</ul></div>`, '📤 ابعت')) return;
      btn.disabled = true;
      try {
        const r = await queue('sample', payload);
        if (r.error) return showErr(err, 'المصنع مقبلش: ' + r.error);
        sh.close(); tab = 'samples'; render();
        toast(r === 'sent' ? '✅ طلب العينة اتبعت للمصنع' : '📱 اتحفظ على الموبايل — هيتبعت لوحده أول ما النت يرجع', r === 'sent' ? 'good' : '');
      } catch (ex) { showErr(err, ex.message); }
      finally { if (btn.isConnected) btn.disabled = false; }
    };
  }

  // ---------- بلاغات التحصيل
  const COL_STATE = { pending: ['مستني تأكيد الخزنة', 'warn'], confirmed: ['اتأكد', 'good'], rejected: ['مش واصل', 'bad'] };
  function collectionCards() {
    const s = st(); if (!s) return [];
    const out = outbox().filter(x => x.kind === 'collection'), known = new Set(s.collections.map(c => c.uid));
    const inbox = (data.inbox || []).filter(i => i.kind === 'collection' && !known.has(i.uid) && !out.some(x => x.uid === i.uid));
    const acc = id => (s.accounts.find(a => Number(a.id) === Number(id)) || {}).name;
    return [
      ...out.map(o => ({ at: o.created_at, customer: (customerById(o.payload.customer_id) || {}).name, amount: o.payload.amount, method: o.payload.method, account: acc(o.payload.account_id),
        stage: o.state === 'failed' ? ['مقبلش: ' + o.error, 'bad'] : ['على الموبايل — لسه متبعتش', 'gray'], out: o })),
      ...inbox.map(i => ({ at: i.created_at, customer: (customerById(i.payload.customer_id) || {}).name, amount: i.payload.amount, method: i.payload.method, account: acc(i.payload.account_id),
        stage: i.error ? ['مقبلش: ' + i.error, 'bad'] : ['اتبعت — مستني المصنع يستلمه', 'gray'] })),
      ...s.collections.map(c => ({ at: c.created_at, customer: c.customer, amount: c.amount, method: c.method, account: c.account,
        stage: c.status === 'confirmed' && c.reversed ? ['اتلغى التوريد (تصحيح من المصنع)', 'bad'] : COL_STATE[c.status] || [c.status, ''],
        extra: c.status === 'confirmed' && Number(c.confirmed_amount) !== Number(c.amount) ? 'وصل ' + money(c.confirmed_amount) : c.status === 'rejected' ? c.note : c.status === 'confirmed' && c.note ? c.note : '' })),
    ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  const collectionCardHtml = c => `<div class="item"><div class="item-head"><b>${esc(c.customer || '—')}</b><span class="chip ${c.stage[1]}">${esc(c.stage[0])}</span></div>
    <div class="item-sub">${moneyHtml(normDigits(c.amount))} — ${c.method === 'cash' ? 'نقدي معايا' : 'تحويل' + (c.account ? ' على «' + esc(c.account) + '»' : '')} — ${esc(fmtDateTime(c.at))}</div>
    ${c.extra ? `<div class="item-sub">${esc(c.extra)}</div>` : ''}
    ${c.out && c.out.state === 'failed' ? `<div class="actions"><button type="button" class="danger" data-drop="${esc(c.out.uid)}">امسحه</button></div>` : ''}</div>`;
  // النقدي اللي معايا ولسه متسلمش (عهدة)
  const cashWithMe = () => collectionCards().filter(c => c.method === 'cash' && !/مقبلش|اتأكد|مش واصل/.test(c.stage[0])).reduce((s, c) => s + Number(normDigits(c.amount)), 0);

  // ---------- الشاشات
  function render() {
    paintHeader();
    const v = $('#view');
    if (!data) { v.innerHTML = '<div class="empty">⏳ بيحمّل…</div>'; return; }
    if (!st()) { v.innerHTML = '<div class="note bad">حسابك متوقف من المصنع أو لسه متجهزش — كلّم المصنع.</div>'; return; }
    v.onclick = null;                    // (كل شاشة بتحط بتاعتها)
    ({ home: renderHome, order: renderOrder, samples: renderSamples, customers: renderCustomers, prices: renderPrices, month: renderMonth })[tab](v);
  }
  // (الطلب اللي بيتكتب بيفضل محفوظ لو راح يبص على الأسعار ورجع — لحد ما يتبعت أو «ابدأ من جديد»)
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
  $('#refreshBtn').addEventListener('click', async () => { const b = $('#refreshBtn'); b.disabled = true; try { await sendOutbox(); await loadState(); toast(online ? '✅ اتحدّث' : '📵 مفيش نت'); } finally { b.disabled = false; } });
  // (الأزرار اللي جوه الكروت — في الصفحة نفسها وفي الشيت اللي بيطلع من تحت)
  async function cardClick(e) {
    const d = e.target.closest('[data-drop]');
    if (d) { if (await confirmSheet('مسح', 'تمسح الحاجة دي من الموبايل؟ (مبتتبعتش)', 'امسح', 'danger')) { dropOut(d.dataset.drop); render(); } return; }
    const k = e.target.closest('[data-complain]');
    if (k) complaintForm(Number(k.dataset.complain));
  }
  $('#view').addEventListener('click', cardClick);
  $('#sheetRoot').addEventListener('click', e => { if (e.target.closest('[data-drop], [data-complain]')) cardClick(e); });

  function renderHome(v) {
    const s = st(), orders = orderCards(), cols = collectionCards(), ks = complaintCards();
    const debt = s.customers.reduce((t, c) => t + Math.max(0, Number(c.balance)), 0);
    const waiting = orders.filter(c => !['good', 'bad'].includes(c.stage[1])).length;      // (لسه مخرجتش ومش ملغية)
    const ready = (s.samples || []).filter(x => x.status === 'ready').length;
    const openKs = ks.filter(k => !['good', 'bad'].includes(k.stage[1]));
    v.innerHTML = `${ready ? `<button type="button" class="note good big-note" data-go="samples">🧪 فيه ${ready} طلب عينات جاهز — اضغط هنا</button>` : ''}
      <div class="cards">
        <div class="card"><small>عملائي</small><strong>${s.customers.length}</strong></div>
        <div class="card"><small>مديونية عملائي</small><strong>${moneyHtml(debt)}</strong></div>
        <div class="card${cashWithMe() ? ' warn' : ''}"><small>نقدي معايا لسه متسلمش</small><strong>${moneyHtml(cashWithMe())}</strong></div>
        <div class="card"><small>طلبات لسه مخرجتش</small><strong>${waiting}</strong></div>
      </div>
      <div class="actions top0"><button type="button" class="primary" data-go="order">➕ طلب جديد</button><button type="button" class="good" data-col>💵 بلّغ عن تحصيل</button></div>
      <h3>طلباتي وطلبات عملائي</h3>
      <div class="list">${orders.slice(0, 20).map(orderCardHtml).join('') || '<div class="empty">لسه مفيش طلبات</div>'}</div>
      ${ks.length ? `<h3>الشكاوى وطلبات الاستبدال${openKs.length ? ` (${openKs.length} مفتوحة)` : ''}</h3><div class="list">${ks.slice(0, 10).map(complaintCardHtml).join('')}</div>` : ''}
      <h3>بلاغات التحصيل</h3>
      <div class="list">${cols.slice(0, 15).map(collectionCardHtml).join('') || '<div class="empty">لسه مفيش بلاغات</div>'}</div>`;
    $$('[data-go]', v).forEach(b => { b.onclick = () => { tab = b.dataset.go; render(); window.scrollTo(0, 0); }; });
    $('[data-col]', v).onclick = () => collectionForm(null);
  }

  // ---------- طلب جديد
  function renderOrder(v) {
    const s = st();
    const d = orderDraft || { customer: '', lines: [{}], note: '' };
    v.innerHTML = `<h2>طلب جديد</h2>
      <div class="note">الطلب بيوصل للمبيعات في المصنع يراجعوه ويحولوه لعرض سعر أو فاتورة. الأسعار تحت تقريبية من قائمة الأسعار — السعر النهائي من المصنع.</div>
      <label>العميل<select id="ofCustomer"><option value="">— اختار العميل —</option>
        ${s.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}<option value="new">+ عميل جديد</option></select></label>
      <div id="ofNew" class="hidden"><div class="row"><label>اسم العميل الجديد<input id="ofNewName" maxlength="120" list="ofProspects"></label><label>تليفونه<input id="ofNewPhone" dir="ltr" inputmode="tel" maxlength="15"></label></div></div>
      <datalist id="ofProspects">${(s.prospects || []).map(p => `<option value="${esc(p.name)}"></option>`).join('')}</datalist>
      <datalist id="pkTypes"><option value="شكارة"></option><option value="بستلة"></option><option value="جالون"></option><option value="برميل"></option><option value="كرتونة"></option></datalist>
      <div id="ofLines"></div>
      <button type="button" class="secondary big" id="ofAdd">+ صنف تاني</button>
      <label class="mt12">ملاحظات للمصنع (اختياري)<textarea id="ofNote" maxlength="500"></textarea></label>
      <div class="total"><span>تقريبًا (حسب القائمة)</span><b id="ofTotal">—</b></div>
      <div class="error hidden" id="ofErr"></div>
      <button type="button" class="primary big" id="ofSend">📤 ابعت الطلب</button>
      <button type="button" class="link mt12" id="ofReset">🗑️ ابدأ من جديد</button>`;
    const box = $('#ofLines', v);
    const products = s.products;
    const prodOpts = sel => '<option value="">— اختار الصنف —</option>' + products.map(p => `<option value="${p.id}"${Number(p.id) === Number(sel) ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const prodOf = div => products.find(p => Number(p.id) === Number($('[data-f=product]', div).value));
    const paintLine = div => {
      const p = prodOf(div), unit = div.dataset.unit || 'ton';
      $$('.seg button', div).forEach(b => b.classList.toggle('on', b.dataset.u === unit));
      $('[data-box=ton]', div).classList.toggle('hidden', unit !== 'ton');
      $('[data-box=package]', div).classList.toggle('hidden', unit !== 'package');
      // (الصنف اتغير ← العبوة بترجع لأول عبوة في قائمة أسعاره)
      const pid = p ? String(p.id) : '', same = div.dataset.pid === pid;
      div.dataset.pid = pid;
      const pk = $('[data-f=pk]', div), cur = same ? pk.value : '';
      const list = p ? p.packages : [];
      pk.innerHTML = list.map((x, i) => `<option value="${i}">${esc(x.type)} ${qty(x.weight)} كجم — ${esc(money(x.price))}</option>`).join('') + '<option value="other">عبوة تانية…</option>';
      pk.value = [...pk.options].some(o => o.value === cur) ? cur : (list.length ? '0' : 'other');
      $('[data-other]', div).classList.toggle('hidden', pk.value !== 'other');
      $('[data-hint]', div).textContent = p ? (unit === 'ton' ? (p.ton ? `سعر الطن في القائمة: ${money(p.ton.price)}` : 'سعر الطن من المصنع') : '') : '';
    };
    const addLine = (l = {}) => {
      const div = document.createElement('div');
      div.className = 'oline'; div.dataset.unit = l.unit || 'ton';
      div.innerHTML = `<div class="oline-head"><span data-n></span><button type="button" class="x" data-del aria-label="شيل الصنف">×</button></div>
        <label>الصنف<select data-f="product">${prodOpts(l.product_id)}</select></label>
        <div class="seg"><button type="button" data-u="ton">بالطن</button><button type="button" data-u="package">بالعبوة</button></div>
        <div data-box="ton"><label>الكمية (طن)<input data-f="tons" inputmode="decimal" dir="ltr" value="${esc(l.tons || '')}" placeholder="مثلًا 1.5"></label></div>
        <div data-box="package"><div class="row"><label>العبوة<select data-f="pk"></select></label><label class="narrow w-count">العدد<input data-f="count" inputmode="numeric" dir="ltr" value="${esc(l.count || '')}"></label></div>
          <div class="row hidden" data-other><label>نوع العبوة<input data-f="ptype" list="pkTypes" maxlength="30" value="${esc(l.ptype || '')}"></label><label>الوزن (كجم)<input data-f="weight" inputmode="decimal" dir="ltr" value="${esc(l.weight || '')}"></label></div></div>
        <label>الكود / اللون (اختياري)<input data-f="code" maxlength="60" value="${esc(l.code || '')}"></label>
        <div class="hint" data-hint></div>`;
      box.appendChild(div);
      paintLine(div);
      if (l.pk != null && [...$('[data-f=pk]', div).options].some(o => o.value === String(l.pk))) { $('[data-f=pk]', div).value = String(l.pk); paintLine(div); }
      number();
    };
    const number = () => $$('.oline', box).forEach((d, i) => { $('[data-n]', d).textContent = 'الصنف ' + (i + 1); });
    // سطر ← { ok, line (للإرسال), est (قرش أو null), bad }
    const readLine = div => {
      const p = prodOf(div), unit = div.dataset.unit;
      if (!p) return { bad: 'اختار الصنف' };
      const code = $('[data-f=code]', div).value.trim();
      if (unit === 'ton') {
        const t = parseScaled($('[data-f=tons]', div).value, 6);
        if (t == null || t <= 0n) return { bad: 'اكتب الكمية بالطن' };
        const kg = scaledToString(t, 3);                                       // طن بـ6 كسور = كيلو بـ3
        const price = p.ton ? parseScaled(String(p.ton.price), 2) : null;
        return { line: { product_id: p.id, unit: 'ton', quantity_kg: kg, ...(code ? { code } : {}) }, est: price != null ? (t * price + 500000n) / 1000000n : null };
      }
      const cnt = parseScaled($('[data-f=count]', div).value, 0);
      if (cnt == null || cnt <= 0n) return { bad: 'اكتب عدد العبوات' };
      const pk = $('[data-f=pk]', div).value;
      if (pk !== 'other') {
        const x = p.packages[Number(pk)];
        return { line: { product_id: p.id, unit: 'package', package_type: x.type, weight: String(Number(x.weight)), count: cnt.toString(), ...(code ? { code } : {}) }, est: cnt * parseScaled(String(x.price), 2) };
      }
      const tp = $('[data-f=ptype]', div).value.trim(), w = parseScaled($('[data-f=weight]', div).value, 3);
      if (!tp) return { bad: 'اكتب نوع العبوة' };
      if (w == null || w <= 0n) return { bad: 'اكتب وزن العبوة' };
      return { line: { product_id: p.id, unit: 'package', package_type: tp, weight: scaledToString(w, 3), count: cnt.toString(), ...(code ? { code } : {}) }, est: null };
    };
    const recalc = () => {
      let total = 0n, any = false, unknown = false;
      for (const div of $$('.oline', box)) { const r = readLine(div); if (r.est != null) { total += r.est; any = true; } else if (!r.bad) unknown = true; }
      $('#ofTotal', v).textContent = any ? money(scaledToString(total, 2)) + (unknown ? ' + أصناف سعرها من المصنع' : '') : '—';
      orderDraft = snapshot();
    };
    const snapshot = () => ({ customer: $('#ofCustomer', v).value, newName: $('#ofNewName', v).value, newPhone: $('#ofNewPhone', v).value, note: $('#ofNote', v).value,
      lines: $$('.oline', box).map(div => ({ product_id: $('[data-f=product]', div).value, unit: div.dataset.unit, tons: $('[data-f=tons]', div).value, pk: $('[data-f=pk]', div).value,
        count: $('[data-f=count]', div).value, ptype: $('[data-f=ptype]', div).value, weight: $('[data-f=weight]', div).value, code: $('[data-f=code]', div).value })) });
    box.addEventListener('click', e => {
      const div = e.target.closest('.oline'); if (!div) return;
      const u = e.target.closest('[data-u]'); if (u) { div.dataset.unit = u.dataset.u; paintLine(div); recalc(); return; }
      if (e.target.closest('[data-del]')) { if ($$('.oline', box).length > 1) div.remove(); number(); recalc(); }
    });
    box.addEventListener('change', e => { const div = e.target.closest('.oline'); if (div && e.target.matches('[data-f=product], [data-f=pk]')) paintLine(div); recalc(); });
    box.addEventListener('input', recalc);
    $('#ofCustomer', v).addEventListener('change', () => { $('#ofNew', v).classList.toggle('hidden', $('#ofCustomer', v).value !== 'new'); recalc(); });
    ['#ofNote', '#ofNewName', '#ofNewPhone'].forEach(s2 => $(s2, v).addEventListener('input', recalc));
    // (عميل بيجرّب من العينات ← تليفونه بيتكتب لوحده)
    $('#ofNewName', v).addEventListener('input', () => { const p = (s.prospects || []).find(x => x.name === $('#ofNewName', v).value.trim()); if (p && p.phone && !$('#ofNewPhone', v).value) { $('#ofNewPhone', v).value = p.phone; recalc(); } });
    $('#ofAdd', v).addEventListener('click', () => { if ($$('.oline', box).length >= 50) return toast('الحد 50 صنف', 'bad'); addLine(); recalc(); });
    // (لو رجع للطلب اللي كان بيكتبه)
    $('#ofCustomer', v).value = [...$('#ofCustomer', v).options].some(o => o.value === String(d.customer)) ? String(d.customer) : '';
    $('#ofNew', v).classList.toggle('hidden', $('#ofCustomer', v).value !== 'new');
    $('#ofNewName', v).value = d.newName || ''; $('#ofNewPhone', v).value = d.newPhone || ''; $('#ofNote', v).value = d.note || '';
    (d.lines && d.lines.length ? d.lines : [{}]).forEach(addLine);
    recalc();
    $('#ofReset', v).onclick = async () => { if (await confirmSheet('ابدأ من جديد', 'تمسح الطلب اللي بتكتبه؟', 'امسح', 'danger')) { orderDraft = null; renderOrder(v); } };

    $('#ofSend', v).addEventListener('click', async e => {
      const btn = e.currentTarget;                                     // (بعد أي await بيبقى null)
      const err = $('#ofErr', v); err.classList.add('hidden');
      const cv = $('#ofCustomer', v).value;
      if (!cv) return showErr(err, 'اختار العميل');
      const payload = { lines: [] };
      let who;
      if (cv === 'new') {
        const nm = $('#ofNewName', v).value.trim().replace(/\s+/g, ' '), ph = normDigits($('#ofNewPhone', v).value).replace(/[^0-9+]/g, '');
        if (nm.length < 2) return showErr(err, 'اكتب اسم العميل الجديد');
        if (ph && (ph.length < 7 || ph.length > 15)) return showErr(err, 'رقم تليفون العميل مش مظبوط');
        payload.new_customer_name = nm; if (ph) payload.new_customer_phone = ph; who = nm + ' (عميل جديد)';
      } else { payload.customer_id = Number(cv); who = (customerById(cv) || {}).name; }
      const rows = $$('.oline', box).map(readLine);
      const bad = rows.findIndex(r => r.bad);
      if (bad >= 0) return showErr(err, `الصنف ${bad + 1}: ${rows[bad].bad}`);
      payload.lines = rows.map(r => r.line);
      const note = $('#ofNote', v).value.trim(); if (note) payload.note = note;
      if (!await confirmSheet('ابعت الطلب؟', `<div class="item"><div class="item-head"><b>${esc(who)}</b></div><ul class="lines">${payload.lines.map(l => `<li>${esc(lineText({ ...l, kg: l.quantity_kg }))}</li>`).join('')}</ul>${note ? `<div class="item-sub">${esc(note)}</div>` : ''}</div>`, '📤 ابعت')) return;
      btn.disabled = true;
      try {
        const r = await queue('order', payload);
        if (r.error) return showErr(err, 'المصنع مقبلش الطلب: ' + r.error);
        orderDraft = null; tab = 'home'; render();
        toast(r === 'sent' ? '✅ الطلب اتبعت للمصنع' : '📱 الطلب اتحفظ على الموبايل — هيتبعت لوحده أول ما النت يرجع', r === 'sent' ? 'good' : '');
      } catch (ex) { showErr(err, ex.message); }
      finally { if (btn.isConnected) btn.disabled = false; }
    });
  }

  // ---------- بلاغ تحصيل
  function collectionForm(customerId) {
    const s = st();
    const accounts = s.accounts || [];
    const sh = openSheet('💵 بلاغ تحصيل', `<div class="note">بلّغ بالفلوس اللي حصّلتها. الخزنة بتأكد لما الفلوس توصل فعلًا، وساعتها بس مديونية العميل بتنزل.</div>
      <label>العميل<select id="cfCustomer"><option value="">— اختار العميل —</option>${s.customers.map(c => `<option value="${c.id}"${Number(c.id) === Number(customerId) ? ' selected' : ''}>${esc(c.name)} — عليه ${esc(money(c.balance))}</option>`).join('')}</select></label>
      <label>المبلغ (ج.م)<input id="cfAmount" inputmode="decimal" dir="ltr"></label>
      <div class="seg" id="cfMethod"><button type="button" data-m="cash" class="on">نقدي (معايا)</button><button type="button" data-m="transfer">تحويل</button></div>
      <div id="cfTransfer" class="hidden">
        ${accounts.length ? `<label>حوّل على<select id="cfAccount"><option value="">— اختار الحساب —</option>${accounts.map(a => `<option value="${a.id}">${esc(a.name)} — ${esc(a.number || '')}</option>`).join('')}</select></label>` : '<div class="note warn">مفيش حسابات للتحويل متسجلة — كلّم المصنع.</div>'}
        <label>رقم العملية (اختياري)<input id="cfRef" dir="ltr" maxlength="100"></label>
        <label>صورة التحويل (اختياري)<input id="cfPhoto" type="file" accept="image/*"></label>
        <img id="cfPrev" class="photo-prev hidden" alt="صورة التحويل">
      </div>
      <label>ملاحظة (اختياري)<input id="cfNote" maxlength="300"></label>
      <div class="error hidden" id="cfErr"></div>
      <button type="button" class="good big" id="cfSend">📤 ابعت البلاغ</button>`);
    const b = sh.el;
    let method = 'cash', image = null;
    $('#cfMethod', b).onclick = e => { const m = e.target.closest('[data-m]'); if (!m) return; method = m.dataset.m; $$('#cfMethod button', b).forEach(x => x.classList.toggle('on', x === m)); $('#cfTransfer', b).classList.toggle('hidden', method !== 'transfer'); };
    if ($('#cfPhoto', b)) $('#cfPhoto', b).onchange = async e => {
      const f = e.target.files && e.target.files[0]; image = null; $('#cfPrev', b).classList.add('hidden');
      if (!f) return;
      try { image = await shrinkImage(f); $('#cfPrev', b).src = image; $('#cfPrev', b).classList.remove('hidden'); }
      catch (ex) { showErr($('#cfErr', b), ex.message); e.target.value = ''; }
    };
    $('#cfSend', b).onclick = async e => {
      const btn = e.currentTarget;
      const err = $('#cfErr', b); err.classList.add('hidden');
      const cid = $('#cfCustomer', b).value, amt = parseScaled($('#cfAmount', b).value, 2);
      if (!cid) return showErr(err, 'اختار العميل');
      if (amt == null || amt <= 0n) return showErr(err, 'اكتب المبلغ (لحد قرشين)');
      const payload = { customer_id: Number(cid), amount: scaledToString(amt, 2), method };
      if (method === 'transfer') {
        const acc = $('#cfAccount', b) ? $('#cfAccount', b).value : '';
        if (!acc) return showErr(err, 'اختار الحساب اللي العميل حوّل عليه');
        payload.account_id = Number(acc);
        const ref = $('#cfRef', b).value.trim(); if (ref) payload.reference = ref;
        if (image) payload.image = image;
      }
      const note = $('#cfNote', b).value.trim(); if (note) payload.note = note;
      const c = customerById(cid);
      if (!await confirmSheet('ابعت البلاغ؟', `<div class="item"><b>${esc(c ? c.name : '')}</b><div class="item-sub">${moneyHtml(payload.amount)} — ${method === 'cash' ? 'نقدي معايا' : 'تحويل'}</div></div>`, '📤 ابعت', 'good')) return;
      btn.disabled = true;
      try {
        const r = await queue('collection', payload);
        if (r.error) return showErr(err, 'المصنع مقبلش البلاغ: ' + r.error);
        sh.close(); tab = 'home'; render();
        toast(r === 'sent' ? '✅ البلاغ اتبعت — مستني تأكيد الخزنة' : '📱 البلاغ اتحفظ على الموبايل — هيتبعت لوحده أول ما النت يرجع', r === 'sent' ? 'good' : '');
      } catch (ex) { showErr(err, ex.message); }
      finally { if (btn.isConnected) btn.disabled = false; }
    };
  }
  async function shrinkImage(file) {
    if (!/^image\//.test(file.type || 'image/')) throw new Error('اختار صورة');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('الصورة مش بتتفتح')); i.src = url; });
      const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.72, 0.6, 0.45, 0.32]) { const d = c.toDataURL('image/jpeg', q); if (d.length <= 1400000) return d; }
      throw new Error('الصورة كبيرة قوي — صوّر تاني');
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------- العملاء
  function renderCustomers(v) {
    const s = st();
    const prospects = s.prospects || [];
    v.innerHTML = `<h2>عملائي (${s.customers.length})</h2>
      <input type="search" class="search" id="cuSearch" placeholder="🔍 بحث باسم العميل">
      <div class="list" id="cuList"></div>
      ${prospects.length ? `<h3>عملاء بيجرّبوا (طلبوا عينات ولسه مش متسجلين — محفوظين باسمك)</h3>
        <div class="list">${prospects.map((p, i) => `<div class="item"><div class="item-head"><b>${esc(p.name)}</b><span class="chip gray">بيجرّب</span></div>
          <div class="item-sub">${p.phone ? `<span class="num">${esc(p.phone)}</span> — ` : ''}آخر عينة ${esc(fmtDate(p.last_at))}</div>
          <div class="actions"><button type="button" class="secondary" data-ps-sample="${i}">🧪 عينة تانية</button><button type="button" class="primary" data-ps-order="${i}">➕ طلب منتج</button></div></div>`).join('')}</div>` : ''}`;
    v.onclick = e => {
      const a = e.target.closest('[data-ps-sample]'); if (a) return sampleForm({ prospect: prospects[Number(a.dataset.psSample)] });
      const o = e.target.closest('[data-ps-order]');
      if (o) { const p = prospects[Number(o.dataset.psOrder)]; orderDraft = { customer: 'new', newName: p.name, newPhone: p.phone || '', lines: [{}] }; tab = 'order'; render(); }
    };
    const paint = () => {
      const q = $('#cuSearch', v).value.trim().toLowerCase();
      const list = s.customers.filter(c => !q || c.name.toLowerCase().includes(q));
      $('#cuList', v).innerHTML = list.map(c => `<button type="button" class="item" data-cu="${c.id}"><div class="item-head"><b>${esc(c.name)}</b>${balanceHtml(c.balance)}</div>
        ${Number(c.pending) ? `<div class="item-sub">⏳ مبلّغ عنه ومستني الخزنة: ${moneyHtml(c.pending)}</div>` : ''}</button>`).join('') || '<div class="empty">مفيش عملاء</div>';
    };
    paint();
    $('#cuSearch', v).addEventListener('input', paint);
    $('#cuList', v).addEventListener('click', e => { const b = e.target.closest('[data-cu]'); if (b) customerSheet(Number(b.dataset.cu)); });
  }
  const balanceHtml = n => Number(n) > 0.004 ? `<span class="chip bad">عليه ${esc(money(n))}</span>` : Number(n) < -0.004 ? `<span class="chip good">ليه ${esc(money(-n))}</span>` : '<span class="chip gray">خالص</span>';
  function customerSheet(id) {
    const c = customerById(id); if (!c) return;
    const phone = String(c.phone || '').replace(/[^0-9]/g, '');
    const wa = phone ? 'https://wa.me/' + (phone.startsWith('0') ? '2' + phone : phone) : '';
    const orders = orderCards().filter(o => o.customer === c.name).slice(0, 10), cols = collectionCards().filter(x => x.customer === c.name).slice(0, 10);
    const sh = openSheet(c.name, `<div class="cards pair">
        <div class="card"><small>الرصيد</small><strong>${balanceHtml(c.balance)}</strong></div>
        <div class="card"><small>مبلّغ عنه ومستني الخزنة</small><strong>${moneyHtml(c.pending)}</strong></div></div>
      ${c.address ? `<div class="item-sub">📍 ${esc(c.address)}</div>` : ''}
      ${phone ? `<div class="actions"><a class="btn-link" href="tel:${esc(phone)}">📞 اتصال</a><a class="btn-link wa" href="${esc(wa)}" target="_blank" rel="noopener">واتساب</a></div>` : ''}
      <div class="actions"><button type="button" class="primary" data-act="order">➕ طلب للعميل ده</button><button type="button" class="good" data-act="col">💵 بلّغ عن تحصيل</button></div>
      <h3>طلباته</h3><div class="list">${orders.map(orderCardHtml).join('') || '<div class="empty">مفيش طلبات قريبة</div>'}</div>
      <h3>بلاغات التحصيل</h3><div class="list">${cols.map(collectionCardHtml).join('') || '<div class="empty">مفيش بلاغات</div>'}</div>`);
    $('[data-act="order"]', sh.el).onclick = () => { sh.close(); orderDraft = { customer: String(id), lines: [{}] }; tab = 'order'; render(); };
    $('[data-act="col"]', sh.el).onclick = () => { sh.close(); collectionForm(id); };
  }

  // ---------- الأسعار
  function renderPrices(v) {
    const s = st();
    const recent = t => t && Date.now() - Date.parse(t) < 14 * 864e5;
    v.innerHTML = `<h2>قائمة الأسعار</h2><div class="note">أسعار المصنع دلوقتي. «اتغير» = السعر اتغير في آخر أسبوعين.</div>
      <input type="search" class="search" id="prSearch" placeholder="🔍 بحث باسم الصنف"><div class="list" id="prList"></div>`;
    const paint = () => {
      const q = $('#prSearch', v).value.trim().toLowerCase();
      $('#prList', v).innerHTML = s.products.filter(p => !q || p.name.toLowerCase().includes(q)).map(p => {
        const ch = x => x && recent(x.at) && x.old != null && Number(x.old) !== Number(x.price) ? ` <span class="chip warn">اتغير — كان ${esc(money(x.old))}</span>` : '';
        return `<div class="item"><div class="item-head"><b>${esc(p.name)}</b></div>
          ${p.ton ? `<div class="price-line"><span>الطن${ch(p.ton)}</span><b>${moneyHtml(p.ton.price)}</b></div>` : ''}
          ${p.packages.map(x => `<div class="price-line"><span>${esc(x.type)} ${qty(x.weight)} كجم${ch(x)}</span><b>${moneyHtml(x.price)}</b></div>`).join('')}
          ${!p.ton && !p.packages.length ? '<div class="item-sub">السعر من المصنع</div>' : ''}</div>`;
      }).join('') || '<div class="empty">مفيش أصناف</div>';
    };
    paint();
    $('#prSearch', v).addEventListener('input', paint);
  }

  // ---------- الكشف الشهري: الكمية اللي خرجت لعملائي وعددهم
  let monthIdx = 0;
  function renderMonth(v) {
    const ms = st().months || [];
    if (!ms.length) { v.innerHTML = '<div class="empty">مفيش بيانات</div>'; return; }
    monthIdx = Math.min(monthIdx, ms.length - 1);
    const m = ms[monthIdx];
    v.innerHTML = `<h2>كشف الشهر</h2>
      <label>الشهر<select id="mnSel">${ms.map((x, i) => `<option value="${i}"${i === monthIdx ? ' selected' : ''}>${esc(monthName(x.month))}</option>`).join('')}</select></label>
      <div class="cards pair"><div class="card"><small>الكمية اللي خرجت لعملائي</small><strong>${esc(tons(m.kg))}</strong></div><div class="card"><small>عدد العملاء</small><strong>${esc(m.customers)}</strong></div></div>
      <div class="note">دي الكميات اللي خرجت من المصنع لعملائك في الشهر ده (بأذون الخروج). الحساب مع مدير الحسابات أول كل شهر على نفس الأرقام دي.</div>
      <div class="list">${(m.by_customer || []).map(x => `<div class="item"><div class="item-head"><b>${esc(x.name)}</b><span class="chip">${esc(tons(x.kg))}</span></div></div>`).join('') || '<div class="empty">مفيش حاجة خرجت الشهر ده</div>'}</div>`;
    $('#mnSel', v).onchange = e => { monthIdx = Number(e.target.value); renderMonth(v); };
  }

  // ---------- البداية
  (async () => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (_) {}
    if (!session) return showLogin();
    user = session.user;
    startApp();
  })();
})();
