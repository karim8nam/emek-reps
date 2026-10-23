// صفحة التصنيع — التشغيل: لو الحساب لسه داخل على الكمبيوتر ده بيفتح على طول (وباسورد الفتح لو متفعّل)، غير كده شاشة الدخول.
(async () => {
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session && data.session.user) { F.user = data.session.user; return startApp(false); }
  } catch (_) {}
  showLogin();
})();
// (الصفحة نفسها بتفتح من غير نت: آخر نسخة اتفتحت — نفس sw.js بتاع صفحة المناديب)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('online',() => { if (F.user) { sendOutbox(); loadState(true); } });
window.addEventListener('offline', () => setOnline(false));
// (قبل ما الصفحة تتقفل: لو فيه عمليات لسه متبعتتش)
window.addEventListener('beforeunload', e => { if (F.user && outbox().some(x => x.state !== 'failed')) { e.preventDefault(); e.returnValue = ''; } });
