const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
const notesPanel = document.getElementById('notesPanel');

let pdfDoc = null, pageNum = 1, scale = 1.2, rotation = 0;
let drawing = false;

// Render PDF page
function renderPage(num){
  pdfDoc.getPage(num).then(page=>{
    const viewport = page.getViewport({scale, rotation});
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    drawCanvas.width = viewport.width;
    drawCanvas.height = viewport.height;
    page.render({canvasContext: ctx, viewport});
    document.getElementById('pageNum').textContent = num;
    document.getElementById('pageCount').textContent = pdfDoc.numPages;
    updateNotesUI();
    localStorage.setItem('lastPage', pageNum);
  });
}

// Navigation
document.getElementById('prevPage').onclick = ()=>{if(pageNum>1){pageNum--; renderPage(pageNum);}};
document.getElementById('nextPage').onclick = ()=>{if(pageNum<pdfDoc.numPages){pageNum++; renderPage(pageNum);}};
document.getElementById('zoomSlider').oninput = e=>{scale=parseFloat(e.target.value); renderPage(pageNum);};
document.getElementById('rotatePage').onclick = ()=>{rotation=(rotation+90)%360; renderPage(pageNum);};

// Jump to page
document.getElementById('jumpBtn').onclick = ()=>{
  const target = parseInt(document.getElementById('jumpInput').value);
  if(target>=1 && target<=pdfDoc.numPages){pageNum=target; renderPage(pageNum);}
};

// Dark mode toggle
document.getElementById('toggleDark').onclick = ()=>{
  document.body.classList.toggle('dark');
};

// File upload
document.getElementById('pdfUpload').addEventListener('change', e=>{
  const file=e.target.files[0];
  if(file && file.type==='application/pdf'){
    const reader=new FileReader();
    reader.onload=()=>{
      const typedArray=new Uint8Array(reader.result);
      pdfjsLib.getDocument(typedArray).promise.then(pdf=>{
        pdfDoc=pdf; pageNum=1; renderPage(pageNum);
      });
    };
    reader.readAsArrayBuffer(file);
  }
});

// Drag & drop
const dropZone=document.getElementById('dropZone');
document.body.addEventListener('dragover', e=>{e.preventDefault(); dropZone.style.display='block';});
document.body.addEventListener('dragleave', e=>{e.preventDefault(); dropZone.style.display='none';});
dropZone.addEventListener('drop', e=>{
  e.preventDefault(); dropZone.style.display='none';
  const file=e.dataTransfer.files[0];
  if(file && file.type==='application/pdf'){
    const reader=new FileReader();
    reader.onload=()=>{
      const typedArray=new Uint8Array(reader.result);
      pdfjsLib.getDocument(typedArray).promise.then(pdf=>{pdfDoc=pdf; pageNum=1; renderPage(pageNum);});
    };
    reader.readAsArrayBuffer(file);
  }
});

// Drawing
document.getElementById('toggleDraw').onchange = e => { drawCanvas.style.display = e.target.checked ? 'block' : 'none'; };
drawCanvas.addEventListener('mousedown',()=>drawing=true);
drawCanvas.addEventListener('mouseup',()=>drawing=false);
drawCanvas.addEventListener('mousemove',e=>{
  if(!drawing) return;
  drawCtx.fillStyle='red';
  drawCtx.beginPath();
  drawCtx.arc(e.offsetX, e.offsetY, 2, 0, Math.PI*2);
  drawCtx.fill();
});

// Notes
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

// Export notes
document.getElementById('exportNotes').onclick = ()=>{
  const notes=localStorage.getItem('pdfNotes');
  const blob = new Blob([notes],{type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'pdf_notes.json';
  link.click();
};

// Text-to-Speech
document.getElementById('readPage').onclick = ()=>{
  pdfDoc.getPage(pageNum).then(page=>{
    page.getTextContent().then(text=>{
      const content=text.items.map(i=>i.str).join(' ');
      const utter=new SpeechSynthesisUtterance(content);
      speechSynthesis.speak(utter);
    });
  });
};

// Load last page
window.addEventListener('load', ()=>{
  const saved=parseInt(localStorage.getItem('lastPage'));
  if(saved) pageNum=saved;
  // Optionally load a default PDF here if offline
});

const canvas2 = document.getElementById('pdf-canvas2');
let dualView = false;

// Toggle dual-page view
document.getElementById('toggleView').onclick = ()=>{
  dualView = !dualView;
  canvas2.style.display = dualView ? 'inline-block':'none';
  renderPage(pageNum);
};
document.getElementById('toggleViewM').onclick = ()=> document.getElementById('toggleView').click();

// Render dual page
function renderPage(num){
  pdfDoc.getPage(num).then(page=>{
    const viewport = page.getViewport({scale, rotation});
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    drawCanvas.width = viewport.width;
    drawCanvas.height = viewport.height;
    page.render({canvasContext: ctx, viewport});
    document.getElementById('pageNum').textContent = num;
    document.getElementById('pageCount').textContent = pdfDoc.numPages;
    updateNotesUI();
    updateBookmarksUI();
    localStorage.setItem('lastPage', pageNum);
  });

  if(dualView && num+1 <= pdfDoc.numPages){
    pdfDoc.getPage(num+1).then(page=>{
      const viewport = page.getViewport({scale, rotation});
      canvas2.height = viewport.height;
      canvas2.width = viewport.width;
      page.render({canvasContext: canvas2.getContext('2d'), viewport});
    });
  }
}

// Bookmarks
function updateBookmarksUI(){
  const bookmarks=JSON.parse(localStorage.getItem('pdfBookmarks')||'[]');
  const panel=document.getElementById('bookmarksPanel');
  panel.innerHTML='';
  bookmarks.forEach(p=>{
    const div=document.createElement('div');
    div.textContent='🔖 Page '+p;
    div.onclick=()=>{ pageNum=p; renderPage(pageNum); };
    panel.appendChild(div);
  });
}

// Add bookmark
document.getElementById('bookmarkPage').onclick = ()=>{
  let bookmarks=JSON.parse(localStorage.getItem('pdfBookmarks')||'[]');
  if(!bookmarks.includes(pageNum)) bookmarks.push(pageNum);
  localStorage.setItem('pdfBookmarks', JSON.stringify(bookmarks));
  updateBookmarksUI();
};

// Mobile buttons
document.getElementById('prevPageM').onclick = ()=> document.getElementById('prevPage').click();
document.getElementById('nextPageM').onclick = ()=> document.getElementById('nextPage').click();
