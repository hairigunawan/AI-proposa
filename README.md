# Lumen — AI Search dengan Google Gemini

Website AI Search bergaya Perplexity: satu kotak pencarian, jawaban yang ditulis
bertahap (streaming), dan daftar sumber dari **Grounding with Google Search**
sehingga jawabannya berdasar informasi terbaru di internet.

Dibangun dengan **Next.js (App Router) + TypeScript + Tailwind CSS v4 +
@google/genai**. API key hanya dipakai di server, tidak pernah sampai ke browser.

---

## Daftar isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Struktur folder](#struktur-folder)
- [Cara menjalankan](#cara-menjalankan)
- [Cara mendapatkan API key gratis di Google AI Studio](#cara-mendapatkan-api-key-gratis-di-google-ai-studio)
- [Cara deploy ke Vercel](#cara-deploy-ke-vercel)
- [Cara kerja singkat](#cara-kerja-singkat)
- [Kontrak API `/api/search`](#kontrak-api-apisearch)
- [Batas dan penyimpanan](#batas-dan-penyimpanan)
- [Penanganan error](#penanganan-error)
- [Troubleshooting](#troubleshooting)
- [Catatan](#catatan)

---

## Fitur

| Fitur | Keterangan |
| --- | --- |
| Halaman awal minimalis | Logo, search bar besar, dan 4 contoh pertanyaan siap klik |
| Pencarian real-time | Tool `googleSearch` Gemini aktif, jawaban berdasar hasil pencarian terbaru |
| Streaming | Jawaban muncul bertahap lewat NDJSON stream (efek mengetik + kursor berkedip) |
| Sumber & sitasi | Kartu sumber (judul + domain + favicon) dan penanda `[1]`, `[2]` yang bisa diklik |
| Pertanyaan lanjutan | 3 saran pertanyaan terkait setelah jawaban selesai |
| Follow-up chat | Pertanyaan berikutnya membawa konteks 3 giliran percakapan terakhir |
| Riwayat pencarian | Disimpan di `localStorage`, tampil di sidebar yang bisa dibuka-tutup |
| Salin & pencarian baru | Tombol salin jawaban dan tombol mulai dari awal |
| Dark / light mode | Toggle 3 keadaan: mengikuti sistem → terang → gelap, tanpa kedip saat reload |
| Penanganan error | Pesan ramah untuk API key kosong/salah, kuota habis (429), koneksi gagal, input kosong, plus tombol "coba lagi" |
| Responsif | Sidebar jadi drawer di layar kecil, search bar menempel di bawah saat mode percakapan |

---

## Teknologi

| Paket | Versi di `package.json` | Dipakai untuk |
| --- | --- | --- |
| `next` | ^16.3.5 | Framework (App Router, API route, streaming response) |
| `react` / `react-dom` | ^19.3.0 | UI |
| `typescript` | ^5.9.3 | Tipe, dicek lewat `npm run typecheck` |
| `tailwindcss` + `@tailwindcss/postcss` | ^4.3.3 | Styling (Tailwind v4, konfigurasi via CSS di `app/globals.css`) |
| `@google/genai` | ^2.22.0 | SDK resmi Gemini (streaming + Google Search grounding) |
| `react-markdown` + `remark-gfm` | ^10.1.0 / ^4.0.1 | Render jawaban Markdown (tabel, list, code block) |
| `lucide-react` | ^1.46.0 | Ikon |

Alias import `@/*` menunjuk ke root project (lihat `tsconfig.json`).
Belum ada konfigurasi linter maupun test di repo ini — pengecekan otomatis yang
tersedia baru `npm run typecheck`.

---

## Struktur folder

```
.
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts        # API route (server): panggil Gemini + streaming NDJSON
│   ├── globals.css             # Tailwind v4, tema gelap, style Markdown & sitasi
│   ├── layout.tsx              # Font Inter, metadata, script anti-flash dark mode
│   └── page.tsx                # Halaman utama: home state + mode percakapan
├── components/
│   ├── AnswerView.tsx          # Render satu giliran: pertanyaan, sumber, jawaban, aksi
│   ├── HistorySidebar.tsx      # Sidebar riwayat (drawer di mobile)
│   ├── RelatedQuestions.tsx    # 3 pertanyaan lanjutan
│   ├── SearchBar.tsx           # Search bar (varian hero & docked)
│   ├── SourceCard.tsx          # Kartu sumber: favicon, judul, domain, nomor
│   └── ThemeToggle.tsx         # Tombol tema light/dark/system
├── lib/
│   ├── citations.ts            # Ubah penanda [1] jadi link ke sumber
│   ├── errors.ts               # Terjemahan error SDK -> pesan ramah
│   ├── grounding.ts            # Kumpulkan grounding metadata -> sumber + sitasi
│   ├── history.ts              # Riwayat pencarian di localStorage
│   ├── stream.ts               # Pembaca NDJSON di sisi client
│   └── types.ts                # Tipe bersama client & server
├── .env.example                # Contoh konfigurasi environment
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

---

## Cara menjalankan

Butuh **Node.js 20.9+** (disarankan 22), mengikuti syarat minimum Next.js 16.

```bash
# 1. Install dependency
npm install

# 2. Siapkan environment
cp .env.example .env.local
#    lalu buka .env.local dan isi GEMINI_API_KEY dengan key milikmu

# 3. Jalankan mode development
npm run dev
```

Buka <http://localhost:3000>.

Perintah lain:

```bash
npm run build      # build produksi
npm run start      # jalankan hasil build
npm run typecheck  # cek TypeScript tanpa build
```

### Isi `.env.local`

```env
GEMINI_API_KEY=isi_dengan_api_key_kamu
GEMINI_MODEL=gemini-3.8-flash
```

- `GEMINI_API_KEY` — **wajib**, hanya dibaca di server.
- `GEMINI_MODEL` — opsional (default `gemini-3.8-flash`). Ganti sesuai model aktif
  di <https://ai.google.dev/gemini-api/docs/models>. Gunakan model kelas *Flash*
  bila ingin tetap di kuota gratis, dan pastikan model mendukung Google Search grounding.

> Setiap kali `.env.local` diubah, hentikan lalu jalankan ulang `npm run dev`.

---

## Cara mendapatkan API key gratis di Google AI Studio

1. Buka <https://aistudio.google.com/apikey> dan login dengan akun Google.
2. Setujui syarat & ketentuan bila diminta.
3. Klik **Create API key** (atau **Get API key** → **Create API key**).
4. Pilih project Google Cloud yang sudah ada, atau biarkan AI Studio membuatkan
   project baru untukmu.
5. Salin key yang muncul (formatnya diawali `AIza...`) dan tempel ke `.env.local`:

   ```env
   GEMINI_API_KEY=AIza...
   ```

6. Free tier punya batas permintaan per menit/hari. Kalau muncul pesan
   "Kuota sedang habis" (HTTP 429), tunggu sebentar lalu coba lagi.

**Jangan** commit API key ke Git. File `.env.local` sudah masuk `.gitignore`.

---

## Cara deploy ke Vercel

### Lewat dashboard

1. Push repo ini ke GitHub/GitLab/Bitbucket.
2. Buka <https://vercel.com/new>, pilih repositorinya, klik **Import**.
   Framework **Next.js** terdeteksi otomatis — biarkan setelan build apa adanya.
3. Buka **Settings → Environment Variables**, tambahkan:

   | Name | Value | Environment |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | API key dari AI Studio | Production, Preview, Development |
   | `GEMINI_MODEL` | `gemini-3.8-flash` | Production, Preview, Development |

4. Klik **Deploy**, tunggu build selesai, lalu buka domain `*.vercel.app` yang diberikan.

### Lewat CLI

```bash
npm i -g vercel
vercel                       # deploy preview + hubungkan project
vercel env add GEMINI_API_KEY
vercel env add GEMINI_MODEL
vercel --prod                # deploy ke produksi
```

Setelah mengubah environment variable, jalankan **Redeploy** agar nilainya terpakai.

---

## Cara kerja singkat

1. Browser mengirim `POST /api/search` berisi `{ query, history }`.
2. `app/api/search/route.ts` (server, `runtime = "nodejs"`) memanggil
   `ai.models.generateContentStream()` dengan `tools: [{ googleSearch: {} }]` —
   di sinilah API key dipakai, aman di server.
3. Setiap potongan teks langsung dikirim balik sebagai baris NDJSON
   (`{"type":"text",...}`) sehingga jawaban terlihat mengetik.
4. Saat stream selesai, `groundingMetadata` diolah `lib/grounding.ts` menjadi
   daftar sumber bernomor, lalu teks final dikirim ulang dengan penanda `[1]`, `[2]`
   di posisi yang tepat (offset grounding dihitung dalam byte UTF-8).
5. Terakhir, satu permintaan singkat berformat JSON (`responseSchema` array 3 string)
   menghasilkan 3 pertanyaan lanjutan. Kalau langkah ini gagal, jawaban utama tetap
   tampil tanpa saran pertanyaan.

---

## Kontrak API `/api/search`

**Request** — `POST /api/search`, `Content-Type: application/json`:

```json
{
  "query": "pertanyaan user",
  "history": [
    { "role": "user", "content": "pertanyaan sebelumnya" },
    { "role": "assistant", "content": "jawaban sebelumnya" }
  ]
}
```

**Response** — `application/x-ndjson`: satu objek JSON per baris, dikirim bertahap.
Jenis event (lihat `StreamEvent` di `lib/types.ts`):

| `type` | Isi `value` | Kapan dikirim |
| --- | --- | --- |
| `text` | potongan teks | setiap chunk dari Gemini |
| `sources` | array `Source` (`id`, `title`, `url`, `domain`) | setelah stream selesai, bila ada sumber |
| `answer` | teks final lengkap dengan penanda `[1]`, `[2]` | menyusul `sources`, menggantikan teks yang sudah tampil |
| `related` | array 3 string pertanyaan | setelah jawaban ada isinya |
| `error` | objek `AppError` (`code`, `title`, `message`) | saat terjadi kesalahan |
| `done` | — | penutup stream |

Error yang terjadi **sebelum** stream dimulai (body bukan JSON, input kosong,
input kelewat panjang, API key belum diatur) dibalas dengan HTTP 400/500 tapi
tetap berformat NDJSON satu baris `{"type":"error",...}`, sehingga client bisa
memakai satu jalur pembacaan yang sama.

---

## Batas dan penyimpanan

| Hal | Nilai | Lokasi |
| --- | --- | --- |
| Panjang maksimal pertanyaan | 1000 karakter | `MAX_QUERY_LENGTH` di `lib/types.ts`, dibatasi di input dan divalidasi ulang di server |
| Konteks percakapan yang dikirim | 3 giliran terakhir dari client, dipotong lagi jadi maks. 10 pesan di server | `app/page.tsx`, `app/api/search/route.ts` |
| Panjang tiap pesan konteks | dipotong 8000 karakter | `app/api/search/route.ts` |
| Jawaban yang dikirim untuk membuat pertanyaan lanjutan | dipotong 4000 karakter | `app/api/search/route.ts` |
| Riwayat pencarian tersimpan | maks. 50 entri | `lib/history.ts` |
| Key `localStorage` | `gemini-ai-search:history`, `gemini-ai-search:theme` | `lib/history.ts`, `components/ThemeToggle.tsx` |

Semua penyimpanan ada di browser pengguna. Tidak ada database dan tidak ada data
yang disimpan di server.

---

## Penanganan error

`lib/errors.ts` menerjemahkan error mentah dari SDK menjadi pesan berbahasa
Indonesia berdasarkan kombinasi HTTP status dan isi pesan:

| Kode | Pemicu umum |
| --- | --- |
| `empty_input` | pertanyaan kosong |
| `input_too_long` | lebih dari 1000 karakter |
| `missing_api_key` | `GEMINI_API_KEY` kosong atau masih `your_api_key_here` |
| `invalid_api_key` | HTTP 401/403, pesan mengandung "api key" atau "permission_denied" |
| `rate_limit` | HTTP 429, "quota", "resource_exhausted" |
| `model_not_found` | HTTP 404 atau model tidak didukung |
| `network` | "fetch failed", ECONNRESET, ETIMEDOUT, HTTP 503/504 |
| `unknown` | sisanya |

Request yang dibatalkan user (pencarian baru saat jawaban masih jalan) tidak
dianggap error.

---

## Troubleshooting

| Gejala | Kemungkinan penyebab dan solusi |
| --- | --- |
| "API key belum diatur" | `.env.local` belum dibuat, atau isinya masih `your_api_key_here`. Isi lalu **restart** `npm run dev`. |
| "API key tidak valid" | Key salah salin atau sudah dicabut. Buat key baru di AI Studio. |
| "Kuota sedang habis" | Batas free tier tercapai. Tunggu beberapa menit lalu coba lagi. |
| "Model tidak ditemukan" | Nilai `GEMINI_MODEL` salah atau modelnya sudah pensiun. Cek daftar model aktif di ai.google.dev. |
| Jawaban muncul tapi tanpa kartu sumber | Untuk pertanyaan tertentu Gemini tidak memakai Google Search, jadi tidak ada grounding metadata. Ini normal. |
| Tema berkedip putih saat reload | Pastikan script anti-flash di `app/layout.tsx` tidak terhapus. |

---

## Catatan

- Jawaban AI bisa keliru — selalu cek pada kartu sumber yang ditampilkan.
- URL sumber dari Gemini berupa link redirect resmi Google; domain untuk label
  dan favicon diambil dari metadata grounding.
- Riwayat pencarian hanya tersimpan di browser pengguna (localStorage), tidak dikirim ke server.
- Favicon sumber diambil dari layanan favicon Google (`google.com/s2/favicons`),
  tanpa perlu API key tambahan.
