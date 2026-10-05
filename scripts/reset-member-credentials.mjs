#!/usr/bin/env node
// Reset password semua akun anggota (kecuali akun bootstrap `baciraro`
// dan `smoketest` yang passwordnya masih diketahui) lalu cetak kredensial
// baru SEKALI di terminal. Idempoten — boleh dijalankan ulang (menghasilkan
// password baru setiap kali).
//
// Jalankan:  node scripts/reset-member-credentials.mjs

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local tidak ditemukan di root project.");
  process.exit(1);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY tidak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const EXCLUDE_USERNAMES = new Set(["baciraro", "baciraro@gmail.com", "smoketest"]);

function randomPassword(len = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

const { data: members, error } = await supabase
  .from("team_members")
  .select("id, name, username")
  .eq("status", "active")
  .order("id");
if (error) {
  console.error("Gagal membaca team_members:", error.message);
  process.exit(1);
}

const targets = members.filter(
  (m) => m.username && !EXCLUDE_USERNAMES.has(String(m.username).toLowerCase())
);
if (targets.length === 0) {
  console.error("Tidak ada akun yang cocok untuk direset.");
  process.exit(1);
}

const creds = [];
for (const m of targets) {
  const plain = randomPassword();
  const { error: updErr } = await supabase
    .from("team_members")
    .update({ password: bcrypt.hashSync(plain, 10) })
    .eq("id", m.id);
  if (updErr) {
    console.error(`Gagal reset ${m.name}: ${updErr.message}`);
    process.exit(1);
  }
  creds.push({ name: m.name, username: m.username, password: plain });
}

const { error: logErr } = await supabase.from("activity_log").insert({
  user_id: 18,
  user_name: "Admin",
  action: "reset_passwords",
  entity_type: "team_members",
  entity_id: null,
  entity_name: `${creds.length} akun anggota`,
  details: { usernames: creds.map((c) => c.username) },
});
if (logErr) console.error("Peringatan: gagal mencatat activity_log:", logErr.message);

const w = Math.max(...creds.map((c) => c.name.length), 4);
console.log("\n=== KREDENSIAL BARU — TAMPIL SEKALI, SALIN SEKARANG ===");
console.log("(hanya hash bcrypt yang disimpan di database)\n");
console.log("Nama".padEnd(w + 2) + "Username".padEnd(24) + "Password");
for (const c of creds) console.log(c.name.padEnd(w + 2) + c.username.padEnd(24) + c.password);
console.log(`\n${creds.length} password di-reset.`);
console.log("Login di /admin/login memakai username ATAU email + password.\n");
