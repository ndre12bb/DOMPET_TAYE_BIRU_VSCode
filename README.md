# DOMPET TAYE — Tema Biru (HP & Desktop)

**Warna terbaru:** Biru royal dengan kartu saldo gradasi navy-biru. Semua fitur lama tetap berjalan.

**Untuk proyek lama yang sudah di VS Code/GitHub:** cukup gantikan `style.css` dan ubah tag `theme-color` di `index.html` menjadi `#2359d5` (opsional). JS tidak perlu diganti agar data browser lama tetap digunakan. `app.js` di paket baru hanya berubah warna header Excel, bukan logika/penyimpanan.

Aplikasi web untuk mencatat pengeluaran, menambahkan saldo, melihat sisa uang otomatis, dan ekspor laporan ke **Excel (.xlsx)**.

## Akun login lokal
- Username: `taye123`
- Password: `taye123`

> **Penting:** Ini hanya pengunci tampilan lokal. Username dan password ada di `app.js`, jadi bukan sistem autentikasi aman berbasis server. Jangan gunakan sebagai penyimpanan data sensitif.

## Cara menjalankan di VS Code
1. Ekstrak berkas ZIP dan buka folder `DOMPET_TAYE_BIRU_VSCode` di **Visual Studio Code** (`File` → `Open Folder`).
2. Buka `index.html` di browser. Alternatif: pasang ekstensi **Live Server** di VS Code, klik kanan `index.html` → **Open with Live Server**.
3. Login dengan akun di atas, lalu gunakan menu Beranda, Riwayat, dan Pengaturan.

## Cara membuka di HP
- Untuk akses langsung tanpa hosting, salin file `DOMPET_TAYE_HP_STANDALONE.html` yang disediakan terpisah ke HP, lalu buka lewat browser yang mendukung berkas HTML lokal.
- Agar bisa diakses dari HP mana pun, unggah isi folder ke hosting statis seperti GitHub Pages / Netlify, lalu buka URL-nya di HP. **Data tidak otomatis tersinkron antar perangkat.**
- Bila menggunakan **Live Server** di komputer dan ingin membuka dari HP pada jaringan yang sama, atur akses jaringan komputer dan alamat IP lokal. Untuk pemakaian jarak jauh, gunakan hosting.

## Fitur
- Desain responsif untuk HP dan komputer.
- Saldo awal dari menu Pengaturan.
- Tambah saldo: **cukup isi nominal**, tanggal otomatis hari ini dan keterangan otomatis `Tambah saldo`.
- Pengeluaran: tanggal, keterangan dan jumlah.
- Saldo berjalan otomatis, termasuk bila transaksi diedit atau dihapus.
- Riwayat dengan pencarian dan filter jenis/periode.
- Ekspor file `.xlsx` asli; bisa langsung dibuka dengan Excel atau aplikasi spreadsheet lain. Kolom: Tanggal, Keterangan, Jenis, Uang Masuk, Pengeluaran dan Sisa Uang.
- Backup dan restore JSON untuk migrasi antar browser/perangkat.
- Coba memigrasikan riwayat dari versi lama, apabila tersimpan pada **origin browser yang sama**.

## Struktur folder
```text
DOMPET_TAYE_BIRU_VSCode/
├── index.html   # Halaman dan komponen UI
├── style.css    # Tampilan responsif
├── app.js       # Login, logika saldo, transaksi, Excel
└── README.md    # Panduan ini
```

## Catatan penyimpanan
Data disimpan di `localStorage` browser/perangkat saat ini, bukan database online. Halaman yang dibuka dengan `file://` atau hosting memiliki penyimpanan berbeda. Data dari HP tidak otomatis muncul di laptop. Gunakan **backup JSON + pulihkan** untuk memindahkan data, dan ekspor Excel untuk arsip. Jika browser memblokir penyimpanan, aplikasi menampilkan peringatan dan data hanya ada selama halaman masih terbuka.

Semua aset dan fungsi ekspor Excel sudah berada di dalam proyek: tidak ada library CDN atau kebutuhan koneksi internet saat aplikasi berjalan.
