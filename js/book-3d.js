/**
 * KOMIK.ID - Buku 3D Login
 * Sampul (1 halaman) -> klik -> terbuka jadi 2 halaman.
 * Kiri = kata-kata, kanan = Masuk / Buat Akun / Lupa Sandi / Google.
 * Akun disimpan di localStorage (simulasi untuk tugas; belum ada server asli).
 */

const Accounts = {
  KEY: 'komikid_accounts_v1',
  all() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
  save(list) { try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) {} },
  hash(s) { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h >>> 0) + ':' + s.length; },
  byLogin(id) {
    id = id.trim().toLowerCase();
    return this.all().find(a => a.username.toLowerCase() === id || (a.email && a.email.toLowerCase() === id));
  },
  byEmail(email) {
    email = email.trim().toLowerCase();
    return this.all().find(a => a.email && a.email.toLowerCase() === email);
  }
};

const Book3DEngine = {
  bookEl: null, sceneEl: null, modalEl: null, frontCoverEl: null, audioCtx: null,
  _reset: null, _switching: false, _mascotTimer: null,
  EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  init() {
    this.bookEl = document.getElementById('book3d');
    this.sceneEl = document.getElementById('book3dScene');
    this.modalEl = document.getElementById('loginModal');
    this.frontCoverEl = document.getElementById('bookFrontCover');
    const mascot = document.getElementById('loginMascot');
    const rightPage = this.bookEl?.querySelector('.book-page-right');
    if (mascot && rightPage) this.bookEl.insertBefore(mascot, rightPage);
    this.bindCover();
    this.bindAuth();
  },

  /* ---------- Suara kertas ---------- */
  playPageTurnSound() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const ctx = this.audioCtx, size = ctx.sampleRate * 0.35;
      const buf = ctx.createBuffer(1, size, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / size) * 0.6;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(500, ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.3);
      const g = ctx.createGain(); g.gain.value = 0.07;
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    } catch (e) { /* audio opsional */ }
  },

  /* ---------- Sampul / buku ---------- */
  bindCover() {
    if (!this.frontCoverEl) return;
    const open = () => { if (!this.bookEl.classList.contains('book-opened')) this.openBook(); };
    this.frontCoverEl.addEventListener('click', open);
    this.frontCoverEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  },

  // Tampilkan buku TERTUTUP (hanya sampul)
  showCover() {
    if (!this.bookEl) return;
    clearTimeout(this._mascotTimer);
    this.bookEl.classList.remove('mascot-ready');
    this.bookEl.classList.remove('book-opened');
    this.sceneEl.classList.remove('arriving');
    void this.sceneEl.offsetWidth;
    this.sceneEl.classList.add('arriving');
    this.switchView('login', true);
    document.querySelectorAll('.auth-view input').forEach(i => { i.value = ''; });
    document.querySelectorAll('.auth-error').forEach(p => { p.textContent = ''; });
    const btnClose = document.getElementById('btnCloseLoginModal');
    if (btnClose) btnClose.hidden = !StorageManager.getUser().isLoggedIn;
  },

  openBook() {
    if (!this.bookEl) return;
    clearTimeout(this._mascotTimer);
    this.bookEl.classList.remove('mascot-ready');
    this.playPageTurnSound();
    this.bookEl.classList.add('book-opened');
    // Beri jeda setelah sampul bergerak, lalu tangan naik dahulu sebelum kepala.
    this._mascotTimer = setTimeout(() => {
      if (this.bookEl?.classList.contains('book-opened')) this.bookEl.classList.add('mascot-ready');
    }, 1250);
    // fokus ke kolom pertama setelah buku terbuka
    setTimeout(() => document.getElementById('loginId')?.focus({ preventScroll: true }), 1300);
  },

  closeBook() {
    clearTimeout(this._mascotTimer);
    this.bookEl?.classList.remove('mascot-ready');
    this.playPageTurnSound();
    this.bookEl?.classList.remove('book-opened');
    setTimeout(() => {
      this.modalEl?.classList.remove('active');
      document.body.style.overflow = '';
    }, 950);
  },

  /* ---------- Pindah tampilan (login / daftar / lupa / google) ---------- */
  switchView(name, instant) {
    const map = { login: 'viewLogin', register: 'viewRegister', forgot: 'viewForgot', reset: 'viewReset', google: 'viewGoogle' };
    const next = document.getElementById(map[name]);
    const cur = document.querySelector('.auth-view.active');
    if (!next || next === cur) return;
    if (instant || !cur) {
      document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active', 'leaving'));
      next.classList.add('active');
      return;
    }
    if (this._switching) return;
    this._switching = true;
    cur.classList.add('leaving');
    setTimeout(() => {
      cur.classList.remove('active', 'leaving');
      next.classList.add('active');
      this._switching = false;
      next.querySelector('input')?.focus({ preventScroll: true });
    }, 170);
  },

  err(id, msg) { const p = document.getElementById(id); if (p) p.textContent = msg || ''; },

  /* ---------- Semua form auth ---------- */
  bindAuth() {
    // tombol/tautan pindah tampilan
    document.querySelectorAll('[data-go]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); this.switchView(el.dataset.go); });
    });
    // lihat/sembunyikan sandi
    document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = btn.parentElement.querySelector('input');
        if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    });
    // hapus pesan error saat mengetik
    document.querySelectorAll('.auth-view input').forEach(i => {
      i.addEventListener('input', () => i.closest('.auth-view').querySelector('.auth-error').textContent = '');
    });

    const $ = (id) => document.getElementById(id);

    // MASUK
    $('loginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('loginId').value.trim(), pw = $('loginPass').value;
      if (!id || !pw) return this.err('loginError', 'Isi username/email dan kata sandi dulu.');
      const acc = Accounts.byLogin(id);
      if (!acc) return this.err('loginError', 'Akun tidak ditemukan. Buat akun dulu ya.');
      if (acc.pass !== Accounts.hash(pw)) return this.err('loginError', 'Kata sandi salah.');
      this.completeLogin(acc.username, acc.email, `Selamat datang kembali, ${acc.username}!`);
    });

    // BUAT AKUN (username + sandi; email opsional)
    $('registerForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = $('regUsername').value.trim(), pw = $('regPass').value, em = $('regEmail').value.trim();
      if (!/^[A-Za-z0-9_.]{3,20}$/.test(u)) return this.err('regError', 'Username 3-20 karakter: huruf, angka, _ atau .');
      if (pw.length < 6) return this.err('regError', 'Kata sandi minimal 6 karakter.');
      if (em && !this.EMAIL_RE.test(em)) return this.err('regError', 'Format email belum benar.');
      if (Accounts.byLogin(u)) return this.err('regError', 'Username sudah dipakai.');
      if (em && Accounts.byEmail(em)) return this.err('regError', 'Email sudah terdaftar.');
      const list = Accounts.all();
      list.push({ username: u, email: em || '', pass: Accounts.hash(pw) });
      Accounts.save(list);
      this.completeLogin(u, em, `Selamat bergabung di KOMIK.ID, ${u}!`);
    });

    // LUPA SANDI -> kirim kode ke email
    $('forgotForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const em = $('forgotEmail').value.trim();
      if (!this.EMAIL_RE.test(em)) return this.err('forgotError', 'Masukkan email yang valid.');
      const acc = Accounts.byEmail(em);
      if (!acc) return this.err('forgotError', 'Tidak ada akun dengan email ini. Akun tanpa email tidak bisa direset lewat email.');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      this._reset = { email: em.toLowerCase(), code, exp: Date.now() + 10 * 60 * 1000 };
      $('resetEmailShow').textContent = em;
      $('demoCode').textContent = code; // SIMULASI: di web asli kode dikirim lewat server email
      $('resetCode').value = ''; $('resetPass').value = ''; this.err('resetError', '');
      this.switchView('reset');
    });

    // LUPA SANDI -> kode + sandi baru
    $('resetForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = $('resetCode').value.trim(), pw = $('resetPass').value, r = this._reset;
      if (!r || Date.now() > r.exp) return this.err('resetError', 'Kode kedaluwarsa. Kirim ulang kode dari awal.');
      if (code !== r.code) return this.err('resetError', 'Kode salah, cek lagi emailmu.');
      if (pw.length < 6) return this.err('resetError', 'Sandi baru minimal 6 karakter.');
      const list = Accounts.all(), acc = list.find(a => a.email && a.email.toLowerCase() === r.email);
      if (acc) { acc.pass = Accounts.hash(pw); Accounts.save(list); }
      this._reset = null;
      this.switchView('login');
      App.showToast('Sandi berhasil diganti. Silakan masuk.', 'success');
    });

    // GOOGLE (simulasi pilih akun Google)
    $('googleForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const em = $('googleEmail').value.trim();
      if (!this.EMAIL_RE.test(em)) return this.err('googleError', 'Masukkan alamat akun Google yang valid.');
      const acc = Accounts.byEmail(em);
      const name = acc ? acc.username : em.split('@')[0];
      this.completeLogin(name, em, `Berhasil masuk dengan Google, ${name}!`, 'google');
    });
  },

  completeLogin(name, email, message, provider = 'password') {
    const user = StorageManager.getUser();
    user.name = name;
    user.username = `@${name}`;
    user.email = email || '';
    user.memberSince = user.memberSince || new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    user.provider = provider;
    user.isLoggedIn = true;
    StorageManager.saveUser(user);
    App.finishLogin();
    App.showToast(message, 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Book3DEngine.init();
  const btnClose = document.getElementById('btnCloseLoginModal');
  if (btnClose) {
    btnClose.onclick = (e) => {
      e.preventDefault();
      if (!StorageManager.getUser().isLoggedIn) return;
      Book3DEngine.closeBook();
    };
  }
});
