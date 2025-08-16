const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
let pdfDoc = null;
let pageNum = 1;
let scale = 1.2;

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Render PDF page
function renderPage(num) {
  pdfDoc.getPage(num).then(page => {
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    page.render({ canvasContext: ctx, viewport });
    document.getElementById('pageNum').textContent = num;
    document.getElementById('pageCount').textContent = pdfDoc.numPages;
  });
}

// Navigation
document.getElementById('prevPage').onclick = () => {
  if (pageNum <= 1) return;
  pageNum--;
  renderPage(pageNum);
};
document.getElementById('nextPage').onclick = () => {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  renderPage(pageNum);
};

// Zoom
document.getElementById('zoomSlider').oninput = e => {
  scale = parseFloat(e.target.value);
  renderPage(pageNum);
};

// File upload
document.getElementById('pdfUpload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = () => {
      const typedArray = new Uint8Array(reader.result);
      pdfjsLib.getDocument(typedArray).promise.then(pdf => {
        pdfDoc = pdf;
        pageNum = 1;
        renderPage(pageNum);
      });
    };
    reader.readAsArrayBuffer(file);
  }
});

// Drag & drop support
const dropZone = document.getElementById('dropZone');
document.body.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.style.display = 'block';
});
document.body.addEventListener('dragleave', e => {
  e.preventDefault();
  dropZone.style.display = 'none';
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.display = 'none';
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = () => {
      const typedArray = new Uint8Array(reader.result);
      pdfjsLib.getDocument(typedArray).promise.then(pdf => {
        pdfDoc = pdf;
        pageNum = 1;
        renderPage(pageNum);
      });
    };
    reader.readAsArrayBuffer(file);
  }
});

// Offline caching via service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => {
    console.log('Service Worker registered for offline use.');
  });
}
