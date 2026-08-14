# PPLG League - FC 26 Tournament

Website turnamen FC 26 untuk komunitas dengan Next.js, Tailwind CSS, dan Firebase.

## Fitur

- **Sistem Liga + Turnamen**: Liga round robin untuk semua tim, turnamen untuk top 4
- **Pendaftaran Tim**: Formulir pendaftaran tanpa login dengan validasi nama tim unik
- **Manajemen Pemain Game**: Admin bisa tambah/hapus pemain game (Mbappe, dll) untuk setiap tim
- **Halaman Admin Khusus**: Panel admin terpisah dengan PIN protection (2626)
- **Status Liga Otomatis**: Tracking status liga (registration → league_ongoing → league_completed → tournament_ongoing → tournament_completed)
- **Top 4 Kualifikasi**: Otomatis kualifikasi 4 tim terbaik ke fase turnamen
- **Generate Jadwal Otomatis**: Sistem Round Robin otomatis dari panel admin
- **Input Skor & Statistik**: Input skor dengan statistik pemain game per pertandingan (oleh admin)
- **Klasemen Otomatis**: Perhitungan klasemen real-time berdasarkan hasil pertandingan
- **Hapus Data**: Admin bisa hapus tim, pertandingan, atau reset total turnamen
- **Statistik Pemain**: Top Scorers dan Top Assists berdasarkan pemain game
- **UI Premium Cyber-Brutalist**: Desain modern dengan tema gelap dan aksen hijau neon
- **Mobile Responsive**: Semua halaman responsif untuk semua ukuran layar

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase** (Firestore Database)
- **Server Actions** (Admin operations)

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ 
- npm atau yarn
- Akun Firebase (gratis di firebase.google.com)

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Firebase

1. Buat project baru di [Firebase Console](https://console.firebase.google.com)
2. Enable **Firestore Database** di Firebase Console
3. Buat 4 collections: `users`, `game_players`, `matches`, `stats`
4. Copy Firebase config dari Project Settings > General
5. Setup Firestore Security Rules (lihat `database/firestore-schema.md`)
6. Setup Firestore Indexes untuk optimal query performance

### 4. Environment Variables

Buat file `.env.local` di root project:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 5. Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Database Schema

### Collections

- **users**: Data user/tim (owner tim)
- **game_players**: Data pemain game (Mbappe, dll) untuk setiap tim
- **matches**: Jadwal dan hasil pertandingan
- **stats**: Statistik pemain game (gol & assist)

Lihat detail lengkap di `database/firestore-schema.md`

### Struktur Data

**Users**: Orang yang mendaftarkan tim (control tim)
- `name`: Nama asli orang
- `team_name`: Nama tim FC 26

**Game Players**: Pemain game di dalam tim
- `user_id`: Referensi ke user (owner tim)
- `team_name`: Nama tim
- `player_name`: Nama pemain game (misal: Mbappe)

**Matches**: Pertandingan antar tim
- `home_user_id`: User tim home
- `away_user_id`: User tim away
- `home_team_name`: Nama tim home
- `away_team_name`: Nama tim away
- `home_score`, `away_score`: Skor pertandingan
- `status`: 'scheduled' atau 'played'

**Stats**: Statistik pemain game per pertandingan
- `match_id`: Referensi ke pertandingan
- `player_name`: Nama pemain game
- `team_name`: Nama tim
- `type`: 'goal' atau 'assist'
- `count`: Jumlah gol/assist

### Klasemen Calculation

Klasemen dihitung otomatis (on-the-fly) dari collection matches dengan status 'played':

- Menang = 3 poin
- Seri = 1 poin  
- Kalah = 0 poin

Urutan: Poin > Selisih Gol > Gol Masuk > Nama Tim

## Admin PIN

PIN Admin untuk operasi sensitif: **2626**

Digunakan untuk:
- Login ke halaman admin
- Tambah/hapus pemain game
- Generate jadwal pertandingan
- Input skor pertandingan
- Hapus tim, pertandingan, atau reset total

## Pages

- **/** - Klasemen & statistik (Homepage)
- **/register** - Formulir pendaftaran tim untuk user
- **/fixtures** - Jadwal & input skor
- **/admin** - Panel admin khusus (PIN protected)

## Project Structure

```
src/
├── app/
│   ├── actions/
│   │   └── admin.ts          # Server Actions (Firebase)
│   ├── admin/
│   │   └── page.tsx          # Admin panel
│   ├── fixtures/
│   │   └── page.tsx          # Jadwal & input skor
│   ├── globals.css          # Global styles
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Homepage (klasemen)
│   ├── register/
│   │   └── page.tsx          # Pendaftaran tim
│   └── standings/
│       └── page.tsx          # Redirect ke homepage
├── components/
│   └── Navbar.tsx            # Navigation
├── lib/
│   ├── firebase.ts           # Firebase client
│   └── standings.ts          # Klasemen calculation
└── types/
    └── index.ts              # TypeScript types
```

## Build untuk Production

```bash
npm run build
npm start
```

## Design System

### Colors
- Background: #000000 (pure black)
- Card: #121212
- Border: #262626
- Accent: #00FF66 (neon green)

### Typography
- Headers: Sans-serif bold, UPPERCASE, tracking-wider
- Data: Monospace untuk angka
- Border radius: rounded-sm (4px) atau none

### Responsive
- Mobile-first approach
- Hidden columns on mobile (GM, GK, SG)
- Overflow-x-auto untuk tables

## Firebase Configuration

### Firestore Security Rules

Copy rules dari `database/firestore-schema.md` ke Firestore Rules tab di Firebase Console.

### Required Indexes

Buat composite indexes berikut di Firestore:

1. **users collection**: Index on `team_name`
2. **game_players collection**: Composite index on `user_id`
3. **game_players collection**: Composite index on `team_name`
4. **matches collection**: Composite index on `status` and `round`
5. **stats collection**: Composite index on `match_id` and `type`
6. **stats collection**: Composite index on `type` and `count`

## Workflow

1. **Pendaftaran**: User daftar tim di `/register` → masuk ke collection `users`
2. **Admin Login**: Admin login ke `/admin` dengan PIN 2626
3. **Tambah Pemain Game**: Admin tambah pemain game (Mbappe, dll) untuk setiap tim
4. **Generate Jadwal**: Admin klik "Generate Jadwal" → sistem buat Round Robin schedule
5. **Input Skor**: Admin input skor di `/fixtures` + statistik pemain game
6. **Klasemen**: Otomatis update di homepage berdasarkan hasil pertandingan
7. **Hapus Data**: Admin bisa hapus tim, pertandingan, atau reset total di `/admin`

## Troubleshooting

### Firebase Connection Error
Pastikan environment variables sudah diset dengan benar di `.env.local`

### Firestore Permission Error
Pastikan Firestore Security Rules sudah diaplikasikan dengan benar

### Query Performance Error
Pastikan composite indexes sudah dibuat di Firestore Console

### Pin Admin Not Working
Pastikan menggunakan PIN yang benar: **2626**

### Game Players Not Showing
Pastikan admin sudah tambah pemain game di halaman `/admin` sebelum input skor

## License

MIT# PPLeague
