document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const drawCanvas = document.getElementById('drawCanvas');
    const drawCtx = drawCanvas.getContext('2d');
    const notesPanel = document.getElementById('notesPanel');
    const pdfSelect = document.getElementById('pdfSelect');
    const pdfUpload = document.getElementById('pdfUpload');
    const canvas2 = document.getElementById('pdf-canvas2');

    let pdfDoc = null,
        pageNum = 1,
        scale = 1.2,
        rotation = 0,
        drawing = false,
        dualView = false,
        utter = null,
        reading = false;

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

 // Populate PDF select
    builtInPDFs.forEach((pdf, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = pdf.split('/').pop();
        pdfSelect.appendChild(opt);
    });

    // ---------------- Load PDF ----------------
    function loadPDFFromFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            const typedArray = new Uint8Array(reader.result);
            pdfjsLib.getDocument(typedArray).promise.then(pdf => {
                pdfDoc = pdf;
                pageNum = 1;
                renderPage(pageNum);
            }).catch(err => console.error('Failed to load PDF:', err));
        };
        reader.readAsArrayBuffer(file);
    }

    function loadPDFFromBuiltIn(index) {
        const url = builtInPDFs[index];
        pdfjsLib.getDocument(url).promise.then(pdf => {
            pdfDoc = pdf;
            pageNum = parseInt(localStorage.getItem('lastPage')) || 1;
            renderPage(pageNum);
        }).catch(err => console.error('Failed to load PDF:', err));
    }

    // ---------------- Event Listeners ----------------

    // File upload prioritized
    pdfUpload?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            stopReading();
            loadPDFFromFile(file);
        }
    });

    // Built-in PDF select
    pdfSelect?.addEventListener('change', () => {
        stopReading();
        loadPDFFromBuiltIn(pdfSelect.value);
    });

    // Close PDF
    document.getElementById('closePDF')?.addEventListener('click', () => {
        stopReading();
        pdfDoc = null;
        pageNum = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        canvas2.getContext('2d').clearRect(0, 0, canvas2.width, canvas2.height);
        notesPanel.innerHTML = '';
        localStorage.removeItem('lastPage');
    });

    function updateNotesUI() {
    const notesPanel = document.getElementById('notesPanel');
    if (!notesPanel) return;

    const notes = JSON.parse(localStorage.getItem('pdfNotes') || '{}');
    notesPanel.innerHTML = (notes[pageNum] || []).map(n => `<div>📝 ${n}</div>`).join('');
    notesPanel.style.display = notes[pageNum]?.length ? 'block' : 'none';
}

    // ---------------- Render Page ----------------
    function renderPage(num) {
        if (!pdfDoc) return;
        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale, rotation });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            drawCanvas.width = viewport.width;
            drawCanvas.height = viewport.height;

            page.render({ canvasContext: ctx, viewport });
            document.getElementById('pageNum').textContent = num;
            document.getElementById('pageCount').textContent = pdfDoc.numPages;

            updateNotesUI();
            updateBookmarksUI();

            localStorage.setItem('lastPage', num);
        });

        if (dualView && num + 1 <= pdfDoc.numPages) {
            pdfDoc.getPage(num + 1).then(page => {
                const viewport = page.getViewport({ scale, rotation });
                canvas2.width = viewport.width;
                canvas2.height = viewport.height;
                page.render({ canvasContext: canvas2.getContext('2d'), viewport });
            });
        }
    }

    // ---------------- Text-to-Speech ----------------
    function startReading() {
        if (!pdfDoc) return alert("PDF not loaded!");
        pdfDoc.getPage(pageNum).then(page => {
            page.getTextContent().then(text => {
                const content = text.items.map(i => i.str).join(' ');
                if (!content) return alert("No text on this page!");
                utter = new SpeechSynthesisUtterance(content);
                utter.onend = () => { reading = false; };
                speechSynthesis.speak(utter);
                reading = true;
            });
        });
    }

    function pauseReading() { if (reading) speechSynthesis.pause(); }
    function resumeReading() { if (reading) speechSynthesis.resume(); }
    function stopReading() { speechSynthesis.cancel(); reading = false; }

    document.getElementById('playRead')?.addEventListener('click', startReading);
    document.getElementById('pauseRead')?.addEventListener('click', pauseReading);
    document.getElementById('stopRead')?.addEventListener('click', stopReading);
    document.getElementById('rewindRead')?.addEventListener('click', () => { if (pageNum > 1) { pageNum--; renderPage(pageNum); stopReading(); } });
    document.getElementById('forwardRead')?.addEventListener('click', () => { if (pdfDoc && pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); stopReading(); } });

});
