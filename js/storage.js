/**
 * KOMIK.ID - LocalStorage & State Management
 * Mengelola penyimpanan komik (termasuk hasil modifikasi judul/genre),
 * bookmark pengguna, riwayat baca, notifikasi, dan sesi login.
 */

const STORAGE_KEYS = {
  COMICS: 'komik_id_custom_comics_v1',
  BOOKMARKS: 'komik_id_bookmarks_v1',
  HISTORY: 'komik_id_history_v1',
  USER: 'komik_id_user_v1',
  NOTIFICATIONS: 'komik_id_notifs_v1'
};

const StorageManager = {
  // --- DATA KOMIK ---
  // Sumber data = js/data.js (edit judul, genre, sinopsis, dll langsung di file itu).
  getComics() {
    if (!this._cacheCleared) {
      // buang sisa hasil edit lama dari web supaya perubahan di data.js selalu tampil
      try { localStorage.removeItem(STORAGE_KEYS.COMICS); } catch (e) {}
      this._cacheCleared = true;
    }
    const hidden = ['swordmasters-youngest-son', 'the-greatest-estate-developer', 'apotheosis', 'tales-of-demons-and-gods'];
    return INITIAL_COMICS.filter(comic => !hidden.includes(comic.id));
  },

  getComicById(id) {
    const comics = this.getComics();
    return comics.find(c => c.id === id) || null;
  },

  // --- BOOKMARKS ---
  getBookmarks() {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    if (!raw) return [];
    try {
      const storedBookmarks = JSON.parse(raw);
      const bookmarks = storedBookmarks.filter(bookmark => ![
        'swordmasters-youngest-son',
        'the-greatest-estate-developer',
        'apotheosis',
        'tales-of-demons-and-gods'
      ].includes(bookmark.comicId));
      if (bookmarks.length !== storedBookmarks.length) this.saveBookmarks(bookmarks);
      return bookmarks;
    } catch (e) {
      return [];
    }
  },

  saveBookmarks(bookmarks) {
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  },

  isBookmarked(comicId) {
    const bookmarks = this.getBookmarks();
    return bookmarks.some(b => b.comicId === comicId);
  },

  toggleBookmark(comicId, status = 'reading') {
    let bookmarks = this.getBookmarks();
    const index = bookmarks.findIndex(b => b.comicId === comicId);
    let isAdded = false;

    if (index !== -1) {
      bookmarks.splice(index, 1);
      isAdded = false;
    } else {
      const comic = this.getComicById(comicId);
      bookmarks.unshift({
        comicId,
        status: status,
        lastReadChapter: 1,
        dateAdded: 'Baru saja',
        hasNewChapter: false,
        newChapterBadge: comic ? `Ch. ${comic.latestChapter}` : ''
      });
      isAdded = true;
    }
    this.saveBookmarks(bookmarks);
    return isAdded;
  },

  removeBookmark(comicId) {
    let bookmarks = this.getBookmarks();
    bookmarks = bookmarks.filter(b => b.comicId !== comicId);
    this.saveBookmarks(bookmarks);
  },

  updateBookmarkProgress(comicId, chapterNum) {
    let bookmarks = this.getBookmarks();
    const item = bookmarks.find(b => b.comicId === comicId);
    if (item) {
      item.lastReadChapter = chapterNum;
      this.saveBookmarks(bookmarks);
    }
  },

  // --- RIWAYAT BACA (HISTORY) ---
  getHistory() {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) {
      const defaultHistory = [
        { comicId: 'solo-leveling-ragnarok', chapterNumber: 45, timestamp: Date.now() - 3600000, dateStr: '1 jam lalu', progress: 100 },
        { comicId: 'nano-machine', chapterNumber: 218, timestamp: Date.now() - 86400000, dateStr: 'Kemarin', progress: 100 },
        { comicId: 'lookism', chapterNumber: 490, timestamp: Date.now() - 172800000, dateStr: '2 hari lalu', progress: 85 }
      ];
      this.saveHistory(defaultHistory);
      return defaultHistory;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  },

  saveHistory(history) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  },

  recordHistory(comicId, chapterNumber, progress = 100) {
    let history = this.getHistory();
    history = history.filter(h => !(h.comicId === comicId && h.chapterNumber === chapterNumber));
    history.unshift({
      comicId,
      chapterNumber,
      timestamp: Date.now(),
      dateStr: 'Baru saja',
      progress
    });
    // Simpan maksimal 50 riwayat
    if (history.length > 50) history.pop();
    this.saveHistory(history);
    this.updateBookmarkProgress(comicId, chapterNumber);
  },

  // --- PROFIL USER ---
  getUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return { name: 'Tamu', username: '', email: '', level: 1, memberSince: '', isLoggedIn: false };
    try {
      const user = JSON.parse(raw);
      if (user.email === 'komikers.gacor@komik.id' || user.name === 'Komikers Gacor') {
        user.isLoggedIn = false;
        user.name = 'Tamu';
        this.saveUser(user);
      }
      return user;
    } catch (e) {
      return null;
    }
  },

  saveUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  // --- NOTIFIKASI ---
  getNotifications() {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    let storedNotifs = [];
    try {
      storedNotifs = raw ? JSON.parse(raw) : [];
    } catch (e) {
      storedNotifs = [];
    }
    const previousLookismUpdate = Array.isArray(storedNotifs)
      ? storedNotifs.find(notif => notif.comicId === 'lookism')
      : null;
    const lookismUpdate = {
      id: previousLookismUpdate?.id || 'lookism-chapter-update',
      title: 'Chapter Baru Dirilis!',
      message: 'Lookism Chapter 626 sudah dapat dibaca sekarang.',
      comicTitle: 'Lookism',
      comicId: 'lookism',
      chapter: 626,
      time: previousLookismUpdate?.time || 'Baru saja',
      unread: true
    };
    this.saveNotifications([lookismUpdate]);
    return [lookismUpdate];
  },

  saveNotifications(notifs) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
  },

  getComicReviews(comicId) {
    try { return JSON.parse(localStorage.getItem(`komik_id_reviews_${comicId}`) || '[]'); }
    catch (e) { return []; }
  },

  saveComicReview(comicId, review) {
    const reviews = this.getComicReviews(comicId);
    reviews.unshift({ ...review, date: new Date().toLocaleDateString('id-ID') });
    localStorage.setItem(`komik_id_reviews_${comicId}`, JSON.stringify(reviews.slice(0, 100)));
    return reviews;
  },

  markAllNotifsAsRead() {
    const notifs = this.getNotifications().map(n => ({ ...n, unread: false }));
    this.saveNotifications(notifs);
  }
};
