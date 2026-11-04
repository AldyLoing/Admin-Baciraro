// Sekali jalan: buat project "Infinite Book A4" (Rp 300.000) dengan 5 anggota 20% each.
// Pakai: node --env-file=.env.local scripts/create-infinite-book-a4.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const NAME = "Infinite Book A4";
const TOTAL_VALUE = 300000;

const MEMBERS = [
  { member_id: 14, name: "Owen Kalumata", percent: 20, tugas: "Scrollsaw papan dan buat lubang untuk spiral" },
  { member_id: 16, name: "Calvin Kakase", percent: 20, tugas: "Pasang spiral dan buat lubang untuk kertas" },
  { member_id: 6, name: "Aldy Loing", percent: 20, tugas: "Buat papan dan posting project di web" },
  { member_id: 9, name: "Given Tambalean", percent: 20, tugas: "Buat postingan di IG dan buat desain isi buku" },
  { member_id: 1, name: "Marlon Kamagi", percent: 20, tugas: "Quality Control" },
];

const totalPercent = MEMBERS.reduce((s, m) => s + m.percent, 0);
if (Math.round(totalPercent) !== 100) {
  console.error(`Total persentase ${totalPercent}% ≠ 100%. Batal.`);
  process.exit(1);
}

const { data: dup } = await supabase
  .from("projects")
  .select("id, name, status")
  .ilike("name", NAME)
  .maybeSingle();
if (dup) {
  console.error(`Project "${NAME}" sudah ada (id ${dup.id}, status ${dup.status}). Batal agar tidak duplikat.`);
  process.exit(1);
}

const { data: project, error: pErr } = await supabase
  .from("projects")
  .insert({ name: NAME, total_value: TOTAL_VALUE, status: "active" })
  .select("id")
  .single();
if (pErr || !project) {
  console.error("Gagal insert project:", pErr?.message);
  process.exit(1);
}

const { error: mErr } = await supabase.from("project_members").insert(
  MEMBERS.map((m) => ({
    project_id: project.id,
    member_id: m.member_id,
    name: m.name,
    contribution_percent: m.percent,
    tugas: m.tugas,
  }))
);
if (mErr) {
  console.error("Project tersimpan (id " + project.id + ") tapi gagal insert anggota:", mErr.message);
  process.exit(1);
}

await supabase.from("activity_log").insert({
  user_id: 18,
  user_name: "Admin",
  action: "create",
  entity_type: "project",
  entity_id: project.id,
  entity_name: NAME,
  details: { name: NAME, total_value: TOTAL_VALUE, status: "active", members: MEMBERS.length },
});

for (const m of MEMBERS) {
  await supabase.from("notifications").insert({
    user_id: m.member_id,
    type: "project_assigned",
    message: `Kamu ditugaskan di project "${NAME}"`,
    link: `/admin/projects/${project.id}`,
  });
}

console.log(`✔ Project "${NAME}" dibuat (id ${project.id}), total Rp ${TOTAL_VALUE.toLocaleString("id-ID")}`);
console.log(`\nAnggota (5 × 20%):`);
for (const m of MEMBERS) {
  console.log(`  ${m.name.padEnd(18)} 20%  — ${m.tugas}`);
}
const kas = TOTAL_VALUE * 0.1;
const distributable = TOTAL_VALUE - kas;
const perOrang = distributable * 0.2;
console.log(
  `\nPreview bagi hasil: total ${TOTAL_VALUE.toLocaleString("id-ID")} − Kas Baciraro 10% (${kas.toLocaleString(
    "id-ID"
  )}) = ${distributable.toLocaleString("id-ID")} → per orang 20% = ${perOrang.toLocaleString("id-ID")}`
);
process.exit(0);
