/* ═══════════════════════════════════════════════════════════════
   main.js  —  RAGmind Chatbot frontend logic
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── DOM refs ───────────────────────────────────────────────────
const sidebar       = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const topbarToggle  = document.getElementById('topbar-toggle');
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const browseBtn     = document.getElementById('browse-btn');
const uploadStatus  = document.getElementById('upload-status');
const statusFill    = document.getElementById('status-fill');
const statusText    = document.getElementById('status-text');
const docCard       = document.getElementById('doc-card');
const docName       = document.getElementById('doc-name');
const docRemove     = document.getElementById('doc-remove');
const chatThread    = document.getElementById('chat-thread');
const welcome       = document.getElementById('welcome');
const questionInput = document.getElementById('question-input');
const sendBtn       = document.getElementById('send-btn');
const clearBtn      = document.getElementById('clear-btn');
const topbarSub     = document.getElementById('topbar-sub');
const docLoadedLabel= document.getElementById('doc-loaded-label');

// ── State ──────────────────────────────────────────────────────
let pdfLoaded  = false;
let isThinking = false;

// ── Grid canvas (ambient decoration) ──────────────────────────
(function initGrid() {
  const canvas = document.getElementById('grid-canvas');
  const ctx    = canvas.getContext('2d');

  function draw() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(167,139,250,1)';
    ctx.lineWidth   = .5;

    const step = 48;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  draw();
  window.addEventListener('resize', draw);
})();

// ── Sidebar toggle ──────────────────────────────────────────────
function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
}
sidebarToggle.addEventListener('click', toggleSidebar);
topbarToggle.addEventListener('click',  toggleSidebar);

// ── Auto-grow textarea ──────────────────────────────────────────
questionInput.addEventListener('input', () => {
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 150) + 'px';
  updateSendBtn();
});

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

function updateSendBtn() {
  sendBtn.disabled = !pdfLoaded || isThinking || !questionInput.value.trim();
}

// ── Drag-and-drop upload ────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

// ── Upload file ─────────────────────────────────────────────────
async function uploadFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showStatus('⚠ Only PDF files are supported.', false);
    return;
  }

  // Show progress
  uploadStatus.hidden = false;
  docCard.hidden = true;
  animateProgress();
  statusText.textContent = `Processing "${file.name}" …`;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res  = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      pdfLoaded = true;
      statusFill.style.width = '100%';
      statusText.textContent = '✓ ' + data.message;
      statusText.style.color = 'var(--emerald)';

      docName.textContent = data.filename;
      docCard.hidden = false;

      topbarSub.textContent = data.filename;
      docLoadedLabel.textContent = data.filename;
      docLoadedLabel.style.color = 'var(--emerald)';
    } else {
      showStatus('✗ ' + data.message, false);
      statusText.style.color = 'var(--rose)';
    }
  } catch (err) {
    showStatus('✗ Network error: ' + err.message, false);
    statusText.style.color = 'var(--rose)';
  }

  updateSendBtn();
}

function animateProgress() {
  statusFill.style.width = '0%';
  statusFill.style.transition = 'width 2s ease';
  requestAnimationFrame(() => { statusFill.style.width = '85%'; });
}

function showStatus(msg) {
  uploadStatus.hidden = false;
  statusText.textContent = msg;
}

// ── Remove document ──────────────────────────────────────────────
docRemove.addEventListener('click', () => {
  pdfLoaded = false;
  docCard.hidden = true;
  uploadStatus.hidden = true;
  statusFill.style.width = '0%';
  statusText.style.color = '';
  fileInput.value = '';
  topbarSub.textContent = 'Upload a PDF to begin';
  docLoadedLabel.textContent = 'No document loaded';
  docLoadedLabel.style.color = '';
  updateSendBtn();
});

// ── Clear conversation ───────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  // Remove all messages but keep welcome if needed
  const messages = chatThread.querySelectorAll('.message');
  messages.forEach(m => m.remove());
  if (!welcome) {
    const w = buildWelcome();
    chatThread.prepend(w);
  } else {
    welcome.style.display = '';
  }
});

// ── Starter chips ────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (!pdfLoaded) {
      pulseDropZone();
      return;
    }
    questionInput.value = chip.dataset.q;
    updateSendBtn();
    handleSend();
  });
});

function pulseDropZone() {
  dropZone.style.borderColor = 'var(--rose)';
  setTimeout(() => { dropZone.style.borderColor = ''; }, 800);
}

// ── Send message ─────────────────────────────────────────────────
sendBtn.addEventListener('click', handleSend);

async function handleSend() {
  const question = questionInput.value.trim();
  if (!question || isThinking || !pdfLoaded) return;

  // Hide welcome screen
  if (welcome) welcome.style.display = 'none';

  // Clear input
  questionInput.value = '';
  questionInput.style.height = 'auto';

  isThinking = true;
  updateSendBtn();

  // Append user message
  appendMessage('user', question);

  // Typing indicator
  const typingEl = appendTyping();

  try {
    const res  = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();

    typingEl.remove();

    if (data.success) {
      appendMessage('ai', data.answer, data.sources || []);
    } else {
      appendMessage('ai', '⚠ ' + data.message, []);
    }
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', '⚠ Network error: ' + err.message, []);
  }

  isThinking = false;
  updateSendBtn();
}

// ── DOM builders ─────────────────────────────────────────────────

function appendMessage(role, text, sources = []) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  if (role === 'user') {
    avatar.textContent = 'U';
  } else {
    avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 9h4M11 9h4M9 3v4M9 11v4" stroke="url(#ag)" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="9" cy="9" r="2" stroke="url(#ag)" stroke-width="1.3"/>
      <defs><linearGradient id="ag" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
        <stop stop-color="#a78bfa"/><stop offset="1" stop-color="#38bdf8"/>
      </linearGradient></defs></svg>`;
  }

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  // Sources
  if (sources.length) {
    const srcs = document.createElement('div');
    srcs.className = 'sources';
    sources.forEach(s => {
      const tag = document.createElement('span');
      tag.className = 'source-tag';
      tag.textContent = s;
      srcs.appendChild(tag);
    });
    bubble.appendChild(srcs);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatThread.appendChild(wrap);
  chatThread.scrollTop = chatThread.scrollHeight;
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message ai typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M3 9h4M11 9h4M9 3v4M9 11v4" stroke="url(#agt)" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="9" cy="9" r="2" stroke="url(#agt)" stroke-width="1.3"/>
    <defs><linearGradient id="agt" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop stop-color="#a78bfa"/><stop offset="1" stop-color="#38bdf8"/>
    </linearGradient></defs></svg>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  [0, 1, 2].forEach(i => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    bubble.appendChild(dot);
  });

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatThread.appendChild(wrap);
  chatThread.scrollTop = chatThread.scrollHeight;
  return wrap;
}