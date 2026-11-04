// Sekali jalan: buat project "Pemilihan Nyong Noni UNIMA 2026".
// Pakai: node --env-file=.env.local scripts/create-nyong-noni-unima-2026.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const NAME = "Pemilihan Nyong Noni UNIMA 2026";
const CLIENT = "Panitia Pemilihan Nyong Noni UNIMA 2026";
const TOTAL_VALUE = 2400000;
const DESCRIPTION = [
  "Sponsorship Pemilihan Nyong Noni UNIMA 2026.",
  "24 Infinite Book sebagai sponsor gratis, diserahkan Senin 9 November 2026.",
  "24 piala @ Rp100.000 = Rp2.400.000, diserahkan sebelum 26 November 2026 (paling lambat 25 November 2026).",
  "Bahan daur ulang: tutup botol plastik saja.",
  "SOP: /admin/sop pilihan Infinite Book dan Piala. Dokumentasi di setiap tahap, Story kegiatan, upload web dan publikasi setelah clean up.",
].join("\n");

const MEMBERS = [
  {
    member_id: 6,
    name: "Aldy Loing",
    percent: 20,
    tugas:
      "Koordinasi project dan spesifikasi; timbang & siapkan sitpress; press lembaran sampul; laminasi opsional; cetak isi bila perlu; pengemasan; clean up; upload web.",
  },
  {
    member_id: 14,
    name: "Owen Kalumata",
    percent: 20,
    tugas:
      "Pilah, jemur, dan cacah tutup botol; potong 48 sampul; lubang sampul; potong piala; amplas; dokumentasi tahap saat Given bekerja.",
  },
  {
    member_id: 16,
    name: "Calvin Kakase",
    percent: 20,
    tugas:
      "Cuci tutup botol; kesiapan alat; finishing sampul; lubang isi; pasang spiral; potong tatakan; pasang baut; amplas; perbaikan hasil QC.",
  },
  {
    member_id: 9,
    name: "Given Tambalean",
    percent: 20,
    tugas:
      "Desain isi buku dan siluet piala; cetak & potong isi; dokumentasi setiap tahap; Story kegiatan; bantu kemas; arsip Drive; publikasi.",
  },
  {
    member_id: 1,
    name: "Marlon Kamagi",
    percent: 20,
    tugas:
      "Quality Control saja: QC tengah proses bila perlu, QC akhir 24 buku dan 24 piala, tentukan lolos/perbaikan/reject, periksa ulang hasil perbaikan. Tidak produksi, kemas, clean up, atau dokumentasi.",
  },
];

const BOOK_DUE = {
  "01": "2026-11-05",
  "02": "2026-11-05",
  "03": "2026-11-05",
  "04": "2026-11-06",
  "05": "2026-11-06",
  "06": "2026-11-06",
  "07": "2026-11-07",
  "08": "2026-11-07",
  "09": "2026-11-07",
  "10": "2026-11-07",
  "11": "2026-11-07",
  "12": "2026-11-08",
  "13": "2026-11-08",
  "14": "2026-11-08",
  "15": "2026-11-08",
  "16": "2026-11-08",
  "17": "2026-11-08",
};

const TROPHY_DUE = {
  "01": "2026-11-10",
  "02": "2026-11-10",
  "03": "2026-11-11",
  "04": "2026-11-11",
  "05": "2026-11-12",
  "06": "2026-11-12",
  "07": "2026-11-13",
  "08": "2026-11-16",
  "09": "2026-11-18",
  "10": "2026-11-19",
  "11": "2026-11-20",
  "PACK": "2026-11-21",
  "12": "2026-11-23",
  "13": "2026-11-24",
};

const BOOK_TASKS = [
  {
    code: "01",
    title: "Infinite Book 01 - Tentukan spesifikasi",
    assigned_to: 6,
    priority: "high",
    description:
      "Pelaksana: Aldy mengonfirmasi ukuran buku, jumlah halaman, varian laminasi/tanpa laminasi, ketebalan sampul, spiral, dan kebutuhan panitia. Given membuat desain serta file persetujuan.\n\nDokumentasi: Given memotret atau menangkap layar spesifikasi dan desain yang disetujui.\nQC tahap: ukuran, halaman, varian, sampul, ketebalan, dan spiral disetujui sebelum produksi.",
  },
  {
    code: "02",
    title: "Infinite Book 02 - Pilah tutup botol",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen memilih jenis tutup botol yang sesuai proses dan mengelompokkan warna. Given melepas segel/lapisan dalam, menyingkirkan benda asing, dan memisahkan bahan tidak layak.\n\nDokumentasi: Aldy memotret sebelum-sesudah pemilahan, timbangan, dan video singkat.\nQC tahap: hanya jenis tutup botol yang disetujui, bebas kontaminan, berat tercatat.",
  },
  {
    code: "03",
    title: "Infinite Book 03 - Cuci tutup botol",
    assigned_to: 16,
    priority: "high",
    description:
      "Pelaksana: Calvin mencuci bagian luar, bagian dalam, dan ulir. Aldy membilas hingga bersih dan meniriskan.\n\nDokumentasi: Given memotret proses cuci dan kondisi setelah dibilas.\nQC tahap: tidak ada kotoran atau sisa sabun.",
  },
  {
    code: "04",
    title: "Infinite Book 04 - Jemur tutup botol",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen menata dan membalik tutup botol agar bagian dalam ikut kering. Calvin memeriksa kekeringan dan memindahkan bahan ke wadah bersih.\n\nDokumentasi: Given memotret penataan awal dan bahan kering.\nQC tahap: tidak ada bagian lembap sebelum dicacah.",
  },
  {
    code: "05",
    title: "Infinite Book 05 - Cacah tutup botol",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen memeriksa dan mengoperasikan mesin cacah sesuai prosedur. Aldy menyiapkan bahan, menimbang hasil setelah proses aman, dan menyimpan cacahan per kelompok bahan/warna.\n\nDokumentasi: Given mengambil video proses dari posisi aman, foto hasil cacahan dan timbangan.\nQC tahap: ukuran sesuai, bebas benda asing, berat tercatat.",
  },
  {
    code: "06",
    title: "Infinite Book 06 - Timbang & siapkan sitpress",
    assigned_to: 6,
    priority: "high",
    description:
      "Pelaksana: Aldy menimbang dan menata cacahan sesuai spesifikasi lembaran. Calvin memeriksa mesin, perlengkapan, kelistrikan, dan area kerja.\n\nDokumentasi: Given memotret timbangan, penataan bahan, dan kesiapan alat.\nQC tahap: takaran sesuai spesifikasi, alat aman, parameter tervalidasi.",
  },
  {
    code: "07",
    title: "Infinite Book 07 - Press & dinginkan lembaran",
    assigned_to: 6,
    priority: "high",
    description:
      "Pelaksana: Aldy mengoperasikan sitpress dengan parameter yang disetujui, melakukan pendinginan sesuai prosedur, dan memeriksa lembaran.\n\nDokumentasi: Given mengambil video proses sitpress dari luar zona panas dan foto hasil lembaran.\nQC tahap: lembaran menyatu, rata, ketebalan sesuai, bebas cacat.",
  },
  {
    code: "08",
    title: "Infinite Book 08 - Potong sampul",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen menandai pola dan memotong 48 sampul layak pakai untuk 24 buku (24 depan dan 24 belakang).\n\nDokumentasi: Given memotret pola dan hasil potong serta video pemotongan dari posisi aman.\nQC tahap: ukuran, orientasi, dan pasangan sampul sesuai, tidak retak.",
  },
  {
    code: "09",
    title: "Infinite Book 09 - Finishing sampul",
    assigned_to: 16,
    priority: "medium",
    description:
      "Pelaksana: Calvin menghaluskan tepi dan sudut serta membersihkan serpihan. Owen memeriksa kembali ukuran dan kesesuaian pasangan sampul.\n\nDokumentasi: Given memotret sebelum-sesudah finishing.\nQC tahap: tidak ada sisi tajam, serpihan lepas, atau retak.",
  },
  {
    code: "10",
    title: "Infinite Book 10 - Cetak & potong isi",
    assigned_to: 9,
    priority: "high",
    description:
      "Pelaksana: Given memeriksa contoh cetak, mencetak, memotong, menyusun, dan menghitung isi 24 buku. Aldy membantu bila diperlukan.\n\nDokumentasi: Aldy memotret contoh cetak, proses potong, dan susunan isi.\nQC tahap: cetakan terbaca, urutan dan jumlah halaman benar.",
  },
  {
    code: "11",
    title: "Infinite Book 11 - Laminasi opsional",
    assigned_to: 6,
    priority: "medium",
    description:
      "Pelaksana: Aldy melaminasi, mendinginkan, dan merapikan tepi tanpa merusak segel. Marlon memeriksa daya rekat dan uji tulis-hapus. Untuk varian tanpa laminasi, tandai Tidak berlaku.\n\nDokumentasi: Given memotret hasil dan segel tepi serta video uji tulis-hapus; untuk tanpa laminasi foto isi biasa dan penanda Tidak berlaku.\nQC tahap: laminasi melekat, segel utuh, uji tulis-hapus lolos.",
  },
  {
    code: "12",
    title: "Infinite Book 12 - Lubangi sampul & isi",
    assigned_to: 16,
    priority: "medium",
    description:
      "Pelaksana: Owen melubangi sampul. Calvin melubangi isi dan mencocokkan keselarasan dengan sampul. Area lubang tidak merusak segel laminasi.\n\nDokumentasi: Given memotret pengaturan pola, hasil lubang, dan keselarasan.\nQC tahap: lubang sejajar, bersih, tidak sobek atau retak.",
  },
  {
    code: "13",
    title: "Infinite Book 13 - Pasang spiral",
    assigned_to: 16,
    priority: "high",
    description:
      "Pelaksana: Calvin menyusun sampul dan isi, memasang spiral, mengamankan ujungnya, dan menguji kelancaran halaman.\n\nDokumentasi: Given memotret hasil jilid serta video pemasangan atau uji balik halaman.\nQC tahap: urutan benar, spiral kokoh, ujung aman, halaman lancar.",
  },
  {
    code: "14",
    title: "Infinite Book 14 - Quality Check",
    assigned_to: 1,
    priority: "high",
    description:
      "Pelaksana: Marlon memeriksa seluruh 24 buku dan menetapkan lolos/perlu perbaikan/reject. Perbaikan dikerjakan PIC terkait, lalu Marlon memeriksa ulang. Marlon hanya QC.\n\nDokumentasi: Given memotret pemeriksaan, video QC, dan video uji tulis-hapus untuk laminasi.\nQC tahap: semua kriteria fisik dan fungsi varian terpenuhi.",
  },
  {
    code: "15",
    title: "Infinite Book 15 - Kemas",
    assigned_to: 9,
    priority: "medium",
    description:
      "Pelaksana: Given menyiapkan identitas varian, petunjuk penggunaan, dan kemasan. Aldy menghitung serta mengemas 24 buku lolos QC tanpa merusak spiral.\n\nDokumentasi: Owen memotret proses pengemasan, label varian, dan hasil kemasan.\nQC tahap: varian benar, kemasan memadai, tidak ada klaim yang belum diuji.",
  },
  {
    code: "16",
    title: "Infinite Book 16 - Clean Up Studio",
    assigned_to: 6,
    priority: "medium",
    description:
      "Pelaksana: Aldy membersihkan sitpress dan area laminasi; Owen mesin cacah dan area potong; Calvin area finishing dan penjilidan; Given area cetak dan kemasan. Pastikan alat aman sebelum dibersihkan.\n\nDokumentasi: Given memotret kondisi akhir setiap area setelah pembersihan.\nQC tahap: alat aman, area bersih, sisa bahan tertangani.",
  },
  {
    code: "17",
    title: "Infinite Book 17 - Upload web, arsip & publikasi",
    assigned_to: 9,
    priority: "high",
    description:
      "Pelaksana: Aldy mengunggah dokumentasi lengkap ke web setelah clean up. Given mengarsipkan file mentah dan hasil edit ke Drive, mengedit, dan mempublikasikan ke media sosial.\n\nDokumentasi: Aldy menangkap tautan web; Given memotret folder Drive dan menangkap tautan publikasi.\nQC tahap: semua tahap terdokumentasi, arsip lengkap, publikasi setelah QC dan dokumentasi lengkap.",
  },
];

const TROPHY_TASKS = [
  {
    code: "01",
    title: "Piala 01 - Pilah tutup botol",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen memilih jenis tutup botol yang sesuai proses piala dan mengelompokkan warna. Given melepas segel/lapisan dalam, menyingkirkan benda asing, dan memisahkan bahan tidak layak.\n\nDokumentasi: Aldy memotret sebelum-sesudah pemilahan, timbangan, dan video singkat.\nQC tahap: jenis sesuai, bebas kontaminan, berat tercatat.",
  },
  {
    code: "02",
    title: "Piala 02 - Cuci tutup botol",
    assigned_to: 16,
    priority: "high",
    description:
      "Pelaksana: Calvin mencuci bagian luar, bagian dalam, dan ulir. Aldy membilas hingga bersih dan meniriskan.\n\nDokumentasi: Given memotret proses cuci dan hasil bilasan.\nQC tahap: tidak ada kotoran atau sisa sabun.",
  },
  {
    code: "03",
    title: "Piala 03 - Jemur tutup botol",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen menata dan membalik tutup botol. Calvin memeriksa kekeringan dan menyimpan bahan kering di wadah bersih.\n\nDokumentasi: Given memotret penjemuran dan bahan kering.\nQC tahap: tidak ada bagian lembap.",
  },
  {
    code: "04",
    title: "Piala 04 - Cacah tutup botol",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen memeriksa dan mengoperasikan mesin cacah sesuai prosedur. Aldy menyiapkan bahan, menimbang hasil setelah proses aman, dan menyimpan cacahan.\n\nDokumentasi: Given mengambil video proses dari posisi aman serta foto hasil dan timbangan.\nQC tahap: ukuran sesuai, bebas benda asing, berat tercatat.",
  },
  {
    code: "05",
    title: "Piala 05 - Kemas cacahan",
    assigned_to: 6,
    priority: "high",
    description:
      "Pelaksana: Aldy menimbang, mengemas, dan memberi label cacahan sesuai takaran proses pada SOP piala.\n\nDokumentasi: Given memotret kantong berlabel beserta timbangan.\nQC tahap: berat sesuai toleransi dan label lengkap.",
  },
  {
    code: "06",
    title: "Piala 06 - Oven",
    assigned_to: 6,
    priority: "high",
    description:
      "Pelaksana: Calvin memeriksa kesiapan alat sebelum digunakan. Aldy menjalankan pembentukan sesuai prosedur, melakukan pendinginan, dan memeriksa hasil awal.\n\nDokumentasi: Given mengambil video proses oven dari posisi aman serta foto hasil per cetakan.\nQC tahap: tidak retak atau gelembung besar, bentuk penuh, hasil dicatat.",
  },
  {
    code: "07",
    title: "Piala 07 - Siapkan siluet",
    assigned_to: 9,
    priority: "high",
    description:
      "Pelaksana: Aldy mengonfirmasi kebutuhan dan persetujuan panitia. Given membuat desain, memeriksa skala, mencetak, dan menyiapkan pola piala serta tatakan. Persetujuan desain diperoleh sebelum pemotongan.\n\nDokumentasi: Aldy memotret file desain, hasil cetak pola, dan penempatan pola.\nQC tahap: skala benar, pola simetris, ukuran sesuai.",
  },
  {
    code: "08",
    title: "Piala 08 - Potong piala & tatakan",
    assigned_to: 14,
    priority: "high",
    description:
      "Pelaksana: Owen memotong bentuk utama piala. Calvin memotong tatakan sesuai pola.\n\nDokumentasi: Given mengambil video pemotongan dan foto hasil keduanya.\nQC tahap: tidak retak, potongan simetris, sisa potongan aman.",
  },
  {
    code: "09",
    title: "Piala 09 - Pasang baut",
    assigned_to: 16,
    priority: "high",
    description:
      "Pelaksana: Calvin menentukan posisi sambungan, membuat lubang, memasang baut, dan memeriksa posisi serta kekokohan tatakan.\n\nDokumentasi: Given memotret sambungan dan video uji goyang.\nQC tahap: posisi center, kokoh, tidak goyang, tidak retak.",
  },
  {
    code: "10",
    title: "Piala 10 - Amplas",
    assigned_to: 16,
    priority: "medium",
    description:
      "Pelaksana: Owen menghaluskan bentuk utama dan tepi piala. Calvin menghaluskan tatakan dan sambungan. Keduanya membersihkan debu hasil pengerjaan masing-masing.\n\nDokumentasi: Given memotret sebelum-sesudah amplas.\nQC tahap: tidak ada sisi tajam, permukaan rata.",
  },
  {
    code: "11",
    title: "Piala 11 - Quality Check",
    assigned_to: 1,
    priority: "high",
    description:
      "Pelaksana: Marlon memeriksa seluruh 24 piala, termasuk bentuk, kondisi bahan, kesimetrisan, sambungan, kestabilan, permukaan, dan kebersihan. Marlon menetapkan lolos/perlu perbaikan/reject serta memeriksa ulang hasil perbaikan. Marlon hanya QC.\n\nDokumentasi: Given memotret per batch, catatan reject, dan video pemeriksaan.\nQC tahap: semua kriteria lolos, reject tercatat.",
  },
  {
    code: "PACK",
    title: "Piala - Kemas setelah QC",
    assigned_to: 9,
    priority: "medium",
    description:
      "Pelaksana: Given menyiapkan label dan kemasan pelindung. Aldy menghitung dan mengemas 24 piala yang sudah lolos QC. Pengemasan dilakukan sebelum clean up.\n\nDokumentasi: Owen memotret proses pengemasan dan hasil kemasan akhir.\nQC tahap: hanya produk lolos QC, kemasan memadai.",
  },
  {
    code: "12",
    title: "Piala 12 - Clean Up Studio",
    assigned_to: 6,
    priority: "medium",
    description:
      "Pelaksana: Aldy membersihkan oven dan area pembentukan; Owen mesin cacah dan area potong; Calvin area perakitan dan amplas; Given area desain, cetak, dan kemasan. Pastikan alat aman sebelum dibersihkan.\n\nDokumentasi: Given memotret kondisi akhir setiap area setelah pembersihan.\nQC tahap: alat aman, area bersih, sisa bahan tertangani.",
  },
  {
    code: "13",
    title: "Piala 13 - Upload web & publikasi",
    assigned_to: 9,
    priority: "high",
    description:
      "Pelaksana: Aldy mengunggah dokumentasi lengkap ke web setelah clean up. Given mengarsipkan file ke Drive, mengedit, dan mempublikasikan ke media sosial.\n\nDokumentasi: Aldy menangkap tautan web; Given memotret folder Drive dan menangkap tautan publikasi.\nQC tahap: semua tahap terdokumentasi, publikasi setelah QC dan dokumentasi lengkap.",
  },
];

const HANDOVER_TASKS = [
  {
    title: "Serahkan 24 Infinite Book ke Panitia Nyong Noni UNIMA 2026",
    assigned_to: 6,
    due_date: "2026-11-09",
    priority: "high",
    description:
      "Penyerahan 24 Infinite Book sponsor pada Senin 9 November 2026. Pastikan seluruh buku lolos QC, terkemas, dokumentasi tahap lengkap, dan arsip tersimpan. Catat serah terima dan ambil foto penyerahan.",
  },
  {
    title: "Serahkan 24 piala ke Panitia Nyong Noni UNIMA 2026",
    assigned_to: 6,
    due_date: "2026-11-25",
    priority: "high",
    description:
      "Penyerahan 24 piala sebelum 26 November 2026, ditargetkan 25 November 2026. Pastikan seluruh piala lolos QC, terkemas, dokumentasi tahap lengkap, dan arsip tersimpan. Catat serah terima dan ambil foto penyerahan.",
  },
];

const totalPercent = MEMBERS.reduce((sum, m) => sum + m.percent, 0);
if (Math.round(totalPercent) !== 100) {
  console.error(`Total persentase ${totalPercent}% bukan 100%. Batal.`);
  process.exit(1);
}

const { data: dup, error: dupErr } = await supabase
  .from("projects")
  .select("id, name, status")
  .ilike("name", NAME)
  .maybeSingle();
if (dupErr) {
  console.error("Gagal memeriksa project:", dupErr.message);
  process.exit(1);
}
if (dup) {
  console.error(`Project "${NAME}" sudah ada (id ${dup.id}, status ${dup.status}). Batal agar tidak duplikat.`);
  process.exit(1);
}

const { data: project, error: projectErr } = await supabase
  .from("projects")
  .insert({
    name: NAME,
    client_name: CLIENT,
    description: DESCRIPTION,
    total_value: TOTAL_VALUE,
    status: "active",
  })
  .select("id")
  .single();
if (projectErr || !project) {
  console.error("Gagal insert project:", projectErr?.message);
  process.exit(1);
}

const { error: membersErr } = await supabase.from("project_members").insert(
  MEMBERS.map((m) => ({
    project_id: project.id,
    member_id: m.member_id,
    name: m.name,
    contribution_percent: m.percent,
    tugas: m.tugas,
  }))
);
if (membersErr) {
  console.error(`Project tersimpan (id ${project.id}) tapi gagal insert anggota: ${membersErr.message}`);
  process.exit(1);
}

const taskRows = [
  ...BOOK_TASKS.map((t) => ({
    title: t.title,
    description: t.description,
    project_id: project.id,
    assigned_to: t.assigned_to,
    due_date: BOOK_DUE[t.code],
    priority: t.priority,
    status: "pending",
  })),
  ...TROPHY_TASKS.map((t) => ({
    title: t.title,
    description: t.description,
    project_id: project.id,
    assigned_to: t.assigned_to,
    due_date: TROPHY_DUE[t.code],
    priority: t.priority,
    status: "pending",
  })),
  ...HANDOVER_TASKS.map((t) => ({
    title: t.title,
    description: t.description,
    project_id: project.id,
    assigned_to: t.assigned_to,
    due_date: t.due_date,
    priority: t.priority,
    status: "pending",
  })),
];

const { error: tasksErr } = await supabase.from("tasks").insert(taskRows);
if (tasksErr) {
  console.error(`Project dan anggota tersimpan (id ${project.id}) tapi gagal insert tugas: ${tasksErr.message}`);
  process.exit(1);
}

await supabase.from("activity_log").insert({
  user_id: 18,
  user_name: "Admin",
  action: "create",
  entity_type: "project",
  entity_id: project.id,
  entity_name: NAME,
  details: {
    name: NAME,
    client_name: CLIENT,
    total_value: TOTAL_VALUE,
    status: "active",
    members: MEMBERS.length,
    tasks: taskRows.length,
  },
});

for (const m of MEMBERS) {
  await supabase.from("notifications").insert({
    user_id: m.member_id,
    type: "project_assigned",
    message: `Kamu ditugaskan di project "${NAME}"`,
    link: `/admin/projects/${project.id}`,
  });
}

console.log(`Project "${NAME}" dibuat (id ${project.id}).`);
console.log(`Nilai tagihan: Rp ${TOTAL_VALUE.toLocaleString("id-ID")} (24 piala @ Rp100.000).`);
console.log(`Infinite Book: 24 buku sponsor gratis, penyerahan 9 November 2026.`);
console.log(`Anggota: ${MEMBERS.length} orang x 20%`);
console.log(`Tugas dibuat: ${taskRows.length}`);
for (const t of taskRows) {
  console.log(`  ${t.due_date}  [${t.priority}]  ${t.title}`);
}
process.exit(0);
