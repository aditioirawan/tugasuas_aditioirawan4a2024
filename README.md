KOMIK.ID

KOMIK.ID adalah website katalog dan pembaca komik. Pengunjung dapat mencari komik, melihat detail dan chapter, membaca gambar secara vertikal, serta menyimpan bookmark.

MENJALANKAN WEBSITE

Buka folder proyek ini di Visual Studio Code.

Pasang ekstensi Live Server jika belum tersedia.

Buka index.html, lalu klik Go Live di kanan bawah VS Code.

Website akan terbuka di browser. Untuk mencoba dari HP, sambungkan HP dan laptop ke Wi-Fi yang sama, lalu buka alamat jaringan laptop yang digunakan Live Server.

Website ini tidak memerlukan proses build atau instalasi package.

CARA MENGGUNAKAN

Beranda: lihat komik pilihan, komik populer, dan pembaruan terbaru.

Browse: cari judul, lalu saring koleksi berdasarkan tipe, status, genre, atau urutan.

Detail komik: klik poster untuk melihat sinopsis, informasi, bookmark, dan daftar chapter.

Membaca: pilih chapter untuk membuka gambar. Gulir ke bawah untuk melanjutkan. Gunakan panah untuk pindah chapter dan pilihan di tengah untuk memilih chapter tertentu.

Bookmark dan akun: daftar atau masuk untuk menggunakan bookmark dan fitur akun. Data akun dan bookmark demo tersimpan di browser yang sedang digunakan.

MENAMBAHKAN GAMBAR CHAPTER

Data komik ada di js/data.js. Gunakan ID komik sebagai nama folder, lalu buat subfolder dengan format chapter-nomor di assets/comics.

Contoh untuk ID komik solo-leveling-ragnarok:

assets/comics/solo-leveling-ragnarok/chapter-1/001.png

assets/comics/solo-leveling-ragnarok/chapter-1/002.png

assets/comics/solo-leveling-ragnarok/chapter-2/001.webp

Format gambar yang didukung adalah PNG, JPG, JPEG, dan WebP. Nomori gambar berurutan dengan tiga digit, seperti 001, 002, 003, tanpa spasi. Reader memuat gambar sampai nomor berikutnya tidak ditemukan.

STRUKTUR FOLDER

index.html - halaman utama website

css/ - tampilan dan aturan responsif

js/ - navigasi, data komik, akun, dan reader

assets/covers/ - gambar cover komik

assets/banners/ - gambar banner komik

assets/comics/ - gambar halaman chapter

CATATAN

Akun dan Google login pada proyek ini merupakan simulasi untuk demonstrasi. Keduanya belum terhubung ke server atau autentikasi Google sungguhan.

Akun, bookmark, dan riwayat baca disimpan secara lokal di browser. Data tersebut tidak otomatis berpindah ke perangkat atau browser lain.
