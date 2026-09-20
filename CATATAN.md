# Chatbot Asisten Penyusun Proposal TA

## Cara menjalankan

1. `npm install`
2. `npm start`
4. Buka http://localhost:3000

## Struktur

- `index.js`        backend Express, endpoint `POST /api/chat`, plus instruksi sistem
- `public/`         frontend (index.html, style.css, script.js)
- `.env`            API key, sudah diabaikan oleh .gitignore, jangan pernah di-commit

## Alur (sesuai diagram di slide)

User ketik pesan, `script.js` kirim `POST /api/chat` berisi `{ message, history }`,
`index.js` memanggil `ai.models.generateContent()` ke Gemini, hasilnya dibalas sebagai
JSON `{ reply }`, lalu frontend menampilkannya sebagai bubble chat.

Mengubah perilaku bot cukup dengan mengedit teks ini, kodenya tidak perlu disentuh.
Catatan: format output sengaja melarang markdown karena `script.js` menampilkan
jawaban dengan `textContent`, sehingga tanda bintang akan terlihat mentah di layar.

## Tambahan di luar starter

Array `history` di frontend dikirim ke backend setiap kali, supaya bot ingat percakapan
sebelumnya. Tanpa ini bot lupa konteks tiap kali kamu mengirim pesan baru, yang bikin
diskusi proposal jadi tidak nyambung.
