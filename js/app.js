/**
 * KOMIK.ID - Main Application Controller
 * Mengatur Single Page Navigation, Filter & Search Engine,
 * Modal Login/Register, Notifikasi, Akun, dan Tampilan Mobile/Desktop.
 */

const App = {
  currentView: 'beranda',
  viewParams: {},
  activeTypeFilter: 'all',
  activeGenreFilter: 'all',
  activeSort: 'latest',
  browsePage: 1,
  browsePageSize: 12,
  activeStatusFilter: 'all',
  hideBookmarksInBrowse: false,
  heroCurrentSlide: 0,
  heroTimer: null,
  pendingRoute: null,

  init() {
    // Inisialisasi komponen pembantu
    Reader.init();

    // Bind event navigasi dan UI
    this.bindNavigation();
    this.bindModals();
    this.bindSearchAndFilters();
    // this.bindDeviceViewToggle();

        // Escape key listener untuk menutup modal atau kembali
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
          if (activeModal.id === 'loginModal' && !StorageManager.getUser().isLoggedIn) return;
          activeModal.classList.remove('active');
          document.body.style.overflow = '';
        } else if (['detail', 'reader', 'notifikasi', 'akun'].includes(this.currentView)) {
          this.goBack();
        }
      }
    });

    // Initial render
    this.handleRoute();
    this.updateHeaderAccount();
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  // --- ROUTING / VIEW NAVIGATION ---
  // Navigation Stack & History Tracking (Bebas Bug Looping)
  navStack: [],
  lastMainTab: 'beranda',
  detailOriginView: null,

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'beranda';
    const [viewName, queryStr] = hash.split('?');
    const params = {};

    if (queryStr) {
      new URLSearchParams(queryStr).forEach((val, key) => {
        params[key] = val;
      });
    }

    this.navigateTo(viewName || 'beranda', params, false, false, true);
  },

  navigateTo(viewName, params = {}, updateHash = true, isBackAction = false, fromHashChange = false) {
    const prevView = this.currentView;
    const prevParams = { ...this.viewParams };

    // Catat tab utama terakhir
    if (['beranda', 'browse', 'bookmark', 'akun'].includes(viewName)) {
      this.lastMainTab = viewName;
    }

    // Jika menuju detail dari view non-reader, simpan origin
    if (viewName === 'detail' && prevView && prevView !== 'reader' && prevView !== 'detail') {
      this.detailOriginView = { view: prevView, params: prevParams };
    }

    // Simpan ke riwayat stack jika navigasi maju
    if (!isBackAction && !fromHashChange && prevView && prevView !== viewName) {
      if (!(prevView === 'reader' && viewName === 'detail') && !(prevView === 'detail' && viewName === 'reader')) {
        this.navStack.push({ view: prevView, params: prevParams });
      }
    }

    this.currentView = viewName;
    this.viewParams = params;

    if (updateHash) {
      let hash = `#${viewName}`;
      const searchParams = new URLSearchParams(params).toString();
      if (searchParams) hash += `?${searchParams}`;

      if (isBackAction) {
        window.history.replaceState(null, '', hash);
      } else {
        window.location.hash = hash;
      }
    }

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-item, .desktop-nav-link').forEach(item => {
      const target = item.getAttribute('data-view');
      item.classList.toggle('active', target === viewName);
    });

    // Biarkan CSS mengatur visibilitas navigasi sesuai perangkat dan halaman aktif.
    document.getElementById('appShellContainer')?.classList.toggle('reader-active', viewName === 'reader');

    // Switch view
    switch (viewName) {
      case 'beranda':
        this.switchViewElement('berandaView');
        this.renderBeranda();
        break;
      case 'browse':
        this.switchViewElement('browseView');
        this.renderBrowse();
        break;
      case 'bookmark':
        this.switchViewElement('bookmarkView');
        this.renderBookmark();
        break;
      case 'detail':
        this.switchViewElement('detailView');
        this.renderDetail(params.id);
        break;
      case 'reader':
        // Reader view ditangani oleh Reader.open
        if (params.id) {
          Reader.open(params.id, parseInt(params.ch, 10) || 1);
        } else {
          this.navigateTo('beranda');
        }
        break;
      case 'akun':
        this.switchViewElement('akunView');
        this.renderAkun();
        break;
      case 'notifikasi':
        this.switchViewElement('notifikasiView');
        this.renderNotifikasi();
        break;
      default:
        this.switchViewElement('berandaView');
        this.renderBeranda();
    }

    // Scroll ke atas tiap pindah halaman (kecuali reader)
    if (viewName !== 'reader') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },

  switchViewElement(viewId) {
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }
  },

  // --- GENERAL GO BACK HANDLER (Bebas Bug Looping) ---
  goBack() {
    // 1. Dari mode Reader: kembali ke detail komik terkait
    if (this.currentView === 'reader') {
      if (this.viewParams && this.viewParams.id) {
        this.navigateTo('detail', { id: this.viewParams.id }, true, true);
        return;
      }
      if (this.detailOriginView) {
        this.navigateTo(this.detailOriginView.view, this.detailOriginView.params, true, true);
        return;
      }
      this.navigateTo(this.lastMainTab || 'beranda', {}, true, true);
      return;
    }

    // 2. Dari Detail Komik: kembali ke view asal (browse, bookmark, beranda)
    if (this.currentView === 'detail') {
      if (this.detailOriginView && this.detailOriginView.view !== 'detail' && this.detailOriginView.view !== 'reader') {
        const dest = this.detailOriginView;
        this.detailOriginView = null;
        this.navigateTo(dest.view, dest.params, true, true);
        return;
      }

      while (this.navStack.length > 0) {
        const candidate = this.navStack.pop();
        if (candidate.view !== 'detail' && candidate.view !== 'reader') {
          this.navigateTo(candidate.view, candidate.params, true, true);
          return;
        }
      }

      this.navigateTo(this.lastMainTab || 'beranda', {}, true, true);
      return;
    }

    // 3. Dari Notifikasi atau Akun: kembali ke halaman sebelumnya
    if (this.currentView === 'notifikasi' || this.currentView === 'akun') {
      while (this.navStack.length > 0) {
        const candidate = this.navStack.pop();
        if (candidate.view !== 'notifikasi' && candidate.view !== 'akun') {
          this.navigateTo(candidate.view, candidate.params, true, true);
          return;
        }
      }
      this.navigateTo(this.lastMainTab || 'beranda', {}, true, true);
      return;
    }

    // 4. Default Stack Pop
    while (this.navStack.length > 0) {
      const candidate = this.navStack.pop();
      if (candidate.view !== this.currentView) {
        this.navigateTo(candidate.view, candidate.params, true, true);
        return;
      }
    }

    // Fallback utama ke Beranda
    if (this.currentView !== 'beranda') {
      this.navigateTo('beranda', {}, true, true);
    }
  },

  refreshCurrentView() {
    this.navigateTo(this.currentView, this.viewParams, false);
  },

  // --- BINDINGS ---
  bindNavigation() {
    // Bottom Nav items
    document.querySelectorAll('.bottom-nav-item, .desktop-nav-link').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.navigateTo(view);
      });
    });

    // Top logo click -> beranda
    document.getElementById('brandLogo').addEventListener('click', () => {
      this.navigateTo('beranda');
    });

    // Notifikasi button di header
    document.getElementById('btnOpenNotif').addEventListener('click', () => {
      this.navigateTo('notifikasi');
    });

    // Profile avatar di header
    document.getElementById('btnOpenProfile').addEventListener('click', () => {
      if (StorageManager.getUser().isLoggedIn) this.navigateTo('akun');
      else this.openLogin();
    });

    // Back button di detail view
    const btnBackDetail = document.getElementById('btnBackFromDetail');
    if (btnBackDetail) {
      btnBackDetail.addEventListener('click', (e) => {
        e.preventDefault();
        this.goBack();
      });
    }

    // Back button di akun view
    const btnBackAkun = document.getElementById('btnBackFromAkun');
    if (btnBackAkun) {
      btnBackAkun.addEventListener('click', (e) => {
        e.preventDefault();
        this.goBack();
      });
    }

    // Back button di notifikasi view
    const btnBackNotif = document.getElementById('btnBackFromNotif');
    if (btnBackNotif) {
      btnBackNotif.addEventListener('click', (e) => {
        e.preventDefault();
        this.goBack();
      });
    }
  },

  bindModals() {
    const profileModal = document.getElementById('profileSettingsModal');
    const closeProfileModal = () => { profileModal?.classList.remove('active'); document.body.style.overflow = ''; };
    document.getElementById('btnCloseProfileSettings')?.addEventListener('click', closeProfileModal);
    profileModal?.addEventListener('click', e => { if (e.target === profileModal) closeProfileModal(); });
    document.getElementById('profileSettingsForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('profileDisplayNameInput').value.trim();
      const error = document.getElementById('profileSettingsError');
      if (!name) { error.textContent = 'Nama tampilan wajib diisi.'; return; }
      const user = StorageManager.getUser();
      user.displayName = name;
      user.bio = document.getElementById('profileBioInput').value.trim();
      StorageManager.saveUser(user);
      this.renderAkun();
      closeProfileModal();
      this.showToast('Profil berhasil diperbarui.', 'success');
    });

    // Modal Login
    const loginModal = document.getElementById('loginModal');
    const btnOpenLogin = document.getElementById('btnTriggerLogin');

    // Maskot membaca saat username aktif dan memejamkan mata saat sandi diketik.
    const loginMascot = document.getElementById('loginMascot');
    const loginIdInput = document.getElementById('loginId');
    const loginPassInput = document.getElementById('loginPass');
    const setMascotMood = mood => loginMascot?.setAttribute('data-mood', mood);
    loginModal?.addEventListener('pointermove', event => {
      if (!loginMascot || !document.getElementById('book3d')?.classList.contains('book-opened')) return;
      const rect = loginMascot.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
      const y = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
      loginMascot.style.setProperty('--look-x', `${(x * 3).toFixed(1)}px`);
      loginMascot.style.setProperty('--look-y', `${(y * 2.5).toFixed(1)}px`);
    });
    loginModal?.addEventListener('pointerleave', () => {
      loginMascot?.style.setProperty('--look-x', '0px');
      loginMascot?.style.setProperty('--look-y', '0px');
    });
    loginIdInput?.addEventListener('focus', () => setMascotMood('reading'));
    loginPassInput?.addEventListener('focus', () => setMascotMood('shy'));
    [loginIdInput, loginPassInput].forEach(input => input?.addEventListener('blur', () => {
      if (!loginIdInput.matches(':focus') && !loginPassInput.matches(':focus')) setMascotMood('resting');
    }));

    if (btnOpenLogin) {
      btnOpenLogin.addEventListener('click', () => this.openLogin());
    }
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal && StorageManager.getUser().isLoggedIn) this.closeLogin();
    });

    // Modal Keamanan Akun
    const secModal = document.getElementById('securityModal');
    const closeSec = () => { secModal.classList.remove('active'); document.body.style.overflow = ''; };
    document.getElementById('btnCloseSecurity')?.addEventListener('click', closeSec);
    secModal?.addEventListener('click', (e) => { if (e.target === secModal) closeSec(); });
    secModal?.querySelectorAll('[data-toggle-pass]').forEach(btn => btn.addEventListener('click', () => {
      const inp = btn.parentElement.querySelector('input');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    }));
    secModal?.querySelectorAll('input').forEach(i => i.addEventListener('input', () => {
      secModal.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; });
    }));
    const setErr = (id, msg) => { document.getElementById(id).textContent = msg; };

    document.getElementById('secPassForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = StorageManager.getUser();
      const list = Accounts.all();
      const acc = list.find(a => a.username.toLowerCase() === (user.name || '').toLowerCase());
      const oldPw = document.getElementById('secOldPass').value;
      const newPw = document.getElementById('secNewPass').value;
      const conf = document.getElementById('secConfirmPass').value;
      if (!acc) return setErr('secPassError', 'Akun tidak ditemukan.');
      if (acc.pass !== Accounts.hash(oldPw)) return setErr('secPassError', 'Sandi lama salah.');
      if (newPw.length < 6) return setErr('secPassError', 'Sandi baru minimal 6 karakter.');
      if (newPw !== conf) return setErr('secPassError', 'Ulangi sandi baru belum sama.');
      acc.pass = Accounts.hash(newPw);
      Accounts.save(list);
      e.target.reset();
      this.showToast('Sandi berhasil diganti.', 'success');
    });

    document.getElementById('secEmailForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = StorageManager.getUser();
      const list = Accounts.all();
      const acc = list.find(a => a.username.toLowerCase() === (user.name || '').toLowerCase());
      const em = document.getElementById('secEmailInput').value.trim();
      if (!acc) return setErr('secEmailError', 'Akun tidak ditemukan.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr('secEmailError', 'Format email belum benar.');
      if (list.some(a => a !== acc && a.email && a.email.toLowerCase() === em.toLowerCase())) return setErr('secEmailError', 'Email sudah dipakai akun lain.');
      acc.email = em;
      Accounts.save(list);
      user.email = em;
      StorageManager.saveUser(user);
      document.getElementById('secEmailNow').textContent = em;
      this.showToast('Email pemulihan disimpan.', 'success');
    });
  },

  openSecurity() {
    const user = StorageManager.getUser();
    if (!user.isLoggedIn) { this.openLogin(); return; }
    const isGoogle = user.provider === 'google';
    const acc = isGoogle ? null : Accounts.all().find(a => a.username.toLowerCase() === (user.name || '').toLowerCase());
    document.getElementById('secUsername').textContent = '@' + user.name;
    document.getElementById('secMethod').textContent = isGoogle ? 'Google' : 'Username & sandi';
    document.getElementById('secEmailNow').textContent = user.email || 'Belum ada email';
    const note = document.getElementById('secNote');
    const controls = document.getElementById('secControls');
    controls.hidden = !acc;
    note.hidden = !!acc;
    if (!acc) note.textContent = isGoogle
      ? 'Akunmu masuk lewat Google, jadi sandi dan keamanannya diatur langsung di akun Google-mu.'
      : 'Akun ini belum punya sandi tersimpan. Buat akun baru lewat tombol Masuk untuk mengatur sandi.';
    if (acc) document.getElementById('secEmailInput').value = acc.email || '';
    document.querySelectorAll('#securityModal input[type=password]').forEach(i => { i.value = ''; });
    document.querySelectorAll('#securityModal .auth-error').forEach(el => { el.textContent = ''; });
    document.getElementById('securityModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  },


  openLogin() {
    const modal = document.getElementById('loginModal');
    if (!modal || modal.classList.contains('active')) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    Book3DEngine.showCover(); // tampil sampul dulu, buku terbuka saat sampul diklik
  },

  closeLogin() {
    if (!StorageManager.getUser().isLoggedIn) return;
    Book3DEngine.closeBook();
  },

  finishLogin() {
    const pending = this.pendingRoute;
    this.pendingRoute = null;
    Book3DEngine.closeBook();
    this.refreshCurrentView();
    this.updateHeaderAccount();
    if (pending) setTimeout(() => this.navigateTo(pending.view, pending.params), 760);
  },

  // Huruf awal nama untuk foto profil (mis. "dyo" -> "D")
  userInitial() {
    const name = (StorageManager.getUser().name || '').trim();
    return name ? Array.from(name)[0].toUpperCase() : '?';
  },

  updateHeaderAccount() {
    const loggedIn = StorageManager.getUser().isLoggedIn;
    const trigger = document.getElementById('btnOpenProfile');
    if (trigger) {
      trigger.classList.toggle('header-login-trigger', !loggedIn);
      trigger.title = loggedIn ? 'Profil Akun' : 'Masuk Akun';
      trigger.innerHTML = loggedIn ? `<span class="avatar-initial" id="headerAvatarInitial">${this.userInitial()}</span>` : '<span>Masuk</span>';
    }
    const loginButton = document.getElementById('btnTriggerLogin');
    if (loginButton) loginButton.hidden = loggedIn;
    const logoutButton = document.getElementById('btnLogoutUser');
    if (logoutButton) logoutButton.hidden = !loggedIn;
    document.getElementById('profileMemberContent')?.toggleAttribute('hidden', !loggedIn);
    document.getElementById('profileGuestContent')?.toggleAttribute('hidden', loggedIn);
  },

  bindSearchAndFilters() {
    const homeSearchForm = document.getElementById('homeSearchForm');
    homeSearchForm?.addEventListener('submit', e => {
      e.preventDefault();
      const query = document.getElementById('homeSearchInput').value.trim();
      this.navigateTo('browse', query ? { q: query } : {});
    });

    // Quick Type pills di Beranda
    document.querySelectorAll('.home-type-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.home-type-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.getAttribute('data-type');
        this.activeTypeFilter = type;
        this.renderBerandaTrending();
        this.renderBerandaLatest();
      });
    });

    // Search bar di Browse
    const searchInput = document.getElementById('browseSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.browsePage = 1;
        this.renderBrowseComics();
      });
    }

    // Filter Type di Browse
    const typeSelect = document.getElementById('browseTypeSelect');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.browsePage = 1;
        this.activeTypeFilter = e.target.value;
        this.renderBrowseComics();
      });
    }

    // Filter Sort di Browse
    const sortSelect = document.getElementById('browseSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.browsePage = 1;
        this.activeSort = e.target.value;
        this.renderBrowseComics();
      });
    }

    // Filter Status di Browse
    const statusSelect = document.getElementById('browseStatusSelect');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.browsePage = 1;
        this.activeStatusFilter = e.target.value;
        this.renderBrowseComics();
      });
    }

    // Toggle Hide Bookmarks di Browse
    const toggleHideBk = document.getElementById('toggleHideBookmarks');
    if (toggleHideBk) {
      toggleHideBk.addEventListener('change', (e) => {
        this.browsePage = 1;
        this.hideBookmarksInBrowse = e.target.checked;
        this.renderBrowseComics();
      });
    }
  },

  // --- RENDER BERANDA (HOME) ---
  renderBeranda() {
    this.renderHeroCarousel();
    this.renderBerandaTrending();
    this.renderBerandaLatest();
  },

  renderHeroCarousel() {
    const container = document.getElementById('heroCarouselSlides');
    const dotsContainer = document.getElementById('heroDots');
    if (!container) return;

    const comics = StorageManager.getComics();
    // Komik pilihan teratas (Hero)
    const topPicks = comics
      .filter(c => c.isTopPick || c.id === 'love-revolution')
      .sort((a, b) => (a.id === 'love-revolution' ? -1 : b.id === 'love-revolution' ? 1 : 0));

    container.innerHTML = '';
    dotsContainer.innerHTML = '';
    dotsContainer.hidden = topPicks.length <= 1;

    topPicks.forEach((comic, idx) => {
      const slide = document.createElement('div');
      slide.className = `hero-slide ${idx === 0 ? 'active' : ''}`;
      slide.innerHTML = `
        <div class="hero-card">
          <div class="hero-bg-poster" style="background-image: url('${comic.bannerImage || comic.coverImage}')"></div>
          <div class="hero-overlay"></div>
          <div class="hero-content">
            <div class="hero-top-badges">
              <span class="badge-pill country">${comic.countryCode} ${comic.type.toUpperCase()}</span>
              <span class="badge-pill rating">★ ${this.getComicRating(comic)}</span>
            </div>
            <div class="hero-chapter-info">CHAPTER ${comic.latestChapter} TERBIT</div>
            <h2 class="hero-title">${comic.title}</h2>
            <p class="hero-synopsis">${comic.synopsis.slice(0, 110)}...</p>
            <div class="hero-actions">
              <button class="btn-cyan-primary btn-baca" onclick="App.navigateTo('reader', { id: '${comic.id}', ch: ${(comic.chapters[0] && comic.chapters[0].number) || comic.latestChapter} })">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Baca Sekarang
              </button>
              <button class="btn-icon-bookmark ${StorageManager.isBookmarked(comic.id) ? 'bookmarked' : ''}" onclick="App.toggleBookmarkAction('${comic.id}', this)" title="Simpan Bookmark">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${StorageManager.isBookmarked(comic.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
      container.appendChild(slide);

      const dot = document.createElement('span');
      dot.className = `hero-dot ${idx === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => this.setHeroSlide(idx));
      dotsContainer.appendChild(dot);
    });

    // Autoplay carousel slider
    clearInterval(this.heroTimer);
    this.heroCurrentSlide = 0;
    this.heroTimer = setInterval(() => {
      const slides = document.querySelectorAll('.hero-slide');
      if (slides.length > 1) {
        this.heroCurrentSlide = (this.heroCurrentSlide + 1) % slides.length;
        this.setHeroSlide(this.heroCurrentSlide);
      }
    }, 5500);
  },

  setHeroSlide(index) {
    this.heroCurrentSlide = index;
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    slides.forEach((s, idx) => s.classList.toggle('active', idx === index));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === index));
  },

  renderBerandaTrending() {
    const listEl = document.getElementById('homeTrendingList');
    if (!listEl) return;

    let comics = StorageManager.getComics();
    if (this.activeTypeFilter !== 'all') {
      comics = comics.filter(c => c.type === this.activeTypeFilter);
    }
    // Prioritaskan trending
    const trending = comics.filter(c => c.isTrending).concat(comics.filter(c => !c.isTrending)).slice(0, 8);

    listEl.innerHTML = '';
    trending.forEach(comic => {
      const card = document.createElement('div');
      card.className = 'trending-comic-card';
      card.innerHTML = `
        <div class="card-thumb-wrap" onclick="App.navigateTo('detail', { id: '${comic.id}' })">
          <img src="${comic.coverImage}" alt="${comic.title}" loading="lazy" class="card-cover-img" />
          <div class="card-top-badges">
            ${this.getComicBadge(comic)}
            <span class="badge-mini-country">${comic.countryCode}</span>
          </div>
          <div class="card-bottom-info">
            <span class="card-ch-badge">Ch. ${comic.latestChapter}</span>
            <span class="card-star-badge">★ ${this.getComicRating(comic)}</span>
          </div>
        </div>
        <div class="card-meta">
          <h4 class="card-comic-title" onclick="App.navigateTo('detail', { id: '${comic.id}' })">${comic.title}</h4>
          <p class="card-comic-genres">${comic.genres.slice(0, 2).join(', ')}</p>
        </div>
      `;
      listEl.appendChild(card);
    });
  },

  renderBerandaLatest() {
    const listEl = document.getElementById('homeLatestList');
    if (!listEl) return;

    let comics = StorageManager.getComics();
    if (this.activeTypeFilter !== 'all') {
      comics = comics.filter(c => c.type === this.activeTypeFilter);
    }

    listEl.innerHTML = '';
    comics.slice(0, 7).forEach(comic => {
      const item = document.createElement('div');
      item.className = 'latest-comic-row';
      item.innerHTML = `
        <div class="row-cover-wrap" onclick="App.navigateTo('detail', { id: '${comic.id}' })">
          <img src="${comic.coverImage}" alt="${comic.title}" loading="lazy" class="row-cover-img" />
          ${this.getComicBadge(comic, 'row-badge-corner')}
        </div>
        <div class="row-info-wrap">
          <div class="row-header">
            <h4 class="row-comic-title" onclick="App.navigateTo('detail', { id: '${comic.id}' })">${comic.title}</h4>
            <span class="row-country-tag ${comic.type}">${comic.countryCode}</span>
          </div>
          <p class="row-genres">${comic.genres.slice(0, 3).join(', ')}</p>
          <div class="row-chapters-list">
            <div class="row-chapter-chip" onclick="App.navigateTo('reader', { id: '${comic.id}', ch: ${comic.latestChapter} })">
              <span class="ch-text">Chapter ${comic.latestChapter}</span>
              <span class="ch-time">2 jam lalu</span>
            </div>
            ${(comic.chapters || []).length > 1 ? `
              <div class="row-chapter-chip sub" onclick="App.navigateTo('reader', { id: '${comic.id}', ch: ${comic.chapters[1].number} })">
                <span class="ch-text">${comic.chapters[1].title}</span>
                <span class="ch-time">3 jam lalu</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      listEl.appendChild(item);
    });
  },

  // --- RENDER BROWSE (KATALOG) ---
  renderBrowse() {
    const searchInput = document.getElementById('browseSearchInput');
    if (searchInput) searchInput.value = this.viewParams.q || '';
    this.renderGenreFilterBar();
    this.renderBrowseComics();
  },

  renderGenreFilterBar() {
    const container = document.getElementById('browseGenreFilterBar');
    if (!container) return;

    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = `filter-pill-chip ${this.activeGenreFilter === 'all' ? 'active' : ''}`;
    allBtn.textContent = 'Semua Genre';
    allBtn.addEventListener('click', () => {
      this.activeGenreFilter = 'all';
      this.browsePage = 1;
      this.renderGenreFilterBar();
      this.renderBrowseComics();
    });
    container.appendChild(allBtn);

    ALL_GENRES.forEach(genre => {
      const chip = document.createElement('button');
      chip.className = `filter-pill-chip ${this.activeGenreFilter === genre ? 'active' : ''}`;
      chip.textContent = genre;
      chip.addEventListener('click', () => {
        this.activeGenreFilter = genre;
        this.browsePage = 1;
        this.renderGenreFilterBar();
        this.renderBrowseComics();
      });
      container.appendChild(chip);
    });
  },

  renderBrowseComics() {
    const gridEl = document.getElementById('browseComicsGrid');
    const countEl = document.getElementById('browseTotalCount');
    const searchInput = document.getElementById('browseSearchInput');
    if (!gridEl) return;

    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    let comics = StorageManager.getComics();

    // Filter Query Search
    if (query) {
      comics = comics.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.altTitle && c.altTitle.toLowerCase().includes(query)) ||
        (c.author && c.author.toLowerCase().includes(query)) ||
        c.genres.some(g => g.toLowerCase().includes(query))
      );
    }

    // Filter Type
    if (this.activeTypeFilter !== 'all') {
      comics = comics.filter(c => c.type === this.activeTypeFilter);
    }

    // Filter Genre
    if (this.activeGenreFilter !== 'all') {
      comics = comics.filter(c => c.genres.includes(this.activeGenreFilter));
    }

    // Filter Status
    if (this.activeStatusFilter !== 'all') {
      comics = comics.filter(c => c.status.toLowerCase() === this.activeStatusFilter.toLowerCase());
    }

    // Filter Hide Bookmarks
    if (this.hideBookmarksInBrowse) {
      comics = comics.filter(c => !StorageManager.isBookmarked(c.id));
    }

    // Sorting
    if (this.activeSort === 'latest') {
      comics.sort((a, b) => b.latestChapter - a.latestChapter);
    } else if (this.activeSort === 'rating') {
      comics.sort((a, b) => b.rating - a.rating);
    } else if (this.activeSort === 'az') {
      comics.sort((a, b) => a.title.localeCompare(b.title));
    } else if (this.activeSort === 'popular') {
      comics.sort((a, b) => parseFloat(b.votes || 0) - parseFloat(a.votes || 0));
    }

    if (countEl) {
      countEl.textContent = `${comics.length} Komik Ditemukan`;
    }

    const pageCount = Math.max(1, Math.ceil(comics.length / this.browsePageSize));
    this.browsePage = Math.min(this.browsePage, pageCount);
    const pageStart = (this.browsePage - 1) * this.browsePageSize;
    const visibleComics = comics.slice(pageStart, pageStart + this.browsePageSize);
    this.renderBrowsePagination(pageCount, comics.length);

    gridEl.innerHTML = '';
    if (comics.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state-card col-span-full">
          <div class="empty-icon">◎</div>
          <h3>Tidak ada komik yang cocok</h3>
          <p>Coba gunakan kata kunci lain atau ubah filter genre & tipe.</p>
        </div>
      `;
      return;
    }

    visibleComics.forEach(comic => {
      const card = document.createElement('div');
      card.className = 'browse-comic-card';
      card.innerHTML = `
        <div class="card-thumb-wrap" onclick="App.navigateTo('detail', { id: '${comic.id}' })">
          <img src="${comic.coverImage}" alt="${comic.title}" loading="lazy" class="card-cover-img" />
          <div class="card-top-badges">
            ${this.getComicBadge(comic)}
            <span class="badge-mini-country">${comic.countryCode}</span>
          </div>
          <div class="card-bottom-info">
            <span class="card-ch-badge">Ch. ${comic.latestChapter}</span>
            <span class="card-star-badge">★ ${this.getComicRating(comic)}</span>
          </div>
        </div>
        <div class="card-meta">
          <div class="card-meta-head">
            <h4 class="card-comic-title" onclick="App.navigateTo('detail', { id: '${comic.id}' })">${comic.title}</h4>
          </div>
          <p class="card-comic-genres">${comic.genres.slice(0, 2).join(', ')}</p>
          <div class="card-footer-info">
            <span class="card-time-ago">3 jam lalu</span>
            <span class="card-status-dot ${comic.status === 'Ongoing' ? 'ongoing' : 'tamat'}">${comic.status}</span>
          </div>
        </div>
      `;
      gridEl.appendChild(card);
    });
  },

  renderBrowsePagination(pageCount, totalCount) {
    const pagination = document.getElementById('browsePagination');
    if (!pagination) return;
    pagination.innerHTML = '';
    pagination.hidden = totalCount <= this.browsePageSize;
    if (pagination.hidden) return;

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'browse-page-button';
    previous.textContent = '← Sebelumnya';
    previous.disabled = this.browsePage === 1;
    previous.addEventListener('click', () => this.changeBrowsePage(this.browsePage - 1));

    const status = document.createElement('span');
    status.className = 'browse-page-status';
    status.textContent = `Halaman ${this.browsePage} dari ${pageCount}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'browse-page-button';
    next.textContent = 'Berikutnya →';
    next.disabled = this.browsePage === pageCount;
    next.addEventListener('click', () => this.changeBrowsePage(this.browsePage + 1));

    pagination.append(previous, status, next);
  },

  changeBrowsePage(page) {
    this.browsePage = page;
    this.renderBrowseComics();
    document.getElementById('browseComicsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // --- RENDER BOOKMARK & RIWAYAT ---
  renderBookmark() {
    const loggedIn = StorageManager.getUser().isLoggedIn;
    document.getElementById('bookmarkGuestContent')?.toggleAttribute('hidden', loggedIn);
    document.getElementById('bookmarkMemberContent')?.toggleAttribute('hidden', !loggedIn);
    if (!loggedIn) return;
    const countBadge = document.getElementById('bookmarkTotalCountBadge');
    const bookmarks = StorageManager.getBookmarks();
    if (countBadge) {
      countBadge.textContent = `${bookmarks.length} Komik Tersimpan`;
    }
    this.renderBookmarkList();
  },

  renderBookmarkList() {
    const listEl = document.getElementById('bookmarkItemsList');
    if (!listEl) return;
    const items = StorageManager.getBookmarks()
      .map(bk => ({ bk, comic: StorageManager.getComicById(bk.comicId) }))
      .filter(x => x.comic);

    listEl.innerHTML = '';
    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">◎</div>
          <h3>Belum ada bookmark</h3>
          <p>Tekan tombol bookmark pada komik yang kamu suka, nanti muncul di sini.</p>
          <button class="btn-cyan-primary mt-3" onclick="App.navigateTo('browse')">Jelajahi Komik</button>
        </div>
      `;
      return;
    }

    items.forEach(({ bk, comic }) => {
      const item = document.createElement('div');
      item.className = 'bookmark-comic-card';
      item.innerHTML = `
        <div class="bk-cover-wrap" onclick="App.navigateTo('detail', { id: '${comic.id}' })">
          <img src="${comic.coverImage}" alt="${comic.title}" class="bk-cover-img" />
          ${bk.hasNewChapter ? `<span class="bk-update-tag">Ch. ${comic.latestChapter} Baru!</span>` : ''}
        </div>
        <div class="bk-content-wrap">
          <div class="bk-header-row">
            <div class="bk-badges-group">
              <span class="bk-status-pill">${comic.status}</span>
              <span class="bk-type-pill">${comic.countryCode}</span>
            </div>
          </div>
          <h4 class="bk-comic-title" onclick="App.navigateTo('detail', { id: '${comic.id}' })">${comic.title}</h4>
          <p class="bk-meta-text">Terakhir: Ch. ${bk.lastReadChapter} <span class="divider">•</span> Total: ${comic.totalChapters}</p>
          <div class="bk-actions-row">
            <button class="btn-cyan-primary btn-lanjut" onclick="App.navigateTo('reader', { id: '${comic.id}', ch: ${bk.lastReadChapter} })">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              Lanjut Ch. ${bk.lastReadChapter}
            </button>
            <button class="btn-icon-trash" onclick="App.removeBookmarkAction('${comic.id}')" title="Hapus Bookmark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
      listEl.appendChild(item);
    });
  },

  toggleBookmarkAction(comicId, btnEl) {
    if (!StorageManager.getUser().isLoggedIn) {
      this.openLogin();
      this.showToast('Masuk dulu untuk menyimpan bookmark.', 'info');
      return;
    }
    const isAdded = StorageManager.toggleBookmark(comicId);
    if (btnEl) {
      btnEl.classList.toggle('bookmarked', isAdded);
      btnEl.querySelector('svg').setAttribute('fill', isAdded ? 'currentColor' : 'none');
    }
    const comic = StorageManager.getComicById(comicId);
    const title = comic ? comic.title : 'Komik';
    this.showToast(isAdded ? `"${title}" disimpan ke Bookmark!` : `"${title}" dihapus dari Bookmark!`, isAdded ? 'success' : 'info');
  },

  removeBookmarkAction(comicId) {
    StorageManager.removeBookmark(comicId);
    this.showToast('Bookmark berhasil dihapus', 'info');
    this.renderBookmark();
  },

  // --- RENDER DETAIL KOMIK ---
  renderDetail(comicId) {
    const comic = StorageManager.getComicById(comicId);
    if (!comic) {
      this.navigateTo('beranda');
      return;
    }

    // Set poster & banner
    document.getElementById('detailCoverImg').src = comic.coverImage;
    const bannerImage = document.getElementById('detailBannerImage');
    const bannerBackdrop = document.getElementById('detailBannerBg');
    const bannerPlaceholder = document.getElementById('detailBannerPlaceholder');
    const bannerSource = comic.bannerImage || comic.coverImage || '';
    bannerBackdrop.style.backgroundImage = bannerSource
      ? `url("${bannerSource.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
      : '';
    bannerBackdrop.classList.toggle('has-banner-image', Boolean(bannerSource));
    bannerPlaceholder.hidden = false;
    bannerImage.onload = () => { bannerPlaceholder.hidden = true; };
    bannerImage.onerror = () => {
      bannerPlaceholder.hidden = !bannerSource;
      bannerBackdrop.classList.remove('has-banner-image');
    };
    bannerImage.src = bannerSource;

    // Badges & Title
    document.getElementById('detailStatusBadge').textContent = comic.status;
    document.getElementById('detailTypeBadge').textContent = `${comic.countryCode} ${comic.type.toUpperCase()}`;
    document.getElementById('detailTitle').textContent = comic.title;
    document.getElementById('detailAltTitle').textContent = comic.altTitle || '';
    document.getElementById('detailAuthor').textContent = `Author: ${comic.author || '-'}, Artist: ${comic.artist || '-'}`;
    const reviews = StorageManager.getComicReviews(comic.id);
    const averageRating = this.getComicRating(comic);
    document.getElementById('detailRating').textContent = averageRating;
    document.getElementById('detailVotes').textContent = `(${reviews.length} suara)`;
    document.getElementById('detailRatingCount').textContent = reviews.length;
    document.getElementById('detailTabChapterCount').textContent = comic.chapters.length;
    document.getElementById('detailTabReviewCount').textContent = reviews.length;
    const synopsis = document.getElementById('detailSynopsisText');
    synopsis.textContent = comic.synopsis;
    synopsis.classList.remove('expanded');
    const synopsisToggle = document.getElementById('detailSynopsisToggle');
    synopsisToggle.onclick = () => {
      synopsis.classList.toggle('expanded');
      synopsisToggle.textContent = synopsis.classList.contains('expanded') ? 'Lihat lebih sedikit −' : 'Lihat selengkapnya +';
    };
    document.querySelectorAll('[data-detail-tab]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.detailTab === 'synopsis');
      tab.onclick = () => {
      document.querySelectorAll('[data-detail-tab]').forEach(item => item.classList.toggle('active', item === tab));
      document.querySelectorAll('[data-detail-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.detailPanel === tab.dataset.detailTab));
      };
    });
    document.querySelectorAll('[data-detail-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.detailPanel === 'synopsis'));
    const reviewsList = document.getElementById('detailReviewsList');
    reviewsList.innerHTML = reviews.length ? reviews.map(review => `<article class="detail-review-card"><div><strong>${this.escapeHTML(review.name || 'Pembaca')}</strong><span>${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span></div><small>${review.date || ''}</small><p>${this.escapeHTML(review.comment || 'Memberi rating tanpa komentar.')}</p></article>`).join('') : '<p class="detail-review-empty">Belum ada ulasan. Jadilah pembaca pertama yang memberi rating!</p>';

    // Tombol Bookmark di Detail
    const btnBookmark = document.getElementById('btnToggleDetailBookmark');
    if (btnBookmark) {
      const isBk = StorageManager.isBookmarked(comic.id);
      btnBookmark.classList.toggle('active', isBk);
      btnBookmark.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isBk ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      `;
      btnBookmark.onclick = () => {
        this.toggleBookmarkAction(comic.id);
        this.renderDetail(comic.id);
      };
    }

    // Tombol Baca Sekarang
    const btnBaca1 = document.getElementById('btnBacaChapter1');
    if (btnBaca1) {
      const readChapter = (comic.chapters[0] && comic.chapters[0].number) || comic.latestChapter || 1;
      btnBaca1.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Baca Chapter ${readChapter}`;
      btnBaca1.onclick = () => {
        this.navigateTo('reader', { id: comic.id, ch: readChapter });
      };
    }

    // Tag Genre Lengkap
    const genresContainer = document.getElementById('detailGenreTags');
    genresContainer.innerHTML = '';
    comic.genres.forEach(genre => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'detail-genre-pill';
      tag.textContent = genre;
      tag.onclick = () => {
        this.activeGenreFilter = genre;
        this.navigateTo('browse');
      };
      genresContainer.appendChild(tag);
    });

    // Daftar Chapter
    const chaptersContainer = document.getElementById('detailChaptersList');
    const totalCountEl = document.getElementById('detailTotalChaptersCount');
    if (totalCountEl) totalCountEl.textContent = `Total ${comic.chapters.length} Chapter`;

    chaptersContainer.innerHTML = '';
    // Tampilkan 25 chapter pertama / terbaru
    const displayChapters = comic.chapters.slice(0, 30);
    displayChapters.forEach(ch => {
      const row = document.createElement('div');
      row.className = 'chapter-list-item';
      row.onclick = () => {
        this.navigateTo('reader', { id: comic.id, ch: ch.number });
      };
      row.innerHTML = `
        <div class="ch-left-info">
          <span class="ch-num-title">${ch.title}</span>
        </div>
        <div class="ch-right-action">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `;
      chaptersContainer.appendChild(row);
    });
  },

  escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  },

  getComicRating(comic) {
    const reviews = StorageManager.getComicReviews(comic.id);
    if (!reviews.length) return '0';
    return (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1);
  },

  getComicBadge(comic, className = 'badge-mini-bar') {
    return '';
  },

  submitComicReview(comicId, rating, comment) {
    const user = StorageManager.getUser();
    StorageManager.saveComicReview(comicId, { rating: Math.min(5, Math.max(1, Number(rating))), comment, name: user?.displayName || user?.name || 'Pembaca' });
    this.showToast('Rating dan ulasan berhasil disimpan.', 'success');
  },

  // --- RENDER NOTIFIKASI ---
  renderNotifikasi() {
    const listEl = document.getElementById('notifikasiList');
    if (!listEl) return;

    const notifs = StorageManager.getNotifications();
    listEl.innerHTML = '';

    const btnMarkRead = document.getElementById('btnMarkAllNotifsRead');
    if (btnMarkRead) {
      btnMarkRead.onclick = () => {
        StorageManager.markAllNotifsAsRead();
        this.showToast('Semua notifikasi ditandai telah dibaca', 'info');
        this.renderNotifikasi();
      };
    }

    if (notifs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">◎</div>
          <h3>Tidak ada notifikasi baru</h3>
          <p>Semua komik yang kamu ikuti sudah up to date!</p>
        </div>
      `;
      return;
    }

    notifs.forEach(notif => {
      const item = document.createElement('div');
      item.className = `notif-item-card ${notif.unread ? 'unread' : ''}`;
      item.onclick = () => {
        if (notif.comicId) {
          this.navigateTo('reader', { id: notif.comicId, ch: notif.chapter || 1 });
        }
      };
      item.innerHTML = `
        <div class="notif-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </div>
        <div class="notif-body">
          <div class="notif-header-row">
            <h4 class="notif-title">${notif.title}</h4>
            ${notif.unread ? '<span class="unread-dot"></span>' : ''}
          </div>
          <p class="notif-message">${notif.message}</p>
          <div class="notif-footer-row">
            <span class="notif-comic-name">${notif.comicTitle}</span>
            <span class="notif-time">${notif.time}</span>
          </div>
        </div>
      `;
      listEl.appendChild(item);
    });
  },

  // --- RENDER AKUN / PROFIL ---
  renderAkun() {
    const user = StorageManager.getUser();
    this.updateHeaderAccount();
    if (!user.isLoggedIn) return;

    document.getElementById('profileUserName').textContent = user.displayName || user.name;
    document.getElementById('profileUserMeta').textContent = user.bio || `Anggota sejak ${user.memberSince}`;
    document.getElementById('profileAvatarInitial').textContent = (user.displayName || user.name || '?').trim().charAt(0).toUpperCase();

    const bookmarks = StorageManager.getBookmarks();
    const history = StorageManager.getHistory();

    document.getElementById('profileBookmarkStat').textContent = `${bookmarks.length} Seri`;
    document.getElementById('profileHistoryStat').textContent = `${history.length} Ch.`;

    const btnLogout = document.getElementById('btnLogoutUser');
    if (btnLogout) {
      btnLogout.onclick = () => {
        if (confirm('Apakah kamu yakin ingin keluar dari akun?')) {
          user.isLoggedIn = false;
          user.name = 'Tamu';
          user.username = '';
          user.provider = '';
          user.memberSince = '';
          StorageManager.saveUser(user);
          this.showToast('Kamu telah keluar dari akun.', 'info');
          this.updateHeaderAccount();
          this.navigateTo('beranda');
        }
      };
    }
  },

  openProfileSettings() {
    const user = StorageManager.getUser();
    if (!user?.isLoggedIn) { this.openLogin(); return; }
    document.getElementById('profileDisplayNameInput').value = user.displayName || user.name || '';
    document.getElementById('profileBioInput').value = user.bio || '';
    document.getElementById('profileSettingsError').textContent = '';
    document.getElementById('profileSettingsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  // --- TOAST NOTIFICATION ---
  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      <span class="toast-icon">${iconSvg}</span>
      <span class="toast-msg">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 20);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// Jalankan aplikasi saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Global fallback handler untuk gambar yang gagal dimuat (offline/network slow)
const DEFAULT_FALLBACK_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22580%22%20viewBox%3D%220%200%20400%20580%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23131d2e%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%230b0f19%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23bg)%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2248%25%22%20fill%3D%22%2300a3ff%22%20font-family%3D%22sans-serif%22%20font-size%3D%2232%22%20font-weight%3D%22bold%22%20text-anchor%3D%22middle%22%3EKOMIK.ID%3C%2Ftext%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2255%25%22%20fill%3D%22%2394a3b8%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%20text-anchor%3D%22middle%22%3EKoleksi%20Komik%3C%2Ftext%3E%3C%2Fsvg%3E";
window.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'IMG' && !e.target.classList.contains('reader-panel-img')) {
    if (!e.target.dataset.fallbackTried) {
      e.target.dataset.fallbackTried = 'true';
      e.target.src = DEFAULT_FALLBACK_IMG;
    }
  }
}, true);
