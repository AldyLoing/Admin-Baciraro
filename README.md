
# Baciraro Admin Panel

Panel manajemen internal untuk organisasi Baciraro — dibangun dengan **Next.js 16 + TypeScript + Supabase**.

## Fitur Utama

### Manajemen Project
- CRUD project dengan nama, klien, nilai, status (aktif / selesai / dibayar)
- Manajemen anggota kontributor per project (persentase + tugas)
- Template project untuk inisialisasi cepat
- Lampiran file per project

### Pembukuan Double-Entry
- **Daftar Akun** — Chart of Accounts dengan kode akun (1101–5119)
- **Jurnal Umum** — Pencatatan transaksi debit & kredit, validasi seimbang
- **Buku Besar** — Ringkasan per kategori: Penjualan, Pembagian, Transport, Konsumsi, Lainnya + Neraca Saldo
- Auto-generate jurnal saat membuat transaksi

### Kas & Transaksi
- Pencatatan pemasukan & pengeluaran dengan saldo berjalan
- Filter per bulan, jenis, dan kategori akun
- Export CSV

### Payout / Bagi Hasil
- Perhitungan otomatis: Kas Baciraro (10%) + distribusi ke anggota berdasarkan kontribusi
- Finalisasi dengan nominal riil
- Status: Menunggu → Diproses → Dibayar
- Invoice cetak per payout + link ke jurnal terkait

### Jadwal & Tugas
- Kanban view (pending / active / completed)
- Sinkronisasi Google Calendar (OAuth2)
- Recurring tasks (harian / mingguan / bulanan)
- Export ICS

### Rapat & Tindak Lanjut
- Catatan rapat dengan agenda, notulensi, dan daftar hadir
- Action items dengan penanggung jawab & deadline

### Anggota
- Statistik per anggota: project, payout diterima, jumlah transaksi dibuat
- Manajemen akun (CRUD)

### Dashboard
- Ringkasan: total pendapatan, kas riil, project aktif, selesai/dibayar
- Neraca saldo ringkas
- Chart kas 6 bulan terakhir + status project
- Ranking pendapatan anggota

### Lainnya
- Log aktivitas (audit trail)
- Notifikasi real-time
- QR Koin Event (loyalty points)
- Leaderboard customer

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19 + Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (bcryptjs) |
| Charts | Recharts |
| Calendar | Google Calendar API + ICS |
| QR Code | qrcode |

## Getting Started

### Prerequisites
- Node.js >= 20
- Akun Supabase dengan project aktif
- (Opsional) Google Cloud OAuth credentials untuk sync kalender

### Instalasi

```bash
git clone git@github.com:AldyLoing/Admin-Baciraro.git
cd Admin-Baciraro
npm install
```

### Environment Variables

Copy `.env.example` ke `.env.local` dan isi:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_KEY=sb_secret_xxx

# JWT
JWT_SECRET=your-secret-key

# Google Calendar (opsional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/admin/google/callback
```

### Database Migration

Jalankan SQL migration di **Supabase SQL Editor** secara berurutan:

1. `supabase-admin-panel.sql` — schema dasar
2. `supabase-admin-panel-v3.sql` — support kontributor eksternal
3. `supabase-admin-payout-v4.sql` — finalisasi payout
4. `supabase-dashboard-upgrades.sql` — activity log, notifikasi, template
5. `supabase-event-qr.sql` — QR koin event
6. `supabase-oauth-calendar.sql` — Google OAuth
7. `supabase-realtime-tasks.sql` — realtime tasks
8. `supabase-double-entry.sql` — pembukuan double-entry
9. `supabase-data-connections.sql` — koneksi data antar fitur

### Run Development

```bash
npm run dev
```

Buka [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Struktur Database

```
team_members (ROOT)
  ├── project_members → projects
  ├── transactions → journal_entries → journal_entry_lines → accounts
  ├── payouts → payout_members
  ├── tasks (self-ref: recurrence)
  ├── meeting_notes → meeting_note_attendees, action_items
  ├── activity_log
  ├── notifications
  └── calendar_tokens
```

## Struktur Project

```
src/
├── app/
│   ├── admin/
│   │   ├── login/
│   │   └── (panel)/
│   │       ├── page.tsx              # Dashboard
│   │       ├── accounts/             # Chart of Accounts
│   │       ├── journal/              # Jurnal Umum
│   │       ├── bookkeeping/          # Buku Besar
│   │       ├── transactions/         # Kas & Transaksi
│   │       ├── projects/             # Project & Bagi Hasil
│   │       ├── payouts/              # Payouts
│   │       ├── schedule/             # Jadwal & Tugas
│   │       ├── meetings/             # Rapat & Tindak Lanjut
│   │       ├── members/              # Anggota
│   │       ├── workload/             # Beban Kerja
│   │       ├── leaderboard/          # Leaderboard
│   │       ├── activity/             # Log Aktivitas
│   │       ├── notifications/        # Notifikasi
│   │       ├── templates/            # Template Project
│   │       └── qr-event/             # QR Koin Event
│   └── api/admin/                    # API routes (backend)
├── components/                       # Shared components
├── lib/admin/                        # Utility functions
└── utils/supabase/                   # Supabase clients
```

## License

Private — Baciraro Internal Use Only.
 
