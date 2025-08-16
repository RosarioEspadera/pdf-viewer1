const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
const notesPanel = document.getElementById('notesPanel');
const bookmarksPanel = document.getElementById('bookmarksPanel');

let pdfDoc = null, pageNum = 1, scale = 1, rotation = 0, drawing = false;
let utterance = null, isPaused = false, ttsChunks = [], currentChunk = 0, chunkSize = 50;

// --- Render PDF ---
function renderPage(num){
  if(!pdfDoc) return;
  pdfDoc.getPage(num).then(page=>{
    const containerWidth = canvas.parentElement.offsetWidth;
    const viewport = page.getViewport({ scale: 1 });
    scale = containerWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale, rotation });

    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    drawCanvas.height = scaledViewport.height;
    drawCanvas.width = scaledViewport.width;

    page.render({canvasContext: ctx, viewport: scaledViewport});
    document.getElementById('pageNum').textContent = num;
    document.getElementById('pageCount').textContent = pdfDoc.numPages;

    updateNotesUI();
    updateBookmarksUI();
    localStorage.setItem('lastPage', pageNum);
  });
}

// --- Navigation ---
document.getElementById('prevPage').onclick = ()=>{if(pageNum>1){pageNum--; renderPage(pageNum);}};
document.getElementById('nextPage').onclick = ()=>{if(pageNum<pdfDoc.numPages){pageNum++; renderPage(pageNum);}};
document.getElementById('zoomSlider').oninput = e=>{scale=parseFloat(e.target.value); renderPage(pageNum);};
document.getElementById('rotatePage').onclick = ()=>{rotation=(rotation+90)%360; renderPage(pageNum);};

// --- Dark Mode ---
document.getElementById('toggleDark').onclick = ()=>{document.body.classList.toggle('dark');};

// --- PDF Upload ---
document.getElementById('pdfUpload').addEventListener('change', e=>{
  const file=e.target.files[0];
  if(file && file.type==='application/pdf'){
    const reader=new FileReader();
    reader.onload=()=>{pdfjsLib.getDocument(new Uint8Array(reader.result)).promise.then(pdf=>{pdfDoc=pdf; pageNum=1; renderPage(pageNum);});};
    reader.readAsArrayBuffer(file);
  }
});

// --- Drag & Drop ---
const dropZone=document.getElementById('dropZone');
document.body.addEventListener('dragover', e=>{e.preventDefault(); dropZone.style.display='block';});
document.body.addEventListener('dragleave', e=>{e.preventDefault(); dropZone.style.display='none';});
dropZone.addEventListener('drop', e=>{
  e.preventDefault(); dropZone.style.display='none';
  const file=e.dataTransfer.files[0];
  if(file && file.type==='application/pdf'){
    const reader=new FileReader();
    reader.onload=()=>{pdfjsLib.getDocument(new Uint8Array(reader.result)).promise.then(pdf=>{pdfDoc=pdf; pageNum=1; renderPage(pageNum);});};
    reader.readAsArrayBuffer(file);
  }
});

// --- Drawing ---
document.getElementById('toggleDraw').onchange = e => { drawCanvas.style.display = e.target.checked ? 'block':'none'; };
drawCanvas.addEventListener('mousedown',()=>drawing=true);
drawCanvas.addEventListener('mouseup',()=>drawing=false);
drawCanvas.addEventListener('mousemove', e=>{
  if(!drawing) return;
  drawCtx.fillStyle='red';
  drawCtx.beginPath();
  drawCtx.arc(e.offsetX,e.offsetY,2,0,Math.PI*2);
  drawCtx.fill();
});

// --- Notes ---
document.getElementById('addNote').onclick = ()=>{
  const note = prompt("Enter note for page "+pageNum);
  if(note){
    const notes=JSON.parse(localStorage.getItem('pdfNotes')||'{}');
    notes[pageNum]=notes[pageNum]||[];
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

// --- Bookmarks ---
document.getElementById('bookmarkPage').onclick = ()=>{
  let bookmarks=JSON.parse(localStorage.getItem('pdfBookmarks')||'[]');
  if(!bookmarks.includes(pageNum)) bookmarks.push(pageNum);
  localStorage.setItem('pdfBookmarks', JSON.stringify(bookmarks));
  updateBookmarksUI();
};
function updateBookmarksUI(){
  const bookmarks=JSON.parse(localStorage.getItem('pdfBookmarks')||'[]');
  bookmarksPanel.innerHTML='';
  bookmarks.forEach(p=>{
    const div=document.createElement('div');
    div.textContent='🔖 Page '+p;
    div.onclick=()=>{pageNum=p; renderPage(pageNum);};
    bookmarksPanel.appendChild(div);
  });
}

// --- Text-to-Speech ---
function startReading(){
  if(!pdfDoc) return;
  pdfDoc.getPage(pageNum).then(page=>{
    page.getTextContent().then(text=>{
      const words=text.items.map(i=>i.str).join(' ').split(' ');
      ttsChunks=[];
      for(let i=0;i<words.length;i+=chunkSize) ttsChunks.push(words.slice(i,i+chunkSize).join(' '));
      currentChunk=0;
      speakChunk(currentChunk);
    });
  });
}

function speakChunk(index){
  if(index>=ttsChunks.length) return;
  utterance=new SpeechSynthesisUtterance(ttsChunks[index]);
  utterance.onend = ()=>{if(!isPaused){currentChunk++; speakChunk(currentChunk);}};
  speechSynthesis.speak(utterance);
}

document.getElementById('readPage').onclick = ()=>{ if(utterance && isPaused){speechSynthesis.resume(); isPaused=false;} else startReading(); };
document.getElementById('pauseRead').onclick = ()=>{ if(utterance && !isPaused){speechSynthesis.pause(); isPaused=true;} };
document.getElementById('stopRead').onclick = ()=>{speechSynthesis.cancel(); utterance=null; isPaused=false; currentChunk=0; };
document.getElementById('forwardRead').onclick = ()=>{if(currentChunk<ttsChunks.length-1){speechSynthesis.cancel(); currentChunk++; speakChunk(currentChunk);} };
document.getElementById('rewindRead').onclick = ()=>{if(currentChunk>0){speechSynthesis.cancel(); currentChunk--; speakChunk(currentChunk);} };

// --- Load last page ---
window.addEventListener('load', ()=>{
  const saved=parseInt(localStorage.getItem('lastPage'));
  if(saved) pageNum=saved;
});
