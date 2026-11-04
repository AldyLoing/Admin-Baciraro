export type SopMeta = {
  title: string;
  subtitle: string;
  version: string;
  effectiveDate: string;
  owner: string;
};

export type SopStage = {
  code: string;
  name: string;
  purpose: string;
  pic: string;
  steps: string[];
  output: string;
  evidence: string;
  qc: string;
};

export type WeightRule = {
  label: string;
  value: string;
  note: string;
};

export type SocialPlatform = {
  platform: string;
  format: string;
};

export type SopDocument = {
  id: string;
  label: string;
  storageKey: string;
  meta: SopMeta;
  rulesTitle: string;
  rules: WeightRule[];
  stages: SopStage[];
  stageNote: string;
  documentationRules: string[];
  socialPlatforms: SocialPlatform[];
  socialRules: string[];
  liveReportTitle: string;
  liveReportDescription: string;
  liveReportItems: string[];
  qcChecklist: string[];
  cleanupChecklist: string[];
};

export const sopMeta: SopMeta = {
  title: "SOP Produksi Piala Daur Ulang",
  subtitle:
    "Panduan kerja baku dari pemilahan bahan sampai piala siap dipublikasikan. Setiap tahap wajib menghasilkan output, bukti dokumentasi, dan lolos pemeriksaan mutu.",
  version: "v1.0",
  effectiveDate: "2 November 2026",
  owner: "Tim Produksi Baciraro",
};

export const weightRules: WeightRule[] = [
  {
    label: "Basis restock",
    value: "300 g / piala",
    note: "Setiap 1 piala jadi menimbulkan kewajiban restock 300 g bahan.",
  },
  {
    label: "Takaran oven",
    value: "500 g / cetakan",
    note: "Satu cetakan diisi 500 g adonan plastik yang sudah dicacah.",
  },
  {
    label: "Hasil per cetakan",
    value: "± 2 piala",
    note: "Rendemen normal 2 piala per cetakan (250 g per piala).",
  },
  {
    label: "Kebutuhan restock",
    value: "300 g × piala jadi",
    note: "Dicatat di live report, tanpa memotong stok secara otomatis.",
  },
  {
    label: "Susut proses",
    value: "± 50 g / piala",
    note: "Selisih 500 g per cetakan dengan 2 × 300 g dicatat sebagai susut proses.",
  },
];

export const sopStages: SopStage[] = [
  {
    code: "01",
    name: "Pilah",
    purpose:
      "Memisahkan bahan plastik yang layak dan menghitung kebutuhan bahan dengan basis 300 g per piala.",
    pic: "Tim Sortir",
    steps: [
      "Siapkan wadah terpisah untuk plastik layak, plastik kotor, dan non-plastik.",
      "Periksa jenis dan kondisi plastik: tidak bercampur sisa makanan, cairan, atau bahan berbahaya.",
      "Buang label, tutup logam, dan benda asing lainnya.",
      "Timbang plastik layak dan catat hasil pilahan.",
      "Hitung target piala: berat layak ÷ 300 g.",
      "Catat kekurangan atau kelebihan bahan pada live report.",
    ],
    output: "Plastik layak terpilah beserta catatan berat dan target piala.",
    evidence: "Foto bahan sebelum dan sesudah dipilah, serta foto timbangan.",
    qc: "Tidak ada kontaminan, berat tercatat, dan target piala dihitung benar.",
  },
  {
    code: "02",
    name: "Cuci",
    purpose: "Membersihkan bahan dari sisa kotoran agar aman diproses.",
    pic: "Tim Cuci",
    steps: [
      "Sortir ulang bahan saat proses cuci untuk memastikan tidak ada kontaminan.",
      "Cuci dengan air bersih dan sabun.",
      "Bilas hingga tidak ada sisa busa.",
      "Tiriskan bahan sebelum masuk tahap penjemuran.",
      "Catat kendala bila ada bahan yang sulit dibersihkan.",
    ],
    output: "Plastik bersih siap dijemur.",
    evidence: "Foto proses pencucian dan hasil akhir.",
    qc: "Tidak ada sisa sabun, kotoran, atau bau menyengat.",
  },
  {
    code: "03",
    name: "Jemur",
    purpose: "Menurunkan kadar air bahan sebelum dicacah.",
    pic: "Tim Cuci",
    steps: [
      "Bentangkan bahan pada rak atau alas bersih.",
      "Tempatkan di area berventilasi dan terkena sinar matahari.",
      "Balik bahan secara berkala agar kering merata.",
      "Pastikan bahan benar-benar kering sebelum diangkat.",
      "Catat durasi penjemuran.",
    ],
    output: "Plastik kering siap dicacah.",
    evidence: "Foto kondisi sebelum dan sesudah dijemur.",
    qc: "Tidak ada tetesan air, tidak lembap, dan tidak berjamur.",
  },
  {
    code: "04",
    name: "Cacah",
    purpose: "Menyeragamkan ukuran bahan agar mudah ditakar dan dioven.",
    pic: "Operator Cacah",
    steps: [
      "Siapkan mesin cacah dan periksa kondisinya.",
      "Gunakan alat pelindung diri sesuai prosedur.",
      "Masukkan bahan secara perlahan dan merata.",
      "Tampung serpihan pada wadah bersih.",
      "Pisahkan serpihan yang belum halus untuk dicacah ulang.",
      "Timbang hasil cacahan dan catat.",
    ],
    output: "Serpihan plastik seragam siap dikemas.",
    evidence: "Video singkat proses dan foto hasil cacahan.",
    qc: "Ukuran seragam dan tidak ada benda keras atau logam yang ikut tercacah.",
  },
  {
    code: "05",
    name: "Kemas Plastik",
    purpose: "Membagi bahan sesuai takaran oven agar proses produksi konsisten.",
    pic: "Tim Produksi",
    steps: [
      "Siapkan kantong kemas yang bersih dan kering.",
      "Timbang 500 g serpihan untuk setiap kantong.",
      "Beri label tanggal, berat, dan jenis bahan.",
      "Simpan kantong di tempat kering dan tertutup.",
      "Catat jumlah kantong yang dihasilkan.",
    ],
    output: "Kantong 500 g siap masuk oven.",
    evidence: "Foto kantong berlabel beserta timbangan.",
    qc: "Berat sesuai 500 g dengan toleransi 5 g dan label lengkap.",
  },
  {
    code: "06",
    name: "Oven",
    purpose: "Melelehkan dan membentuk bahan menjadi piala.",
    pic: "Operator Oven",
    steps: [
      "Panaskan oven sesuai prosedur dan suhu standar.",
      "Masukkan 500 g adonan ke setiap cetakan.",
      "Tutup dan tekan cetakan sesuai waktu standar.",
      "Keluarkan hasil dan dinginkan sebelum dibuka dari cetakan.",
      "Hitung hasil per cetakan (normalnya 2 piala) dan catat reject.",
    ],
    output: "Piala cetak mentah siap dipotong.",
    evidence: "Video proses oven dan foto hasil per cetakan.",
    qc: "Tidak ada gelembung besar atau retak, bentuk penuh, dan jumlah hasil dicatat.",
  },
  {
    code: "07",
    name: "Siapkan Siluet",
    purpose: "Menyediakan pola potong piala dan tatakan yang akurat.",
    pic: "Tim Desain",
    steps: [
      "Pilih file siluet sesuai model dan ukuran piala.",
      "Periksa skala cetak sebelum dicetak.",
      "Cetak siluet piala dan tatakan.",
      "Tempelkan pola pada bahan kerja.",
      "Pastikan posisi pola simetris dan tidak miring.",
      "Catat jumlah pola yang dicetak.",
    ],
    output: "Pola siluet piala dan tatakan siap dipakai.",
    evidence: "Foto file siluet, hasil print, dan pola yang sudah ditempel.",
    qc: "Skala benar, garis jelas, serta ukuran piala dan tatakan sesuai.",
  },
  {
    code: "08",
    name: "Potong Piala & Tatakan",
    purpose: "Memotong piala dan tatakan mengikuti siluet.",
    pic: "Tim Potong",
    steps: [
      "Gunakan alat pelindung diri saat memotong.",
      "Potong mengikuti garis siluet.",
      "Rapikan sisi kasar hasil potongan awal.",
      "Pisahkan piala dan tatakan sesuai kelompoknya.",
      "Hitung hasil potong dan catat reject.",
    ],
    output: "Piala dan tatakan terpotong sesuai pola.",
    evidence: "Video proses pemotongan dan foto hasil.",
    qc: "Tidak retak, potongan simetris, dan tidak ada sisa gerinda yang berbahaya.",
  },
  {
    code: "09",
    name: "Pasang Bout",
    purpose: "Menyambungkan tatakan ke piala agar kokoh.",
    pic: "Tim Perakitan",
    steps: [
      "Siapkan baut dan alat pemasang.",
      "Posisikan tatakan tepat di tengah piala.",
      "Pasang baut dari tatakan ke piala.",
      "Kencangkan secukupnya agar tidak retak.",
      "Uji goyang untuk memastikan sambungan kuat.",
      "Catat jumlah piala terpasang.",
    ],
    output: "Piala terpasang kokoh dengan tatakan.",
    evidence: "Foto sambungan dan video uji goyang.",
    qc: "Posisi center, kokoh, tidak goyang, dan tidak retak.",
  },
  {
    code: "10",
    name: "Amplas",
    purpose: "Merapikan permukaan piala untuk hasil akhir.",
    pic: "Tim Finishing",
    steps: [
      "Gunakan amplas bertahap dari kasar ke halus.",
      "Ratakan sambungan dan tepi piala.",
      "Bersihkan debu setelah pengamplasan.",
      "Periksa seluruh permukaan piala.",
      "Catat jumlah piala yang selesai diamplas.",
    ],
    output: "Piala halus siap masuk quality check.",
    evidence: "Foto kondisi sebelum dan sesudah diamplas.",
    qc: "Tidak ada sisi tajam, permukaan rata, dan tidak ada goresan kasar.",
  },
  {
    code: "11",
    name: "Quality Check",
    purpose: "Memastikan setiap piala lolos standar sebelum didokumentasikan.",
    pic: "Quality Control",
    steps: [
      "Periksa bentuk, sambungan, permukaan, dan kebersihan piala.",
      "Hitung jumlah piala lolos dan reject.",
      "Pisahkan piala reject beserta alasannya.",
      "Isi form QC: tanggal, operator, dan jumlah.",
      "Tandai piala yang lolos.",
      "Catat hasil QC pada live report.",
    ],
    output: "Piala lolos QC dan data reject tercatat.",
    evidence: "Foto per piala atau per batch dan form QC.",
    qc: "Semua kriteria lolos dan setiap reject tercatat alasannya.",
  },
  {
    code: "12",
    name: "Upload ke Web & Publikasi",
    purpose:
      "Mendokumentasikan bukti produksi, mencadangkan ke Drive, dan mempublikasikan konten ke media sosial.",
    pic: "Tim Dokumentasi",
    steps: [
      "Buka web dokumentasi (sistem terpisah, bukan Admin-Baciraro).",
      "Pilih nomor tahap 01–13, unggah foto atau video, isi tanggal dan operator.",
      "Pastikan setiap tahap memiliki minimal 1 foto; tahap 01, 06, 08, dan 11 wajib video.",
      "Salin tautan dokumentasi ke live report.",
      "Backup file ke Google Drive: Produksi/YYYY/MM/YYYYMMDD_PRJ-XXX/01-Pilah dan seterusnya.",
      "Sunting aset: carousel 5–10 foto dan reels vertikal 9:16 durasi 15–60 detik.",
      "Publikasikan carousel dan reels ke Instagram, Facebook, dan TikTok.",
      "Perbarui status posting per platform pada live report.",
    ],
    output: "Dokumentasi online, arsip Drive lengkap, dan konten terpublikasi.",
    evidence: "Tautan web dokumentasi, tautan folder Drive, dan tautan posting.",
    qc: "Semua tahap terdokumentasi, arsip Drive lengkap, dan 5 status posting terisi.",
  },
  {
    code: "13",
    name: "Clean Up Studio",
    purpose: "Mengembalikan studio ke kondisi bersih dan siap dipakai.",
    pic: "Seluruh Tim",
    steps: [
      "Matikan dan bersihkan semua alat.",
      "Buang sisa bahan sesuai kategori.",
      "Bersihkan meja kerja dan lantai.",
      "Kembalikan alat ke tempat penyimpanan.",
      "Cek stok bahan dan hitung kebutuhan restock.",
      "Catat kondisi akhir pada live report.",
      "Foto kondisi studio setelah dibersihkan.",
    ],
    output: "Studio bersih dan siap untuk produksi berikutnya.",
    evidence: "Foto kondisi studio sebelum dan sesudah clean up.",
    qc: "Tidak ada sisa bahan berserakan, alat bersih, dan kebutuhan restock tercatat.",
  },
];

export const documentationRules: string[] = [
  "Dokumentasi wajib dilakukan per tahap, bukan dikumpulkan di akhir.",
  "Minimal 1 foto untuk setiap tahap dan video pendek untuk tahap 01, 06, 08, dan 11.",
  "Upload dilakukan per tahap: buka web dokumentasi, pilih nomor tahap, unggah foto atau video, isi tanggal dan operator, lalu simpan dan salin tautannya.",
  "Penamaan file: YYYYMMDD_PRJ-XXX_01-pilah.jpg mengikuti nomor dan nama tahap.",
  "Panduan ukuran: foto maksimal 10 MB dan video maksimal 50 MB (aturan web dokumentasi, bukan validasi aplikasi ini).",
  "Backup manual ke Google Drive dengan struktur Produksi/YYYY/MM/YYYYMMDD_PRJ-XXX/01-Pilah dan seterusnya.",
  "Simpan aset final yang sudah diedit di Drive, bukan hanya file mentah.",
  "QC dinyatakan lolos hanya jika bukti seluruh tahap sudah diunggah.",
];

export const socialPlatforms: SocialPlatform[] = [
  { platform: "Instagram", format: "Carousel + Reels" },
  { platform: "Facebook", format: "Carousel + Reels" },
  { platform: "TikTok", format: "Reels" },
];

export const socialRules: string[] = [
  "Carousel: 5–10 foto proses dan hasil dengan rasio 4:5 atau 1:1.",
  "Reels: video vertikal 9:16, durasi 15–60 detik.",
  "Platform wajib: Instagram carousel, Instagram reels, Facebook carousel, Facebook reels, dan TikTok.",
  "Caption dan hashtag diseragamkan; tautan atau ajakan disesuaikan per platform.",
  "Konten tidak boleh dipublikasikan sebelum QC tahap 11 lolos dan dokumentasi lengkap.",
];

export const liveReportFields: string[] = [
  "Tanggal produksi",
  "Jumlah piala jadi",
  "Berat bahan terpakai",
  "Kebutuhan restock (300 g × piala jadi)",
  "Kendala produksi",
  "Tautan dokumentasi web dan Drive",
  "Status posting: IG carousel, IG reels, FB carousel, FB reels, TikTok",
];

export const qcChecklist: string[] = [
  "Bahan sudah dipilah dan bebas kontaminan.",
  "Berat bahan dan hasil cacahan sudah dicatat.",
  "Takaran oven 500 g per cetakan terpenuhi.",
  "Piala tidak retak, tidak gelembung besar, dan bentuk penuh.",
  "Siluet piala dan tatakan terpasang simetris.",
  "Baut tatakan terpasang center dan tidak goyang.",
  "Permukaan sudah diamplas dan bebas sisi tajam.",
  "Dokumentasi semua tahap sudah diunggah dan diarsipkan ke Drive.",
];

export const cleanupChecklist: string[] = [
  "Alat produksi dimatikan dan dibersihkan.",
  "Sisa bahan dibuang sesuai kategori.",
  "Meja kerja dan lantai bersih.",
  "Alat dikembalikan ke tempat penyimpanan.",
  "Kebutuhan restock bahan sudah dihitung.",
  "Live report dan foto kondisi akhir sudah diperbarui.",
];

export const pialaSop: SopDocument = {
  id: "piala",
  label: "Piala",
  storageKey: "sop-produksi-checks-v1",
  meta: sopMeta,
  rulesTitle: "Aturan Berat",
  rules: weightRules,
  stages: sopStages,
  stageNote: "Setiap tahap wajib menghasilkan bukti dokumentasi sebelum lanjut.",
  documentationRules,
  socialPlatforms,
  socialRules,
  liveReportTitle: "Live Report Harian",
  liveReportDescription: "Diperbarui setiap selesai produksi, minimal berisi kolom berikut.",
  liveReportItems: liveReportFields,
  qcChecklist,
  cleanupChecklist,
};
