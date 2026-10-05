#!/usr/bin/env node
// Backfill username + password + is_admin untuk anggota team_members
// yang belum punya kredensial login. Idempoten: hanya menyentuh baris
// yang username/password-nya masih NULL.
//
// Jalankan:  node scripts/create-member-accounts.mjs
// Password ditampilkan SEKALI di terminal dan TIDAK disimpan di mana pun.

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

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function randomPassword(len = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

const { data: members, error } = await supabase
  .from("team_members")
  .select("id, name, username, email, password, is_admin")
  .order("id");
if (error) {
  console.error("Gagal membaca team_members:", error.message);
  process.exit(1);
}

const taken = new Set();
for (const m of members) {
  if (m.username) taken.add(m.username.toLowerCase());
  if (m.email) taken.add(m.email.toLowerCase());
}

const targets = members.filter((m) => !m.password || !m.username);
if (targets.length === 0) {
  console.log("Semua anggota sudah punya kredensial. Tidak ada yang dikerjakan.");
  process.exit(0);
}

const rows = [];
const creds = [];
for (const m of targets) {
  const base = slugify(m.name) || `member${m.id}`;
  let uname = base;
  let n = 2;
  while (taken.has(uname)) {
    uname = `${base}${n}`;
    n++;
  }
  taken.add(uname);
  const plain = randomPassword();
  rows.push({ id: m.id, username: uname, password: bcrypt.hashSync(plain, 10) });
  creds.push({ name: m.name, username: uname, password: plain });
}

for (const r of rows) {
  const { error: upd } = await supabase
    .from("team_members")
    .update({ username: r.username, password: r.password, is_admin: true })
    .eq("id", r.id);
  if (upd) {
    console.error(`Gagal update id=${r.id}:`, upd.message);
    process.exit(1);
  }
}

const { error: logErr } = await supabase.from("activity_log").insert({
  user_id: null,
  user_name: "system",
  action: "backfill_accounts",
  entity_type: "team_member",
  entity_id: null,
  entity_name: `${rows.length} akun anggota`,
  details: { ids: rows.map((r) => r.id), usernames: creds.map((c) => c.username), is_admin: true },
});
if (logErr) console.error("Peringatan: gagal mencatat activity_log:", logErr.message);

const w = Math.max(...creds.map((c) => c.name.length), 4);
console.log("\n=== KREDENSIAL — TAMPIL SEKALI, SALIN SEKARANG ===");
console.log("(tidak disimpan di mana pun selain hash bcrypt di database)\n");
console.log("Nama".padEnd(w + 2) + "Username".padEnd(24) + "Password");
for (const c of creds) console.log(c.name.padEnd(w + 2) + c.username.padEnd(24) + c.password);
console.log(`\n${rows.length} akun dibuat (is_admin=true).`);
console.log("Login di /admin/login memakai username ATAU email + password.\n");
