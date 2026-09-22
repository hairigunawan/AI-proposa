/* ============================================================
   TA Assistant — logika antarmuka
   ============================================================ */

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const scroller = document.getElementById('scroller');
const app = document.getElementById('app');
const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const micBtn = document.getElementById('mic-btn');
const previewBar = document.getElementById('attachment-preview');
const note = document.getElementById('composer-note');
const mainPane = document.querySelector('.main');

const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const scrim = document.getElementById('scrim');
const newChatBtn = document.getElementById('new-chat');
const searchInput = document.getElementById('history-search');
const historyGroups = document.getElementById('history-groups');
const historyEmpty = document.getElementById('history-empty');
const chatTitle = document.getElementById('chat-title');

const suggestionsBox = document.getElementById('suggestions');
const quickChips = document.getElementById('quick-chips');

const themeToggle = document.getElementById('theme-toggle');
const themeColorMeta = document.getElementById('theme-color');

const moreBtn = document.getElementById('more-btn');
const moreMenu = document.getElementById('more-menu');
const menuRename = document.getElementById('menu-rename');
const menuDelete = document.getElementById('menu-delete');
const menuClear = document.getElementById('menu-clear');

const profileBtn = document.getElementById('profile-btn');
const profilePopover = document.getElementById('profile-popover');
const profileInitials = document.getElementById('profile-initials');
const profileName = document.getElementById('profile-name');
const profileSub = document.getElementById('profile-sub');
const profileNameInput = document.getElementById('profile-name-input');
const profileSubInput = document.getElementById('profile-sub-input');
const profileSave = document.getElementById('profile-save');
const profileCancel = document.getElementById('profile-cancel');

// Batas dijaga di sisi klien juga supaya kesalahan ketahuan sebelum berkas diunggah.
const MAX_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

// Lampiran lama dilepas dari riwayat yang dikirim ke server supaya permintaan tidak
// membengkak tiap giliran. Tanpa ini, satu foto akan ikut terkirim ulang di semua
// pesan berikutnya.
const MAX_TURNS_WITH_FILES = 3;

// Riwayat percakapan disimpan di browser. Isi berkas (base64) sengaja tidak ikut
// disimpan karena akan menghabiskan kuota localStorage dalam beberapa lampiran.
// Nama kuncinya dipertahankan dari versi sebelumnya supaya riwayat lama tidak hilang.
const STORAGE_KEY = 'proposa.chats.v1';
const THEME_KEY = 'ta.theme';
const PROFILE_KEY = 'ta.profile';

const MAX_CONVERSATIONS = 40;
const DEFAULT_TITLE = 'Percakapan baru';
const DEFAULT_STATUS = 'Pendamping Proposal TA';

// Pintasan pembuka. Dipakai dua kali: sebagai kartu di layar sapaan dan
// sebagai chip di atas kolom input.
const STARTERS = [
  {
    icon: 'i-bulb',
    title: 'Bantu cari judul TA',
    desc: 'Brainstorming ide judul sesuai bidang & minatmu',
    prompt: 'Aku butuh ide judul Tugas Akhir. Tanyakan dulu apa yang perlu kamu tahu soal bidang dan minatku.',
  },
  {
    icon: 'i-check-list',
    title: 'Susun rumusan masalah',
    desc: 'Rumuskan masalah yang tajam dari latar belakang',
    prompt: 'Aku mau menyusun rumusan masalah dari latar belakang yang sudah kutulis. Mulai dari mana?',
  },
  {
    icon: 'i-doc',
    title: 'Review Bab 1 saya',
    desc: 'Beri masukan struktur & kejelasan latar belakang',
    prompt: 'Aku ingin kamu me-review draf Bab 1 punyaku. Apa saja yang perlu kusiapkan sebelum mengirim drafnya?',
  },
  {
    icon: 'i-spark',
    title: 'Tentukan metodologi',
    desc: 'Pilih metode penelitian yang tepat untuk topikmu',
    prompt: 'Bantu aku menentukan metodologi penelitian yang cocok untuk topik TA-ku.',
  },
];

// Sebagian berkas (.md misalnya) sering datang tanpa type dari browser,
// jadi ekstensinya dipakai sebagai cadangan.
const EXT_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
};

const ALLOWED_MIME = new Set(Object.values(EXT_TO_MIME));

// Semua percakapan, yang terbaru dipakai ada di depan. Bentuk tiap percakapan:
//   { id, title, updatedAt, waiting, thinkingEl,
//     history: [{ role: 'user' | 'bot', text, files: [{ name, mimeType, data? }], failed? }] }
// activeId bernilai null saat mahasiswa berada di percakapan baru yang belum dikirimi apa pun.
let conversations = [];
let activeId = null;

// Berkas yang sudah dipilih tapi belum dikirim.
let pending = [];
let pendingId = 0;
let noteTimer;
let busy = false;
let sending = false;
let storageWarned = false;
let searchQuery = '';

const mobileQuery = window.matchMedia('(max-width: 820px)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/* ============================================================
   Ikon
   ============================================================ */

// Membuat <svg><use href="#id"/></svg> dari kumpulan simbol di index.html.
function icon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

/* ============================================================
   Tema terang / gelap
   ============================================================ */

// Tema yang sedang terlihat: pilihan manual kalau ada, kalau tidak ikut sistem.
function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return darkQuery.matches ? 'dark' : 'light';
}

function syncThemeButton() {
  const dark = currentTheme() === 'dark';
  themeToggle.setAttribute('aria-label', dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
  // Warna bilah alamat di browser ponsel ikut berubah.
  themeColorMeta.setAttribute('content', dark ? '#0a0a0b' : '#ffffff');
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (error) {
    // Mode privat: temanya tetap berubah, hanya tidak diingat setelah ditutup.
  }
  syncThemeButton();
}

// Selama belum ada pilihan manual, tampilan ikut setelan sistem yang berubah.
darkQuery.addEventListener('change', () => {
  if (!document.documentElement.dataset.theme) syncThemeButton();
});

themeToggle.addEventListener('click', toggleTheme);

/* ============================================================
   Profil pemakai
   ============================================================ */

let profile = { name: '', sub: '' };

function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TA';
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join('').toUpperCase();
}

function renderProfile() {
  profileName.textContent = profile.name || 'Mahasiswa';
  profileSub.textContent = profile.sub || 'Atur nama & program studi';
  profileInitials.textContent = initialsOf(profile.name);
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      profile.name = String(saved.name || '').slice(0, 40);
      profile.sub = String(saved.sub || '').slice(0, 48);
    }
  } catch (error) {
    profile = { name: '', sub: '' };
  }
  renderProfile();
}

function saveProfile() {
  profile.name = profileNameInput.value.trim().slice(0, 40);
  profile.sub = profileSubInput.value.trim().slice(0, 48);

  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    showNote('Profil tidak bisa disimpan di browser ini.');
  }

  renderProfile();
  closePopover(true);
}

/* ============================================================
   Popover: menu titik tiga dan form profil
   ============================================================ */

let openPop = null;

function openPopover(pop, trigger) {
  closePopover(false);
  pop.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  openPop = { pop, trigger };
}

function closePopover(returnFocus) {
  if (!openPop) return;
  openPop.pop.hidden = true;
  openPop.trigger.setAttribute('aria-expanded', 'false');
  if (returnFocus) openPop.trigger.focus();
  openPop = null;
}

// Klik di luar menutup popover yang sedang terbuka.
document.addEventListener('pointerdown', (e) => {
  if (!openPop) return;
  if (openPop.pop.contains(e.target) || openPop.trigger.contains(e.target)) return;
  closePopover(false);
});

moreBtn.addEventListener('click', () => {
  if (openPop && openPop.pop === moreMenu) {
    closePopover(true);
    return;
  }
  // Dua menu teratas tidak berlaku saat belum ada percakapan yang dibuka.
  const convo = activeConvo();
  menuRename.disabled = !convo;
  menuDelete.disabled = !convo;
  menuClear.disabled = conversations.length === 0;
  openPopover(moreMenu, moreBtn);
});

profileBtn.addEventListener('click', () => {
  if (openPop && openPop.pop === profilePopover) {
    closePopover(true);
    return;
  }
  profileNameInput.value = profile.name;
  profileSubInput.value = profile.sub;
  openPopover(profilePopover, profileBtn);
  profileNameInput.focus();
});

profileSave.addEventListener('click', saveProfile);
profileCancel.addEventListener('click', () => closePopover(true));

// Enter di dalam form profil menyimpan, bukan mengirim pesan.
profilePopover.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveProfile();
  }
});

/* ============================================================
   Lampiran
   ============================================================ */

function mimeOf(file) {
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return EXT_TO_MIME[ext] || file.type || '';
}

function isImage(mimeType) {
  return mimeType.startsWith('image/');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extLabel(name) {
  return name.split('.').pop().toUpperCase().slice(0, 4);
}

function showNote(text) {
  note.textContent = text;
  note.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    note.hidden = true;
  }, 6000);
}

function totalPendingBytes() {
  return pending.reduce((sum, item) => sum + item.file.size, 0);
}

function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  const rejected = [];

  for (const file of incoming) {
    if (pending.length >= MAX_FILES) {
      rejected.push(`maksimal ${MAX_FILES} lampiran sekali kirim`);
      break;
    }

    const mimeType = mimeOf(file);

    if (!ALLOWED_MIME.has(mimeType)) {
      rejected.push(`${file.name} (tipe belum didukung)`);
      continue;
    }

    if (file.size > MAX_FILE_BYTES) {
      rejected.push(`${file.name} (lebih dari ${formatSize(MAX_FILE_BYTES)})`);
      continue;
    }

    if (totalPendingBytes() + file.size > MAX_TOTAL_BYTES) {
      rejected.push(`${file.name} (total lampiran lewat ${formatSize(MAX_TOTAL_BYTES)})`);
      continue;
    }

    const duplicate = pending.some(
      (item) => item.file.name === file.name && item.file.size === file.size,
    );
    if (duplicate) continue;

    pending.push({
      id: `f${pendingId++}`,
      file,
      mimeType,
      // Pratinjau pakai object URL supaya berkas besar tidak perlu dibaca dua kali.
      url: isImage(mimeType) ? URL.createObjectURL(file) : '',
    });
  }

  if (rejected.length) {
    showNote(`Tidak bisa dilampirkan: ${rejected.join(', ')}.`);
  }

  renderPreview();
}

function removeFile(id) {
  const index = pending.findIndex((item) => item.id === id);
  if (index === -1) return;

  if (pending[index].url) URL.revokeObjectURL(pending[index].url);
  pending.splice(index, 1);
  renderPreview();
}

function clearPending() {
  pending.forEach((item) => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
  pending = [];
  renderPreview();
}

function renderPreview() {
  previewBar.replaceChildren();
  previewBar.hidden = pending.length === 0;

  for (const item of pending) {
    const chip = document.createElement('div');
    chip.className = 'chip';

    if (item.url) {
      const thumb = document.createElement('img');
      thumb.className = 'chip-thumb';
      thumb.src = item.url;
      thumb.alt = '';
      chip.appendChild(thumb);
    } else {
      const badge = document.createElement('span');
      badge.className = 'chip-icon';
      badge.textContent = extLabel(item.file.name);
      chip.appendChild(badge);
    }

    const meta = document.createElement('span');
    meta.className = 'chip-meta';

    const name = document.createElement('span');
    name.className = 'chip-name';
    name.textContent = item.file.name;

    const size = document.createElement('span');
    size.className = 'chip-size';
    size.textContent = formatSize(item.file.size);

    meta.append(name, size);
    chip.appendChild(meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chip-remove';
    remove.setAttribute('aria-label', `Hapus lampiran ${item.file.name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => removeFile(item.id));
    chip.appendChild(remove);

    previewBar.appendChild(chip);
  }
}

// Gemini menerima lampiran sebagai base64 tanpa awalan data URL.
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca berkas.'));
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   Bubble percakapan
   ============================================================ */

function scrollToBottom() {
  scroller.scrollTop = scroller.scrollHeight;
}

function attachmentNode(attachment) {
  // Setelah halaman dimuat ulang isi gambar tidak ada lagi (hanya nama yang
  // disimpan), jadi tampilannya jatuh ke chip berkas.
  if (isImage(attachment.mimeType) && attachment.data) {
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.src = `data:${attachment.mimeType};base64,${attachment.data}`;
    img.alt = attachment.name;
    // Gambar baru menambah tinggi setelah selesai dimuat, jadi digulir ulang.
    img.addEventListener('load', scrollToBottom);
    return img;
  }

  const file = document.createElement('span');
  file.className = 'msg-file';

  const badge = document.createElement('span');
  badge.className = 'chip-icon';
  badge.textContent = extLabel(attachment.name);

  const name = document.createElement('span');
  name.className = 'chip-name';
  name.textContent = attachment.name;

  file.append(badge, name);
  return file;
}

function appendMessage(sender, text, attachments = []) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);

  if (attachments.length) {
    const files = document.createElement('div');
    files.className = 'msg-files';
    attachments.forEach((attachment) => files.appendChild(attachmentNode(attachment)));
    msg.appendChild(files);
  }

  const body = document.createElement('span');
  body.className = 'msg-text';
  body.textContent = text;
  if (!text) body.hidden = true;
  msg.appendChild(body);

  chatBox.appendChild(msg);
  app.classList.add('has-messages');
  scrollToBottom();
  return msg;
}

// Penanda "menunggu jawaban": tiga titik bergelombang dan label yang berkilau.
// Titiknya hiasan saja; labelnya yang dibacakan pembaca layar.
function appendThinking() {
  const msg = appendMessage('bot', '');
  msg.classList.add('is-thinking');

  const dots = document.createElement('span');
  dots.className = 'thinking-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('i'));

  const label = document.createElement('span');
  label.className = 'thinking-label';
  label.textContent = 'Sedang berpikir';

  const wrap = document.createElement('span');
  wrap.className = 'thinking';
  wrap.append(dots, label);

  const body = msg.querySelector('.msg-text');
  body.hidden = false;
  body.appendChild(wrap);
  return msg;
}

// Bubble dibangun dari beberapa elemen, jadi teksnya diganti lewat bagian ini saja
// supaya lampiran yang sudah tampil tidak ikut terhapus.
function setMessageText(msg, text) {
  const body = msg.querySelector('.msg-text');
  body.textContent = text;
  body.hidden = false;

  // Penanda berpikir berubah jadi jawaban: teksnya muncul dengan efek fade-in.
  if (msg.classList.contains('is-thinking')) {
    msg.classList.remove('is-thinking');
    msg.classList.add('is-reply');
  }
  scrollToBottom();
}

/* ============================================================
   Penyimpanan riwayat
   ============================================================ */

function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function restoreConversation(saved) {
  const history = saved.history
    .filter(
      (item) =>
        item && (item.role === 'user' || item.role === 'bot') && typeof item.text === 'string',
    )
    .map((item) => ({
      role: item.role,
      text: item.text,
      files: (Array.isArray(item.files) ? item.files : [])
        .filter((file) => file && typeof file.name === 'string')
        .map((file) => ({ name: file.name, mimeType: String(file.mimeType || '') })),
      failed: item.failed === true,
    }));

  // Permintaan yang terputus karena halaman ditutup tidak pernah dapat balasan.
  // Ditandai gagal supaya tidak ikut terkirim sebagai konteks berikutnya.
  const last = history[history.length - 1];
  if (last && last.role === 'user') last.failed = true;

  return {
    id: saved.id,
    title: String(saved.title || DEFAULT_TITLE),
    updatedAt: Number(saved.updatedAt) || Date.now(),
    history,
    waiting: false,
    thinkingEl: null,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.conversations)) return;

    conversations = saved.conversations
      .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.history))
      .map(restoreConversation);
    activeId = conversations.some((c) => c.id === saved.activeId) ? saved.activeId : null;
  } catch (error) {
    conversations = [];
    activeId = null;
  }
}

function saveState() {
  try {
    const plain = conversations.map((convo) => ({
      id: convo.id,
      title: convo.title,
      updatedAt: convo.updatedAt,
      history: convo.history.map((item) => {
        const saved = { role: item.role, text: item.text };
        if (item.failed) saved.failed = true;
        if (item.files && item.files.length) {
          saved.files = item.files.map((file) => ({ name: file.name, mimeType: file.mimeType }));
        }
        return saved;
      }),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, conversations: plain }));
  } catch (error) {
    // Penyimpanan penuh atau diblokir (mode privat). Aplikasi tetap jalan di memori,
    // tapi mahasiswa perlu tahu bahwa riwayatnya tidak akan bertahan.
    if (!storageWarned) {
      storageWarned = true;
      showNote('Riwayat tidak bisa disimpan di browser ini, jadi akan hilang saat halaman ditutup.');
    }
  }
}

function activeConvo() {
  return conversations.find((convo) => convo.id === activeId) || null;
}

function createConversation() {
  const convo = {
    id: newId(),
    title: DEFAULT_TITLE,
    updatedAt: Date.now(),
    history: [],
    waiting: false,
    thinkingEl: null,
  };
  conversations.unshift(convo);
  // Yang paling lama tidak disentuh dibuang duluan.
  if (conversations.length > MAX_CONVERSATIONS) conversations.length = MAX_CONVERSATIONS;
  return convo;
}

// Percakapan yang baru dipakai naik ke urutan teratas.
function touch(convo) {
  const index = conversations.indexOf(convo);
  if (index === -1) return;
  conversations.splice(index, 1);
  conversations.unshift(convo);
  convo.updatedAt = Date.now();
}

function deriveTitle(text, files) {
  const base = text.replace(/\s+/g, ' ').trim() || (files[0] && files[0].name) || DEFAULT_TITLE;
  return base.length > 46 ? `${base.slice(0, 45).trimEnd()}…` : base;
}

/* ============================================================
   Riwayat yang dikirim ke server
   ============================================================ */

// Isi berkas hanya dibawa untuk beberapa giliran terakhir. Giliran yang lebih lama
// (atau yang berkasnya sudah hilang setelah muat ulang) diganti catatan nama berkas
// supaya konteksnya tidak putus. Giliran yang gagal tidak pernah ikut dikirim.
function buildPayloadHistory(convo) {
  const items = convo.history.filter((item) => !item.failed);
  const payload = [];
  let turnsWithFiles = 0;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const files = item.files || [];
    const entry = { role: item.role, text: item.text };

    if (files.length) {
      turnsWithFiles++;
      const complete = files.every((file) => typeof file.data === 'string' && file.data);

      if (turnsWithFiles <= MAX_TURNS_WITH_FILES && complete) {
        entry.files = files;
      } else {
        const names = files.map((file) => file.name).join(', ');
        entry.text = `${item.text}\n[lampiran sebelumnya: ${names}]`.trim();
      }
    }

    payload.unshift(entry);
  }

  return payload;
}

// Berkas yang sudah lewat jendela di atas tidak akan dikirim lagi, jadi isinya
// dibuang dari memori. Namanya tetap ada untuk ditampilkan dan disebut sebagai konteks.
function pruneAttachmentData(convo) {
  let turnsWithFiles = 0;

  for (let i = convo.history.length - 1; i >= 0; i--) {
    const item = convo.history[i];
    if (item.failed || !item.files || !item.files.length) continue;

    turnsWithFiles++;
    if (turnsWithFiles > MAX_TURNS_WITH_FILES) {
      item.files.forEach((file) => {
        delete file.data;
      });
    }
  }
}

/* ============================================================
   Daftar riwayat: pencarian, pengelompokan, cuplikan
   ============================================================ */

// Label kelompok dihitung dari selisih hari kalender, bukan selisih jam, supaya
// pesan pukul 23.00 kemarin tidak ikut masuk "Hari ini".
function groupLabel(timestamp) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfThen = new Date(timestamp);
  startOfThen.setHours(0, 0, 0, 0);

  const days = Math.round((startOfToday - startOfThen) / 86400000);

  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  if (days < 7) return '7 hari terakhir';
  if (days < 30) return '30 hari terakhir';
  return 'Lebih lama';
}

// Cuplikan di bawah judul: pesan terakhir yang ada isinya.
function previewOf(convo) {
  for (let i = convo.history.length - 1; i >= 0; i--) {
    const item = convo.history[i];
    if (item.text && item.text.trim()) return item.text.replace(/\s+/g, ' ').trim();
    if (item.files && item.files.length) {
      return item.files.map((file) => file.name).join(', ');
    }
  }
  return 'Belum ada pesan.';
}

function matchesSearch(convo) {
  if (!searchQuery) return true;
  if (convo.title.toLowerCase().includes(searchQuery)) return true;
  return convo.history.some((item) => item.text && item.text.toLowerCase().includes(searchQuery));
}

function historyItemNode(convo) {
  const active = convo.id === activeId;

  const item = document.createElement('li');
  item.className = active ? 'history-item is-active' : 'history-item';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'history-open';
  open.title = convo.title;
  if (active) open.setAttribute('aria-current', 'true');
  open.addEventListener('click', () => selectConversation(convo.id));

  const meta = document.createElement('span');
  meta.className = 'history-meta';

  const title = document.createElement('span');
  title.className = 'history-title';
  title.textContent = convo.title;

  const preview = document.createElement('span');
  preview.className = 'history-preview';
  preview.textContent = previewOf(convo);

  meta.append(title, preview);
  open.append(icon('i-chat'), meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'history-delete';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Hapus percakapan: ${convo.title}`);
  remove.addEventListener('click', () => deleteConversation(convo.id));

  item.append(open, remove);
  return item;
}

function renderHistoryList() {
  historyGroups.replaceChildren();

  const visible = conversations.filter(matchesSearch);

  if (!visible.length) {
    historyEmpty.hidden = false;
    historyEmpty.textContent = conversations.length
      ? 'Tidak ada percakapan yang cocok.'
      : 'Percakapanmu akan muncul di sini.';
    return;
  }

  historyEmpty.hidden = true;

  // conversations sudah urut dari yang terbaru, jadi kelompoknya ikut urut sendiri.
  let currentLabel = null;
  let list = null;

  for (const convo of visible) {
    const label = groupLabel(convo.updatedAt);

    if (label !== currentLabel) {
      currentLabel = label;

      const group = document.createElement('div');
      group.className = 'history-group';

      const heading = document.createElement('p');
      heading.className = 'history-label';
      heading.textContent = label;

      list = document.createElement('ul');
      list.className = 'history-list';
      list.setAttribute('aria-label', label);

      group.append(heading, list);
      historyGroups.appendChild(group);
    }

    list.appendChild(historyItemNode(convo));
  }
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderHistoryList();
});

/* ============================================================
   Pintasan pertanyaan
   ============================================================ */

// Pintasan hanya mengisi kolom input, tidak langsung mengirim, supaya mahasiswa
// bisa menambahkan bidang atau topiknya dulu sebelum bertanya.
function useStarter(prompt) {
  input.value = prompt;
  input.focus();
  input.setSelectionRange(prompt.length, prompt.length);
}

function renderStarters() {
  for (const starter of STARTERS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'suggestion';

    const iconBox = document.createElement('span');
    iconBox.className = 'suggestion-icon';
    iconBox.appendChild(icon(starter.icon));

    const text = document.createElement('span');
    text.className = 'suggestion-text';

    const title = document.createElement('span');
    title.className = 'suggestion-title';
    title.textContent = starter.title;

    const desc = document.createElement('span');
    desc.className = 'suggestion-desc';
    desc.textContent = starter.desc;

    text.append(title, desc);
    card.append(iconBox, text);
    card.addEventListener('click', () => useStarter(starter.prompt));
    suggestionsBox.appendChild(card);

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quick-chip';
    chip.textContent = starter.title;
    chip.addEventListener('click', () => useStarter(starter.prompt));
    quickChips.appendChild(chip);
  }
}

/* ============================================================
   Tampilan percakapan
   ============================================================ */

function setBusy(state) {
  busy = state;
  form.classList.toggle('is-busy', state);
  input.disabled = state;
  attachBtn.disabled = state;
  micBtn.disabled = state;
  form.querySelector('button[type="submit"]').disabled = state;
}

// Status "menunggu jawaban" milik tiap percakapan, bukan milik halaman. Jadi pindah
// ke percakapan lain saat jawaban belum datang tidak mengunci kolom input di sana.
function syncBusy() {
  const convo = activeConvo();
  setBusy(sending || Boolean(convo && convo.waiting));
}

// Menggambar ulang panel chat dari percakapan aktif.
function showConversation() {
  const convo = activeConvo();

  chatBox.replaceChildren();
  chatTitle.textContent = convo ? convo.title : DEFAULT_STATUS;
  // Kartu sapaan hanya tampil di percakapan yang masih kosong.
  app.classList.toggle('has-messages', Boolean(convo && convo.history.length));

  if (convo) {
    for (const item of convo.history) {
      const msg = appendMessage(item.role === 'bot' ? 'bot' : 'user', item.text, item.files || []);
      if (item.failed && item.role === 'bot') msg.classList.add('is-error');
    }
    // Jawabannya belum datang: tampilkan penanda yang nanti diisi saat balasan tiba.
    convo.thinkingEl = convo.waiting ? appendThinking() : null;
  }

  syncBusy();
  renderHistoryList();
  scrollToBottom();
}

// Setelah berpindah percakapan: di ponsel laci ditutup, di desktop kursor kembali ke kolom input.
function afterNavigate() {
  if (mobileQuery.matches) {
    closeSidebar(true);
  } else {
    input.focus();
  }
}

function selectConversation(id) {
  if (id !== activeId) {
    activeId = id;
    clearPending();
    showConversation();
    saveState();
  }
  afterNavigate();
}

function startNewConversation() {
  if (activeId !== null) {
    activeId = null;
    clearPending();
    showConversation();
    saveState();
  }
  afterNavigate();
}

function deleteConversation(id) {
  const convo = conversations.find((c) => c.id === id);
  if (!convo) return;
  if (!window.confirm(`Hapus percakapan "${convo.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;

  conversations = conversations.filter((c) => c.id !== id);

  if (activeId === id) {
    activeId = null;
    clearPending();
    showConversation();
  } else {
    renderHistoryList();
  }

  saveState();
  // Tombol yang tadi ditekan sudah hilang dari halaman, jadi fokus dipindahkan
  // ke tombol terdekat supaya pengguna keyboard tidak kehilangan posisi.
  newChatBtn.focus();
}

function renameConversation() {
  const convo = activeConvo();
  if (!convo) return;

  const name = window.prompt('Nama percakapan:', convo.title);
  if (name === null) return;

  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return;

  convo.title = trimmed;
  chatTitle.textContent = trimmed;
  renderHistoryList();
  saveState();
}

function clearAllConversations() {
  if (!conversations.length) return;
  if (!window.confirm(`Hapus semua ${conversations.length} percakapan? Tindakan ini tidak bisa dibatalkan.`)) return;

  conversations = [];
  activeId = null;
  clearPending();
  showConversation();
  saveState();
}

menuRename.addEventListener('click', () => {
  closePopover(false);
  renameConversation();
});

menuDelete.addEventListener('click', () => {
  closePopover(false);
  if (activeId) deleteConversation(activeId);
});

menuClear.addEventListener('click', () => {
  closePopover(false);
  clearAllConversations();
});

/* ============================================================
   Laci riwayat di layar sempit
   ============================================================ */

function openSidebar() {
  document.body.classList.add('sidebar-open');
  sidebarToggle.setAttribute('aria-expanded', 'true');
  // Isi halaman dikunci selama laci terbuka supaya Tab tidak lari ke belakang scrim.
  mainPane.inert = true;
  newChatBtn.focus();
}

function closeSidebar(returnFocus) {
  if (!document.body.classList.contains('sidebar-open')) return;

  document.body.classList.remove('sidebar-open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
  mainPane.inert = false;
  if (returnFocus) sidebarToggle.focus();
}

sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', () => closeSidebar(true));
scrim.addEventListener('click', () => closeSidebar(true));
newChatBtn.addEventListener('click', startNewConversation);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Popover ditutup lebih dulu; laci baru menyusul kalau tidak ada popover terbuka.
  if (openPop) {
    closePopover(true);
    return;
  }
  closeSidebar(true);
});

// Kalau jendela dilebarkan saat laci terbuka, laci tidak perlu ditutup manual lagi.
mobileQuery.addEventListener('change', (e) => {
  if (!e.matches) closeSidebar(false);
});

/* ============================================================
   Dikte suara
   ============================================================ */

const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let micBase = '';

function stopMicUi() {
  micBtn.classList.remove('is-recording');
  micBtn.setAttribute('aria-label', 'Dikte dengan suara');
  recognition = null;
}

function startMic() {
  recognition = new SpeechRecognitionApi();
  recognition.lang = 'id-ID';
  recognition.interimResults = true;
  recognition.continuous = false;

  // Hasil dikte ditambahkan di belakang teks yang sudah diketik, bukan menimpanya.
  micBase = input.value.trim();

  recognition.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    input.value = (micBase ? `${micBase} ` : '') + text.trim();
  };

  recognition.onerror = (e) => {
    stopMicUi();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showNote('Izin mikrofon ditolak. Aktifkan lewat setelan situs di browser.');
    } else if (e.error === 'no-speech') {
      showNote('Tidak ada suara yang terdengar. Coba lagi.');
    } else if (e.error !== 'aborted') {
      showNote('Pengenalan suara gagal dijalankan.');
    }
  };

  recognition.onend = () => {
    stopMicUi();
    input.focus();
  };

  try {
    recognition.start();
  } catch (error) {
    stopMicUi();
    return;
  }

  micBtn.classList.add('is-recording');
  micBtn.setAttribute('aria-label', 'Hentikan dikte');
}

// Tombol mikrofon hanya ditampilkan kalau browsernya memang mendukung.
if (SpeechRecognitionApi) {
  micBtn.hidden = false;
  micBtn.addEventListener('click', () => {
    if (recognition) {
      recognition.stop();
      return;
    }
    startMic();
  });
}

/* ============================================================
   Kirim
   ============================================================ */

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  if (sending) return;

  const current = activeConvo();
  if (current && current.waiting) return;

  const userMessage = input.value.trim();
  if (!userMessage && !pending.length) return;

  // Selama berkas dibaca, kolom dikunci supaya pesan tidak terkirim dua kali.
  sending = true;
  syncBusy();

  let attachments = [];
  try {
    attachments = await Promise.all(
      pending.map(async (item) => ({
        name: item.file.name,
        mimeType: item.mimeType,
        data: await readAsBase64(item.file),
      })),
    );
  } catch (error) {
    sending = false;
    syncBusy();
    showNote('Gagal membaca lampiran. Coba pilih ulang berkasnya.');
    return;
  }

  // Percakapan baru baru dibuat sekarang, supaya tombol "Percakapan Baru"
  // tidak meninggalkan entri kosong di riwayat.
  let convo = activeConvo();
  if (!convo) {
    convo = createConversation();
    activeId = convo.id;
  }

  // Riwayat untuk server disusun sebelum pesan ini masuk; pesan ini dikirim terpisah.
  const payloadHistory = buildPayloadHistory(convo);

  const userItem = { role: 'user', text: userMessage, files: attachments, failed: false };
  convo.history.push(userItem);
  if (convo.title === DEFAULT_TITLE) convo.title = deriveTitle(userMessage, attachments);
  convo.waiting = true;
  touch(convo);

  appendMessage('user', userMessage, attachments);
  input.value = '';
  clearPending();
  convo.thinkingEl = appendThinking();

  chatTitle.textContent = convo.title;
  renderHistoryList();
  saveState();
  sending = false;
  syncBusy();

  let replyText;
  let failed = false;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, history: payloadHistory, files: attachments }),
    });

    const data = await response.json();

    if (!response.ok) {
      replyText = data.error || 'Terjadi kesalahan di server.';
      failed = true;
    } else if (!data.reply) {
      replyText = 'Model tidak mengembalikan jawaban. Coba ulangi pertanyaanmu.';
      failed = true;
    } else {
      replyText = data.reply;
    }
  } catch (error) {
    replyText = 'Gagal menghubungi server. Pastikan server sedang jalan.';
    failed = true;
  }

  // Bubble penanda berpikir bisa saja sudah diganti kalau mahasiswa sempat
  // berpindah percakapan dan kembali, jadi rujukan terbarunya diambil di sini.
  const thinking = convo.thinkingEl;
  convo.waiting = false;
  convo.thinkingEl = null;

  // Percakapannya dihapus selagi menunggu: tidak ada lagi tempat untuk menaruh balasan.
  if (!conversations.includes(convo)) return;

  userItem.failed = failed;
  convo.history.push({ role: 'bot', text: replyText, files: [], failed });
  if (!failed) pruneAttachmentData(convo);

  const movedUp = conversations[0] !== convo;
  touch(convo);
  // Cuplikan di sidebar ikut berubah begitu jawaban masuk, jadi selalu digambar ulang.
  renderHistoryList();
  saveState();

  if (convo.id === activeId) {
    if (thinking && thinking.isConnected) {
      setMessageText(thinking, replyText);
      if (failed) thinking.classList.add('is-error');
    } else {
      showConversation();
    }
    syncBusy();
    // Fokus hanya dikembalikan ke kolom input kalau tidak sedang dipegang elemen lain
    // (misalnya tombol di sidebar).
    if (document.activeElement === document.body) input.focus();
  }
});

/* ============================================================
   Cara melampirkan
   ============================================================ */

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  // Direset supaya berkas yang sama bisa dipilih lagi setelah dihapus.
  fileInput.value = '';
});

// Tempel tangkapan layar langsung dari papan klip.
input.addEventListener('paste', (e) => {
  const files = e.clipboardData && e.clipboardData.files;
  if (files && files.length) {
    e.preventDefault();
    addFiles(files);
  }
});

// Seret berkas ke mana saja di panel chat.
let dragDepth = 0;

mainPane.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  mainPane.classList.add('is-dragging');
});

mainPane.addEventListener('dragover', (e) => {
  e.preventDefault();
});

mainPane.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) mainPane.classList.remove('is-dragging');
});

mainPane.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  mainPane.classList.remove('is-dragging');
  if (e.dataTransfer) addFiles(e.dataTransfer.files);
});

// Tanpa ini, berkas yang meleset dari panel akan dibuka oleh browser.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

/* ============================================================
   Mulai
   ============================================================ */

syncThemeButton();
loadProfile();
renderStarters();
loadState();
showConversation();
