/**
 * KOMIK.ID - Webtoon & Manga Reader Mode
 * Pembaca komik panel vertikal layar penuh dengan navigasi chapter,
 * indikator progress scroll, dan perekaman riwayat baca otomatis.
 */

const Reader = {
  currentComic: null,
  currentChapterNum: 1,
  panelRenderToken: 0,

  init() {
    this.readerView = document.getElementById('readerView');
    this.panelsContainer = document.getElementById('readerPanels');
    this.titleEl = document.getElementById('readerComicTitle');
    this.chapterSubtitleEl = document.getElementById('readerChapterSubtitle');
    this.chapterSelect = document.getElementById('readerChapterSelect');
    this.btnBack = document.getElementById('btnBackFromReader');
    this.btnPrev = document.getElementById('btnPrevChapter');
    this.btnNext = document.getElementById('btnNextChapter');
    this.progressBar = document.getElementById('readerProgressBar');

    this.bindEvents();
  },

  bindEvents() {
    if (this.btnBack) {
      this.btnBack.addEventListener('click', (e) => {
        e.preventDefault();
        App.goBack();
      });
    }

    if (this.chapterSelect) {
      this.chapterSelect.addEventListener('change', (e) => {
        const selectedCh = parseInt(e.target.value, 10);
        if (selectedCh && this.currentComic) {
          this.open(this.currentComic.id, selectedCh);
        }
      });
    }

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => {
        if (this.currentComic) {
          const chapters = this.currentComic.chapters || [];
          const index = chapters.findIndex(ch => ch.number === this.currentChapterNum);
          if (index > 0) this.open(this.currentComic.id, chapters[index - 1].number);
        }
      });
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => {
        if (this.currentComic) {
          const chapters = this.currentComic.chapters || [];
          const index = chapters.findIndex(ch => ch.number === this.currentChapterNum);
          if (index >= 0 && index < chapters.length - 1) this.open(this.currentComic.id, chapters[index + 1].number);
        }
      });
    }

    // Progress bar saat scroll
    window.addEventListener('scroll', () => {
      if (!this.readerView.classList.contains('active')) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const scrolled = (window.scrollY / docHeight) * 100;
        if (this.progressBar) {
          this.progressBar.style.width = `${Math.min(100, Math.max(0, scrolled))}%`;
        }
      }
    });
  },

  open(comicId, chapterNum = 1) {
    const comic = StorageManager.getComicById(comicId);
    if (!comic) return;

    this.currentComic = comic;
    this.currentChapterNum = parseInt(chapterNum, 10) || 1;

    // Update header info
    if (this.titleEl) this.titleEl.textContent = comic.title;
    if (this.chapterSubtitleEl) this.chapterSubtitleEl.textContent = `Chapter ${this.currentChapterNum}`;

    // Populate dropdown chapter
    if (this.chapterSelect) {
      this.chapterSelect.innerHTML = '';
      (comic.chapters || []).forEach(chapter => {
        const opt = document.createElement('option');
        opt.value = chapter.number;
        opt.textContent = chapter.title;
        if (chapter.number === this.currentChapterNum) opt.selected = true;
        this.chapterSelect.appendChild(opt);
      });
    }

    // Tombol prev & next disable state
    if (this.btnPrev) {
      const chapterIndex = (comic.chapters || []).findIndex(ch => ch.number === this.currentChapterNum);
      this.btnPrev.disabled = chapterIndex <= 0;
      this.btnPrev.classList.toggle('disabled', chapterIndex <= 0);
    }
    if (this.btnNext) {
      const chapterIndex = (comic.chapters || []).findIndex(ch => ch.number === this.currentChapterNum);
      const noNextChapter = chapterIndex < 0 || chapterIndex >= comic.chapters.length - 1;
      this.btnNext.disabled = noNextChapter;
      this.btnNext.classList.toggle('disabled', noNextChapter);
    }

    // Render Panels Vertikal
    this.renderPanels(comic, this.currentChapterNum);

    // Scroll ke atas
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Rekam riwayat baca otomatis
    StorageManager.recordHistory(comic.id, this.currentChapterNum, 100);

    // Tampilkan reader view
    App.switchViewElement('readerView');
  },

  renderPanels(comic, chapterNum) {
    this.panelsContainer.innerHTML = '';

    // Header info dalam reader
    const introDiv = document.createElement('div');
    introDiv.className = 'reader-intro-banner';
    introDiv.innerHTML = `
      <div class="reader-badge-pill">${comic.type.toUpperCase()} • ${comic.countryCode}</div>
      <h2 class="reader-intro-title">${comic.title}</h2>
      <p class="reader-intro-sub">Chapter ${chapterNum} • Halaman dari koleksi lokal</p>
    `;
    this.panelsContainer.appendChild(introDiv);

    const renderToken = ++this.panelRenderToken;
    this.loadLocalChapterPages(comic, chapterNum, renderToken);
  },

  loadLocalChapterPages(comic, chapterNum, renderToken, pageNumber = 1, extensionIndex = 0) {
    if (renderToken !== this.panelRenderToken) return;
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    const folder = `assets/comics/${comic.id}/chapter-${chapterNum}`;
    const paddedPage = String(pageNumber).padStart(3, '0');
    const chapter = (comic.chapters || []).find(item => item.number === Number(chapterNum));
    const listedPage = chapter?.pages?.[pageNumber - 1];
    if (chapter?.pages && !listedPage) {
      this.appendChapterEndCard(comic, chapterNum);
      return;
    }
    let currentExtensionIndex = extensionIndex;
    const image = document.createElement('img');
    image.className = 'reader-panel-img';
    image.alt = `${comic.title} Chapter ${chapterNum}`;
    image.onload = () => {
      if (renderToken !== this.panelRenderToken) return;
      const panel = document.createElement('div');
      panel.className = 'reader-panel-item';
      panel.appendChild(image);
      this.panelsContainer.appendChild(panel);
      this.loadLocalChapterPages(comic, chapterNum, renderToken, pageNumber + 1, 0);
    };
    image.onerror = () => {
      if (renderToken !== this.panelRenderToken) return;
      if (listedPage) {
        if (pageNumber === 1) {
          const empty = document.createElement('div');
          empty.className = 'reader-chapter-empty';
          empty.innerHTML = `<span class="reader-empty-lock">▧</span><h3>Halaman chapter tidak ditemukan</h3><p>Periksa kembali file gambar untuk Chapter ${chapterNum}.</p>`;
          this.panelsContainer.appendChild(empty);
        } else this.appendChapterEndCard(comic, chapterNum);
        return;
      }
      if (currentExtensionIndex + 1 < extensions.length) {
        currentExtensionIndex += 1;
        image.src = `${folder}/${paddedPage}.${extensions[currentExtensionIndex]}`;
        return;
      }
      if (pageNumber === 1) {
        const empty = document.createElement('div');
        empty.className = 'reader-chapter-empty';
        empty.innerHTML = `<span class="reader-empty-lock">▧</span><h3>Halaman chapter belum ditambahkan</h3><p>Simpan gambar sebagai <b>001.png, 002.png, 003.png</b> dan seterusnya di folder:</p><code>${folder}/</code>`;
        this.panelsContainer.appendChild(empty);
        return;
      }
      this.appendChapterEndCard(comic, chapterNum);
    };
    image.src = listedPage || `${folder}/${paddedPage}.${extensions[currentExtensionIndex]}`;
  },

  appendChapterEndCard(comic, chapterNum) {
    const endCard = document.createElement('div');
    endCard.className = 'reader-end-card';
    endCard.innerHTML = `
      <div class="end-icon">🎉</div>
      <h3>Kamu telah menyelesaikan Chapter ${chapterNum}!</h3>
      <p>Lanjutkan ke chapter berikutnya atau berikan komentar dan rating untuk author.</p>
      <div class="end-card-actions">
        <button class="btn-cyan-secondary" onclick="window.scrollTo({ top: 0, behavior: 'smooth' })">
          ↑ Kembali ke atas
        </button>
        ${(comic.chapters || []).some(ch => ch.number > chapterNum) ? `
          <button class="btn-cyan-primary" onclick="Reader.open('${comic.id}', ${comic.chapters.find(ch => ch.number > chapterNum).number})">
            Lanjut Chapter ${comic.chapters.find(ch => ch.number > chapterNum).number} →
          </button>
        ` : `
          <button class="btn-cyan-secondary" disabled>Chapter Terbaru Sudah Dibaca</button>
        `}
        <button class="btn-cyan-ghost" onclick="App.goBack()">
          Kembali ke Detail Komik
        </button>
      </div>
      <form class="reader-review-form" data-comic-id="${comic.id}">
        <h4>Beri rating untuk ${comic.title}</h4>
        <div class="reader-rating-stars" role="radiogroup" aria-label="Pilih rating 1 sampai 5">
          ${[1,2,3,4,5].map(n => `<button type="button" class="reader-rating-star" data-rating="${n}" aria-label="${n} bintang">★</button>`).join('')}
        </div>
        <textarea class="reader-review-comment" maxlength="500" placeholder="Tulis ulasanmu (opsional)..." aria-label="Ulasan"></textarea>
        <button type="submit" class="btn-cyan-primary" disabled>Kirim rating &amp; ulasan</button>
        <p class="reader-review-feedback" aria-live="polite"></p>
      </form>
    `;
    this.panelsContainer.appendChild(endCard);
    let chosenRating = 0;
    const reviewForm = endCard.querySelector('.reader-review-form');
    const stars = [...endCard.querySelectorAll('.reader-rating-star')];
    const submit = reviewForm.querySelector('[type="submit"]');
    stars.forEach(star => star.addEventListener('click', () => {
      chosenRating = Number(star.dataset.rating);
      stars.forEach(item => item.classList.toggle('selected', Number(item.dataset.rating) <= chosenRating));
      submit.disabled = false;
    }));
    reviewForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!chosenRating) return;
      const comment = reviewForm.querySelector('.reader-review-comment').value.trim();
      App.submitComicReview(comic.id, chosenRating, comment);
      reviewForm.querySelector('.reader-review-feedback').textContent = 'Terima kasih! Rating dan ulasanmu tersimpan.';
      submit.disabled = true;
      stars.forEach(star => star.disabled = true);
      reviewForm.querySelector('.reader-review-comment').disabled = true;
    });
  }
};
