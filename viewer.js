const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
const notesPanel = document.getElementById('notesPanel');
const bookmarksPanel = document.getElementById('bookmarksPanel');
const pdfSelect = document.getElementById('pdfSelect');

let pdfDoc = null, pageNum = 1, scale = 1.2, rotation = 0, drawing = false;

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

// Populate dropdown
builtInPDFs.forEach((pdf, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = `Book ${i+1}`;
  pdfSelect.appendChild(opt);
});

// Load selected PDF
pdfSelect.onchange = () => loadPDF(pdfSelect.value);
function loadPDF(index) {
  pdfjsLib.getDocument(builtInPDFs[index]).promise.then(pdf => {
    pdfDoc = pdf;
    pageNum = 1;
    renderPage(pageNum);
  });
}

// Render page
function renderPage(num){
  pdfDoc.getPage(num).then(page => {
    const viewport = page.getViewport({scale, rotation});
    canvas.height = viewport.height; canvas.width = viewport.width;
    drawCanvas.width = viewport.width; drawCanvas.height = viewport.height;
    page.render({canvasContext: ctx, viewport});
    document.getElementById('pageNum').textContent = num;
    document.getElementById('pageCount').textContent = pdfDoc.numPages;
    updateNotesUI(); updateBookmarksUI();
    localStorage.setItem('lastPage', pageNum);
  });
}

// Navigation
document.getElementById('prevPage').onclick = () => { if(pageNum>1){ pageNum--; renderPage(pageNum); }};
document.getElementById('nextPage').onclick = () => { if(pageNum<pdfDoc.numPages){ pageNum++; renderPage(pageNum); }};
document.getElementById('zoomSlider').oninput = e => { scale=parseFloat(e.target.value); renderPage(pageNum); };
document.getElementById('rotatePage').onclick = () => { rotation=(rotation+90)%360; renderPage(pageNum); };

// Dark mode
document.getElementById('toggleDark').onclick = () => document.body.classList.toggle('dark');

// Drawing
document.getElementById('toggleDraw').onchange = e => { 
  drawCanvas.style.display = e.target.checked ? 'block':'none'; 
  drawCanvas.style.pointerEvents = e.target.checked ? 'auto':'none';
};
drawCanvas.addEventListener('mousedown', ()=>drawing=true);
drawCanvas.addEventListener('mouseup', ()=>drawing=false);
drawCanvas.addEventListener('mousemove', e => {
  if(!drawing) return;
  drawCtx.fillStyle='red';
  drawCtx.beginPath();
  drawCtx.arc(e.offsetX, e.offsetY, 2, 0, Math.PI*2);
  drawCtx.fill();
});

// Notes
document.getElementById('addNote').onclick = () => {
  const note = prompt("Enter note for page "+pageNum);
  if(note){
    const notes = JSON.parse(localStorage.getItem('pdfNotes')||'{}');
    notes[pageNum] = notes[pageNum]||[];
    notes[pageNum].push(note);
    localStorage.setItem('pdfNotes', JSON.stringify(notes));
    updateNotesUI();
  }
};
function updateNotesUI(){
  const notes=JSON.parse(localStorage.getItem('pdfNotes')||'{}');
  notesPanel.innerHTML = (notes[pageNum]||[]).map(n=>`<div>📝 ${n}</div>`).join('');
  notesPanel.style.display = notes[pageNum]?.length ? 'block':'none';
}

// Bookmarks
document.getElementById('bookmarkPage').onclick = () => {
  let bookmarks = JSON.parse(localStorage.getItem('pdfBookmarks')||'[]');
  if(!bookmarks.includes(pageNum)) bookmarks.push(pageNum);
  localStorage.setItem('pdfBookmarks', JSON.stringify(bookmarks));
  updateBookmarksUI();
};
function updateBookmarksUI(){
  const bookmarks = JSON.parse(localStorage.getItem('pdfBookmarks')||'[]');
  bookmarksPanel.innerHTML = '';
  bookmarks.forEach(p=>{
    const div = document.createElement('div');
    div.textContent = '🔖 Page '+p;
    div.onclick = ()=> { pageNum=p; renderPage(pageNum); };
    bookmarksPanel.appendChild(div);
  });
}

// Text-to-Speech
let utter=null;
document.getElementById('readPage').onclick = ()=>{
  if(utter && speechSynthesis.speaking){
    speechSynthesis.cancel(); return;
  }
  pdfDoc.getPage(pageNum).then(page=>{
    page.getTextContent().then(text=>{
      const content = text.items.map(i=>i.str).join(' ');
      utter = new SpeechSynthesisUtterance(content);
      speechSynthesis.speak(utter);
    });
  });
};

// Drag & Drop
const dropZone = document.getElementById('dropZone');
document.body.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.display='block'; });
document.body.addEventListener('dragleave', e => { e.preventDefault(); dropZone.style.display='none'; });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.style.display='none';
  const file = e.dataTransfer.files[0];
  if(file && file.type==='application/pdf'){
    const reader = new FileReader();
    reader.onload = ()=> {
      const typedArray = new Uint8Array(reader.result);
      pdfjsLib.getDocument(typedArray).promise.then(pdf => { pdfDoc=pdf; pageNum=1; renderPage(pageNum); });
    };
    reader.readAsArrayBuffer(file);
  }
});

// Load last page on start
window.addEventListener('load', () => {
  const saved = parseInt(localStorage.getItem('lastPage'));
  if(saved) pageNum=saved;
  if(pdfDoc) renderPage(pageNum);
});

// Load default PDF
loadPDF(0);