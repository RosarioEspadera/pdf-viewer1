document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const drawCanvas = document.getElementById('drawCanvas');
    const drawCtx = drawCanvas.getContext('2d');
    const notesPanel = document.getElementById('notesPanel');
    const pdfSelect = document.getElementById('pdfSelect');
    const canvas2 = document.getElementById('pdf-canvas2');

    let pdfDoc = null,
        pageNum = 1,
        scale = 1.2,
        rotation = 0,
        drawing = false,
        dualView = false;

const builtInPDFs = [
  'assets/7th edition.pdf',
  'assets/8th edition.pdf',
  'assets/Boylestad, 7th ed.pdf',
  'assets/Electrical Circuit Theory and Technology by Bird [Book].pdf',
  'assets/Electronic design  circuits and systems-1.pdf',
  'assets/Floyd, 7th ed.pdf',
  'assets/Nelms, 11th ed.pdf',
  'assets/Principles of Electronics, Mehta (1).pdf',
  'assets/Sadiku, 3rd ed.pdf',
  'assets/Sadiku, 5th ed.pdf',
  'assets/Teach Yourself Electricity And Electronics 4th Ed. by Gibilisco [Book].pdf'
];

builtInPDFs.forEach((pdf, i) => {
    const opt = document.createElement('option');
    // Extract the file name from the path
    const fileName = pdf.split('/').pop(); // e.g., "book1.pdf"
    opt.value = i;
    opt.textContent = fileName;
    pdfSelect.appendChild(opt);
});
    // Load selected PDF
    pdfSelect.onchange = () => loadPDF(pdfSelect.value);

    // Load default PDF
    loadPDF(0);

    // ================= Functions =================

    function loadPDF(index) {
        const url = builtInPDFs[index];
        pdfjsLib.getDocument(url).promise.then(pdf => {
            pdfDoc = pdf;
            pageNum = parseInt(localStorage.getItem('lastPage')) || 1;
            renderPage(pageNum);
        }).catch(err => console.error('Failed to load PDF:', err));
    }

    function renderPage(num) {
        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale, rotation });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            drawCanvas.width = viewport.width;
            drawCanvas.height = viewport.height;

            page.render({ canvasContext: ctx, viewport });
            document.getElementById('pageNum').textContent = num;
            document.getElementById('pageCount').textContent = pdfDoc.numPages;

            updateNotesUI();
            updateBookmarksUI();

            localStorage.setItem('lastPage', pageNum);
        });

        // Dual-page view
        if (dualView && num + 1 <= pdfDoc.numPages) {
            pdfDoc.getPage(num + 1).then(page => {
                const viewport = page.getViewport({ scale, rotation });
                canvas2.height = viewport.height;
                canvas2.width = viewport.width;
                page.render({ canvasContext: canvas2.getContext('2d'), viewport });
            });
        }
    }

    // ================ Navigation =================
    document.getElementById('prevPage').onclick = () => { if (pageNum > 1) { pageNum--; renderPage(pageNum); } };
    document.getElementById('nextPage').onclick = () => { if (pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); } };
    document.getElementById('jumpBtn').onclick = () => {
        const target = parseInt(document.getElementById('jumpInput').value);
        if (target >= 1 && target <= pdfDoc.numPages) { pageNum = target; renderPage(pageNum); }
    };

    // ================ Zoom & Rotate =================
    document.getElementById('zoomSlider').oninput = e => { scale = parseFloat(e.target.value); renderPage(pageNum); };
    document.getElementById('rotatePage').onclick = () => { rotation = (rotation + 90) % 360; renderPage(pageNum); };

    // ================ Dark Mode =================
    document.getElementById('toggleDark').onclick = () => document.body.classList.toggle('dark');

    // ================ Drawing =================
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
    document.getElementById('clearDraw')?.addEventListener('click', () => drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height));

    // ================ Notes =================
    document.getElementById('addNote').onclick = () => {
        const note = prompt(`Enter note for page ${pageNum}`);
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

    document.getElementById('exportNotes')?.addEventListener('click', () => {
        const notes = localStorage.getItem('pdfNotes');
        const blob = new Blob([notes], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'pdf_notes.json';
        link.click();
    });

    // ================ Bookmarks =================
    document.getElementById('bookmarkPage')?.addEventListener('click', () => {
        let bookmarks = JSON.parse(localStorage.getItem('pdfBookmarks') || '[]');
        if (!bookmarks.includes(pageNum)) bookmarks.push(pageNum);
        localStorage.setItem('pdfBookmarks', JSON.stringify(bookmarks));
        updateBookmarksUI();
    });

    function updateBookmarksUI() {
        const bookmarks = JSON.parse(localStorage.getItem('pdfBookmarks') || '[]');
        const panel = document.getElementById('bookmarksPanel');
        if (!panel) return;
        panel.innerHTML = '';
        bookmarks.forEach(p => {
            const div = document.createElement('div');
            div.textContent = `🔖 Page ${p}`;
            div.onclick = () => { pageNum = p; renderPage(pageNum); };
            panel.appendChild(div);
        });
    }

    // ================ Dual Page View =================
    document.getElementById('toggleView')?.addEventListener('click', () => {
        dualView = !dualView;
        canvas2.style.display = dualView ? 'inline-block' : 'none';
        renderPage(pageNum);
    });

    // ================ Text-to-Speech =================
    let speechUtter = null;
    document.getElementById('readPage')?.addEventListener('click', () => {
        if (!pdfDoc) return;
        pdfDoc.getPage(pageNum).then(page => {
            page.getTextContent().then(text => {
                const content = text.items.map(i => i.str).join(' ');
                if (!speechUtter) speechUtter = new SpeechSynthesisUtterance();
                speechUtter.text = content;
                speechSynthesis.speak(speechUtter);
            });
        });
    });

    document.getElementById('pauseRead')?.addEventListener('click', () => { speechSynthesis.pause(); });
    document.getElementById('playRead')?.addEventListener('click', () => { speechSynthesis.resume(); });
    document.getElementById('rewindRead')?.addEventListener('click', () => { if (speechUtter) speechUtter.text = ""; renderPage(pageNum); });
    document.getElementById('forwardRead')?.addEventListener('click', () => { if (speechUtter) speechSynthesis.cancel(); pageNum++; if (pageNum <= pdfDoc.numPages) renderPage(pageNum); });

});