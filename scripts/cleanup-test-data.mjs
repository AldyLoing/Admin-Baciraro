// Hard delete data TEST dari database Supabase (sekali jalan).
// - Bagian A: project name ILIKE '[TEST]%' + seluruh turunannya
// - Bagian B: data test inventori (produk *TEST*, mutasi stok, jurnal,
//             transaksi smoke) + team member "Smoke Test"
// activity_log TIDAK dihapus (jejak audit dipertahankan).
//
// Pakai:
//   node scripts/cleanup-test-data.mjs          → dry run (tampilkan rencana)
//   node scripts/cleanup-test-data.mjs --yes    → eksekusi hapus

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- env -------------------------------------------------------------------
function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv(new URL("../.env.local", import.meta.url).pathname);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY tidak ditemukan di .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const EXECUTE = process.argv.includes("--yes");

const ids = (rows) => (rows ?? []).map((r) => r.id);
const listIds = (a) => (a.length ? a.join(", ") : "-");

async function pick(table, columns, filter) {
  const { data, error } = await db.from(table).select(columns).match(filter);
  if (error) throw new Error(`Gagal baca ${table}: ${error.message}`);
  return data ?? [];
}

async function pickWhere(table, columns, apply) {
  let q = db.from(table).select(columns);
  q = apply(q);
  const { data, error } = await q;
  if (error) throw new Error(`Gagal baca ${table}: ${error.message}`);
  return data ?? [];
}

async function del(table, apply) {
  let q = db.from(table).delete();
  q = apply(q);
  const { error } = await q;
  if (error) throw new Error(`Gagal hapus ${table}: ${error.message}`);
}

// --- kumpulkan target ------------------------------------------------------
console.log("Mengumpulkan data target...\n");

// Bagian A — project diawali [TEST]
const testProjects = await pickWhere("projects", "id, name, client_name, total_value, status, created_at", (q) =>
  q.ilike("name", "[TEST]%")
);
const projectIds = ids(testProjects);
const projectLinks = projectIds.map((id) => `/admin/projects/${id}`);

const payoutRows = projectIds.length
  ? await pickWhere("payouts", "id, project_id, project_name, status, total_amount", (q) => q.in("project_id", projectIds))
  : [];
const payoutIds = ids(payoutRows);
const installmentRows = projectIds.length
  ? await pickWhere("project_installments", "id, project_id, installment_no, amount, status, payout_id", (q) =>
      q.in("project_id", projectIds)
    )
  : [];
const txProjectRows = projectIds.length
  ? await pickWhere("transactions", "id, project_id, reference, amount, status, description", (q) => q.in("project_id", projectIds))
  : [];
const txProjectIds = ids(txProjectRows);
const memberRows = projectIds.length
  ? await pickWhere("project_members", "id, project_id, name, contribution_percent", (q) => q.in("project_id", projectIds))
  : [];
const payoutMemberRows = payoutIds.length
  ? await pickWhere("payout_members", "id, payout_id, name, amount", (q) => q.in("payout_id", payoutIds))
  : [];

// notifikasi: link persis ke project tsb ATAU pesan memuat nama project test
let notifRows = [];
if (projectIds.length) {
  const byLink = await pickWhere("notifications", "id, link, message", (q) => q.in("link", projectLinks));
  const byMsg = await pickWhere("notifications", "id, link, message", (q) =>
    q.ilike("message", "%[TEST] Cicilan Smoke%")
  );
  const merged = new Map();
  for (const n of [...byLink, ...byMsg]) merged.set(n.id, n);
  notifRows = [...merged.values()].sort((a, b) => a.id - b.id);
}
const notifIds = ids(notifRows);

// Bagian B — inventori test + transaksi smoke + member smoke
const productRows = await pickWhere("inventory_items", "id, sku, name, stok, is_active", (q) =>
  q.ilike("name", "%TEST%")
);
const productIds = ids(productRows);

const stockRows = productIds.length
  ? await pickWhere("stock_movements", "id, product_id, reason, qty", (q) => q.in("product_id", productIds))
  : [];

const smokeTxRows = (await pickWhere("transactions", "id, source, description, reference, amount, status", (q) =>
  q.or("source.ilike.%TEST%,description.ilike.%smoke%")
)).filter((t) => !txProjectIds.includes(t.id)); // hindari duplikat dengan bagian project
const allTxIds = [...new Set([...txProjectIds, ...ids(smokeTxRows)])];

const journalRows = allTxIds.length || productIds.length
  ? await pickWhere("journal_entries", "id, description, reference, transaction_id, status", (q) =>
      q.or(
        `description.ilike.%[TEST]%,description.ilike.%smoke%,transaction_id.in.(${allTxIds.join(",") || "0"})`
      )
    )
  : [];
const journalIds = ids(journalRows);

const journalLineRows = journalIds.length
  ? await pickWhere("journal_entry_lines", "id, journal_entry_id", (q) => q.in("journal_entry_id", journalIds))
  : [];

const smokeMembers = await pickWhere("team_members", "id, name, username, status", (q) =>
  q.or("name.eq.Smoke Test,username.eq.smoketest")
);
const memberIds = ids(smokeMembers);

// pengaman FK: sale_items / consignment_items memakai ON DELETE RESTRICT
const saleItemRows = productIds.length
  ? await pickWhere("sale_items", "id, product_id", (q) => q.in("product_id", productIds))
  : [];
const consignItemRows = productIds.length
  ? await pickWhere("consignment_items", "id, product_id", (q) => q.in("product_id", productIds))
  : [];

// --- laporan dry run -------------------------------------------------------
const groups = [
  {
    section: "BAGIAN A — Project [TEST] + turunannya",
    rows: [
      ["payout_members", payoutMemberRows, (r) => `id ${r.id} → payout ${r.payout_id}, ${r.name} Rp ${r.amount}`],
      ["project_installments", installmentRows, (r) => `id ${r.id} → project ${r.project_id}, cicilan #${r.installment_no} Rp ${r.amount} (${r.status})`],
      ["payouts", payoutRows, (r) => `id ${r.id} → project ${r.project_id} Rp ${r.total_amount} (${r.status})`],
      ["transactions", txProjectRows, (r) => `id ${r.id} → project ${r.project_id}, ${r.reference} Rp ${r.amount} (${r.status})`],
      ["project_members", memberRows, (r) => `id ${r.id} → project ${r.project_id}, ${r.name} ${r.contribution_percent}%`],
      ["notifications", notifRows, (r) => `id ${r.id} → ${r.link}`],
      ["projects", testProjects, (r) => `id ${r.id} "${r.name}" — ${r.client_name} Rp ${r.total_value} (${r.status})`],
    ],
  },
  {
    section: "BAGIAN B — Data test inventori + smoke",
    rows: [
      ["journal_entry_lines", journalLineRows, (r) => `id ${r.id} → journal ${r.journal_entry_id}`],
      ["stock_movements", stockRows, (r) => `id ${r.id} → product ${r.product_id}, ${r.reason} qty ${r.qty}`],
      ["journal_entries", journalRows, (r) => `id ${r.id} ${r.reference} (${r.status}) ${String(r.description).slice(0, 55)}`],
      ["transactions (smoke)", smokeTxRows, (r) => `id ${r.id} ${r.reference} "${r.source}" Rp ${r.amount} (${r.status})`],
      ["inventory_items", productRows, (r) => `id ${r.id} sku=${r.sku ?? "-"} "${r.name}" stok ${r.stok}`],
      ["team_members (Smoke Test)", smokeMembers, (r) => `id ${r.id} "${r.name}" (${r.username}, ${r.status})`],
    ],
  },
];

let total = 0;
for (const g of groups) {
  console.log(`=== ${g.section} ===`);
  for (const [table, rows, fmt] of g.rows) {
    total += rows.length;
    console.log(`  ${table}: ${rows.length} baris`);
    for (const r of rows) console.log(`    - ${fmt(r)}`);
  }
  console.log();
}

console.log(`TOTAL: ${total} baris akan dihapus.`);
console.log("TIDAK dihapus: activity_log (jejak audit dipertahankan).");

if (saleItemRows.length || consignItemRows.length) {
  console.error(
    `\nABORT: ada referensi FK — sale_items: ${saleItemRows.length}, consignment_items: ${consignItemRows.length}`
  );
  process.exit(1);
}
if (!total) {
  console.log("\nTidak ada data target. Tidak ada yang dilakukan.");
  process.exit(0);
}
if (!EXECUTE) {
  console.log("\nIni DRY RUN — belum ada yang dihapus.");
  console.log("Eksekusi dengan: node scripts/cleanup-test-data.mjs --yes");
  process.exit(0);
}

// --- eksekusi (urutan aman foreign key) ------------------------------------
console.log("\nMenghapus...");
const steps = [
  ["payout_members", "payout_members", (q) => (payoutIds.length ? q.in("payout_id", payoutIds) : q.eq("id", -1))],
  ["project_installments", "project_installments", (q) => (projectIds.length ? q.in("project_id", projectIds) : q.eq("id", -1))],
  ["payouts", "payouts", (q) => (payoutIds.length ? q.in("id", payoutIds) : q.eq("id", -1))],
  ["transactions (project)", "transactions", (q) => (txProjectIds.length ? q.in("id", txProjectIds) : q.eq("id", -1))],
  ["project_members", "project_members", (q) => (projectIds.length ? q.in("project_id", projectIds) : q.eq("id", -1))],
  ["notifications", "notifications", (q) => (notifIds.length ? q.in("id", notifIds) : q.eq("id", -1))],
  ["journal_entry_lines", "journal_entry_lines", (q) => (journalIds.length ? q.in("journal_entry_id", journalIds) : q.eq("id", -1))],
  ["stock_movements", "stock_movements", (q) => (productIds.length ? q.in("product_id", productIds) : q.eq("id", -1))],
  ["journal_entries", "journal_entries", (q) => (journalIds.length ? q.in("id", journalIds) : q.eq("id", -1))],
  ["transactions (smoke)", "transactions", (q) => (ids(smokeTxRows).length ? q.in("id", ids(smokeTxRows)) : q.eq("id", -1))],
  ["inventory_items", "inventory_items", (q) => (productIds.length ? q.in("id", productIds) : q.eq("id", -1))],
  ["team_members (Smoke Test)", "team_members", (q) => (memberIds.length ? q.in("id", memberIds) : q.eq("id", -1))],
  ["projects", "projects", (q) => (projectIds.length ? q.in("id", projectIds) : q.eq("id", -1))],
];

try {
  for (const [label, table, apply] of steps) {
    await del(table, apply);
    console.log(`  ok  ${label}`);
  }
} catch (e) {
  console.error(`\nGAGAL: ${e.message}`);
  console.error("Sisa data mungkin setengah terhapus — jalankan lagi dry run untuk melihat sisa.");
  process.exit(1);
}

// --- verifikasi -------------------------------------------------------------
console.log("\nVerifikasi ulang:");
const verify = [
  ["projects [TEST]", db.from("projects").select("id", { count: "exact", head: true }).ilike("name", "[TEST]%")],
  ["project_installments", db.from("project_installments").select("id", { count: "exact", head: true }).in("project_id", projectIds)],
  ["payouts test", db.from("payouts").select("id", { count: "exact", head: true }).in("id", payoutIds)],
  ["produk *TEST*", db.from("inventory_items").select("id", { count: "exact", head: true }).ilike("name", "%TEST%")],
  ["activity_log (dipertahankan)", db.from("activity_log").select("id", { count: "exact", head: true })],
];
for (const [label, q] of verify) {
  const { count, error } = await q;
  if (error) console.log(`  ?  ${label}: error ${error.message}`);
  else console.log(`  ${label}: ${count} baris`);
}
console.log("\nSelesai.");
