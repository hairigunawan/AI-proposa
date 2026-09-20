import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY belum diisi. Salin .env.example jadi .env lalu isi key kamu.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// Tipe lampiran yang bisa dibaca langsung oleh Gemini sebagai inline data.
// Format kantoran seperti .docx tidak ada di sini karena harus diekspor ke PDF dulu.
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

// Gemini membatasi total satu permintaan inline di kisaran 20MB. Angka ini
// dihitung dari panjang base64, jadi sedikit di bawah batas itu.
const MAX_INLINE_BASE64 = 17 * 1024 * 1024;

// Dipakai kalau mahasiswa mengirim lampiran tanpa menuliskan pertanyaan apa pun.
const DEFAULT_ATTACHMENT_PROMPT = 'Tolong tinjau lampiran berikut.';

// Galat yang sifatnya sementara: layak diulang sendiri sebelum menyerah ke pengguna.
// 503 "high demand" paling sering muncul dan biasanya hilang dalam hitungan detik.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(contents) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });
    } catch (error) {
      const retryable = RETRYABLE_STATUS.has(error && error.status);
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;

      // Jeda memanjang tiap percobaan, ditambah acak sedikit supaya banyak klien
      // tidak menabrak server di detik yang sama.
      const delay = Math.round(700 * 2 ** (attempt - 1) + Math.random() * 300);
      console.warn(`Gemini sibuk (${error.status}). Coba lagi ke-${attempt + 1} dalam ${delay}ms.`);
      await wait(delay);
    }
  }
}

// Pesan yang sampai ke layar sebaiknya memberi tahu apa yang harus dilakukan.
function describeError(error) {
  const status = error && error.status;

  if (status === 429) {
    return { code: 429, message: 'Kuota API sedang penuh. Tunggu sebentar lalu kirim ulang.' };
  }
  if (RETRYABLE_STATUS.has(status)) {
    return { code: 503, message: 'Model sedang ramai dan belum sempat menjawab. Kirim ulang sebentar lagi.' };
  }
  // Key yang salah dibalas 400 INVALID_ARGUMENT, bukan 401, jadi isi pesannya ikut
  // diperiksa supaya tidak tertukar dengan galat pada isi permintaan.
  const detail = String((error && error.message) || '');
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail)) {
    return { code: 500, message: 'GEMINI_API_KEY ditolak. Periksa kembali key di berkas .env.' };
  }
  if (status === 400) {
    return { code: 400, message: 'Permintaan ditolak Gemini. Periksa lagi isi pesan atau lampirannya.' };
  }
  if (status === 404) {
    return { code: 500, message: `Model ${MODEL} tidak tersedia untuk key ini. Ganti lewat GEMINI_MODEL di .env.` };
  }

  return { code: 500, message: 'Gagal mengambil jawaban dari Gemini.' };
}

function sanitizeFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .filter((file) => file && typeof file.data === 'string' && ALLOWED_MIME.has(file.mimeType))
    .map((file) => ({
      mimeType: file.mimeType,
      data: file.data,
      name: typeof file.name === 'string' ? file.name : '',
    }));
}

// Lampiran ditaruh sebelum teks karena Gemini lebih akurat membaca urutan itu.
// Nama berkas ikut disebut supaya model bisa merujuknya saat menjawab.
function buildParts(text, files) {
  const parts = files.map((file) => ({
    inlineData: { mimeType: file.mimeType, data: file.data },
  }));

  const names = files.map((file) => file.name).filter(Boolean);
  const label = names.length ? `[Lampiran: ${names.join(', ')}]\n` : '';
  const body = text || (files.length ? DEFAULT_ATTACHMENT_PROMPT : '');

  if (label || body) {
    parts.push({ text: `${label}${body}`.trim() });
  }

  return parts;
}

// System instruction: instruksi level tinggi yang menetapkan konteks, perilaku, dan
// batasan model SEBELUM user mengetik apa pun. User tidak pernah melihat teks ini.
// Disusun mengikuti empat fungsi system instruction: persona, nada bicara, batasan,
// dan format output.
const SYSTEM_INSTRUCTION = `
[PERSONA]
Kamu adalah asisten akademik yang mendampingi mahasiswa menyusun proposal Tugas Akhir.
Kamu memahami struktur proposal pada umumnya: latar belakang, rumusan masalah, batasan
masalah, tujuan, manfaat, tinjauan pustaka, dan metodologi penelitian. Kamu terbiasa
dengan penelitian kualitatif, kuantitatif, maupun pengembangan sistem, sehingga bisa
melayani mahasiswa dari bidang mana pun. Posisimu adalah pendamping yang membantu
mahasiswa berpikir, bukan penulis bayangan yang mengerjakan TA-nya.

[NADA BICARA]
Formal akademis namun tetap mudah dicerna. Gunakan bahasa Indonesia baku, hindari
istilah gaul, dan jangan bertele-tele. Boleh tegas saat menunjukkan kelemahan sebuah
rumusan masalah, tapi selalu sertai alasan dan jalan keluarnya. Panggil lawan bicara
dengan "kamu".

[BATASAN]
- Jangan pernah mengarang judul jurnal, nama penulis, tahun terbit, atau nomor DOI.
  Kalau mahasiswa butuh referensi, berikan kata kunci pencarian dan nama basis data
  seperti Google Scholar, Scopus, atau Garuda, lalu ingatkan bahwa setiap sitasi wajib
  dia verifikasi sendiri.
- Tolak dengan sopan jika diminta menuliskan satu bab utuh untuk disalin mentah-mentah.
  Tawarkan kerangka, poin-poin isi, atau contoh satu paragraf pembuka sebagai gantinya.
- Jangan mengklaim sesuatu sebagai temuan penelitian tanpa sumber yang jelas.
- Kalau topik mahasiswa masih terlalu luas, jangan langsung memberi jawaban jadi.
  Persempit dulu lewat pertanyaan yang mengarahkan.
- Jangan membahas hal di luar urusan penyusunan proposal TA. Kembalikan percakapan
  ke topik proposal dengan sopan.

[LAMPIRAN]
- Mahasiswa bisa melampirkan foto, tangkapan layar, PDF, atau catatan teks. Baca isinya
  lebih dulu, lalu kaitkan dengan bagian proposal yang sedang dibahas.
- Kalau lampiran buram, terpotong, atau tidak terbaca, katakan terus terang bagian mana
  yang tidak kelihatan. Jangan menebak isinya.
- Kalau lampiran berupa draf tulisan mahasiswa, nilai memakai format tiga bagian yang
  sudah ditetapkan di bawah.
- Kalau lampiran berupa jurnal atau artikel orang lain, bantu membacanya secara kritis,
  tapi tetap ingatkan bahwa sitasinya wajib dia verifikasi sendiri.

[FORMAT OUTPUT]
- Balas dalam teks biasa. Jangan memakai simbol markdown seperti tanda bintang atau
  pagar, karena tampilan chat menampilkan jawaban apa adanya tanpa mengolah markdown.
- Susun jawaban dalam poin bernomor atau bertanda hubung kalau isinya lebih dari satu
  gagasan. Satu poin maksimal dua kalimat.
- Saat menilai tulisan mahasiswa, pakai tiga bagian berurutan dengan label persis
  seperti ini: "Sudah kuat:", "Perlu diperbaiki:", lalu "Usulan revisi:".
- Tutup setiap jawaban dengan satu pertanyaan lanjutan untuk menjaga diskusi berjalan.
- Jaga panjang jawaban di bawah 200 kata kecuali mahasiswa meminta uraian panjang.
`.trim();

app.use(cors());
// Batas dinaikkan dari 100kb bawaan karena lampiran dikirim sebagai base64.
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  const { message, history = [], files = [] } = req.body;

  const text = typeof message === 'string' ? message.trim() : '';
  const attachments = sanitizeFiles(files);

  if (!text && !attachments.length) {
    return res.status(400).json({ error: 'Tulis pertanyaan atau lampirkan berkas dulu.' });
  }

  if (Array.isArray(files) && files.length && !attachments.length) {
    return res.status(415).json({
      error: 'Tipe lampiran itu belum didukung. Pakai gambar, PDF, atau berkas teks.',
    });
  }

  const inlineSize = attachments.reduce((total, file) => total + file.data.length, 0);
  if (inlineSize > MAX_INLINE_BASE64) {
    return res.status(413).json({ error: 'Total lampiran terlalu besar. Kecilkan dulu berkasnya.' });
  }

  try {
    // history dikirim frontend supaya Gemini ingat percakapan sebelumnya.
    // Giliran model tidak pernah membawa lampiran, jadi berkasnya diabaikan di sana.
    const contents = [
      ...history
        .map((item) => {
          const isBot = item.role === 'bot';
          return {
            role: isBot ? 'model' : 'user',
            parts: buildParts(
              typeof item.text === 'string' ? item.text : '',
              isBot ? [] : sanitizeFiles(item.files),
            ),
          };
        })
        .filter((item) => item.parts.length),
      { role: 'user', parts: buildParts(text, attachments) },
    ];

    const response = await generateWithRetry(contents);

    res.json({ reply: response.text });
  } catch (error) {
    console.error('Gagal memanggil Gemini:', error);
    const { code, message } = describeError(error);
    res.status(code).json({ error: message });
  }
});

// Tanpa ini, body yang kelewat besar dibalas halaman HTML bawaan Express dan
// frontend gagal membacanya sebagai JSON.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Lampiran terlalu besar untuk dikirim.' });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
