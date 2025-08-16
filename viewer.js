// ---------------------------
// Cozy PDF Viewer - Modular JS
// ---------------------------

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
const notesPanel = document.getElementById('notesPanel');
const canvas2 = document.getElementById('pdf-canvas2');

let pdfDoc = null;
let pageNum = 1;
let scale = 1.2;
let rotation = 0;
let dualView = false;
let drawing = false;

// ---------------------------
// Render a PDF page
// ---------------------------
function renderPage(num) {
    if (!pdfDoc) return;

    pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale, rotation });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        drawCanvas.width = viewport.width;
        drawCanvas.height = viewport.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        page.render({ canvasContext: ctx, viewport });

        document.getElementById('pageNum').textContent = num;
        document.getElementById('pageCount').textContent = pdfDoc.numPages;

        updateNotesUI();
        updateBookmarksUI();
        localStorage.setItem('lastPage', pageNum);
    });

    // Dual page rendering
    if (dualView && num + 1 <= pdfDoc.numPages) {
        pdfDoc.getPage(num + 1).then(page => {
            const viewport = page.getViewport({ scale, rotation });
            canvas2.width = viewport.width;
            canvas2.height = viewport.height;
            canvas2.getContext('2d').clearRect(0, 0, canvas2.width, canvas2.height);
            page.render({ canvasContext: canvas2.getContext('2d'), viewport });
        });
    }
}

// ---------------------------
// Navigation
// ---------------------------
document.getElementById('prevPage').onclick = () => { if (pageNum > 1) { pageNum--; renderPage(pageNum); } };
document.getElementById('nextPage').onclick = () => { if (pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); } };
document.getElementById('zoomSlider').oninput = e => { scale = parseFloat(e.target.value); renderPage(pageNum); };
document.getElementById('rotatePage').onclick = () => { rotation = (rotation + 90) % 360; renderPage(pageNum); };
document.getElementById('jumpBtn').onclick = () => {
    const target = parseInt(document.getElementById('jumpInput').value);
    if (target >= 1 && target <= pdfDoc.numPages) { pageNum = target; renderPage(pageNum); }
};

// ---------------------------
// Dark mode
// ---------------------------
document.getElementById('toggleDark').onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
};
window.addEventListener('load', () => {
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark');
});

// ---------------------------
// File upload & drag-drop
// ---------------------------
document.getElementById('pdfUpload').addEventListener('change', e => loadPDFFile(e.target.files[0]));
const dropZone = document.getElementById('dropZone');

function loadPDFFile(file) {
    if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = () => {
            const typedArray = new Uint8Array(reader.result);
            pdfjsLib.getDocument(typedArray).promise.then(pdf => {
                pdfDoc = pdf; pageNum = 1; renderPage(pageNum);
            });
        };
        reader.readAsArrayBuffer(file);
    }
}

document.body.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.display = 'block'; });
document.body.addEventListener('dragleave', e => { e.preventDefault(); dropZone.style.display = 'none'; });
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.style.display = 'none'; loadPDFFile(e.dataTransfer.files[0]); });

// ---------------------------
// Drawing
// ---------------------------
document.getElementById('toggleDraw').onchange = e => { drawCanvas.style.display = e.target.checked ? 'block' : 'none'; };
drawCanvas.addEventListener('mousedown', () => drawing = true);
drawCanvas.addEventListener('mouseup', () => drawing = false);
drawCanvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    drawCtx.fillStyle = 'red';
    drawCtx.beginPath();
    drawCtx.arc(e.offsetX, e.offsetY, 2, 0, Math.PI * 2);
    drawCtx.fill();
});
document.getElementById('clearDraw').onclick = () => drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

// ---------------------------
// Notes
// ---------------------------
document.getElementById('addNote').onclick = () => {
    const note = prompt("Enter note for page " + pageNum);
    if (note) {
        const notes = JSON.parse(localStorage.getItem('pdfNotes') || '{}');
        notes[pageNum] = notes[pageNum] || [];
        notes[pageNum].push(note);
        localStorage.setItem('pdfNotes', JSON.stringify(notes));
        updateNotesUI();
    }
};
function updateNotesUI() {
    const notes = JSON.parse(localStorage.getItem('pdfNotes') || '{}');
    notesPanel.innerHTML = (notes[pageNum] || []).map(n => `<div>📝 ${n}</div>`).join('');
    notesPanel.style.display = notes[pageNum]?.length ? 'block' : 'none';
}
document.getElementById('exportNotes').onclick = () => {
    const notes = localStorage.getItem('pdfNotes');
    const blob = new Blob([notes], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pdf_notes.json';
    link.click();
};

// ---------------------------
// Text-to-Speech
// ---------------------------
document.getElementById('readPage').onclick = () => {
    pdfDoc.getPage(pageNum).then(page => {
        page.getTextContent().then(text => {
            const content = text.items.map(i => i.str).join(' ');
            const utter = new SpeechSynthesisUtterance(content);
            speechSynthesis.speak(utter);
        });
    });
};

// ---------------------------
// Dual-page view
// ---------------------------
document.getElementById('toggleView').onclick = () => {
    dualView = !dualView;
    canvas2.style.display = dualView ? 'inline-block' : 'none';
    renderPage(pageNum);
};

// ---------------------------
// Bookmarks
// ---------------------------
document.getElementById('bookmarkPage').onclick = () => {
    let bookmarks = JSON.parse(localStorage.getItem('pdfBookmarks') || '[]');
    if (!bookmarks.includes(pageNum)) bookmarks.push(pageNum);
    localStorage.setItem('pdfBookmarks', JSON.stringify(bookmarks));
    updateBookmarksUI();
};
function updateBookmarksUI() {
    const bookmarks = JSON.parse(localStorage.getItem('pdfBookmarks') || '[]');
    const panel = document.getElementById('bookmarksPanel');
    panel.innerHTML = '';
    bookmarks.forEach(p => {
        const div = document.createElement('div');
        div.textContent = '🔖 Page ' + p;
        div.onclick = () => { pageNum = p; renderPage(pageNum); };
        panel.appendChild(div);
    });
}

// ---------------------------
// Mobile swipe gestures
// ---------------------------
let startX = 0;
canvas.addEventListener('touchstart', e => startX = e.touches[0].clientX);
canvas.addEventListener('touchend', e => {
    const endX = e.changedTouches[0].clientX;
    if (endX - startX > 50) document.getElementById('prevPage').click();
    if (startX - endX > 50) document.getElementById('nextPage').click();
});

// ---------------------------
// Load last page or offline default PDF
// ---------------------------
window.addEventListener('load', () => {
    const saved = parseInt(localStorage.getItem('lastPage'));
    pageNum = saved || 1;
    if (!pdfDoc) pdfjsLib.getDocument('libs/sample.pdf').promise.then(pdf => { pdfDoc = pdf; renderPage(pageNum); });
});
