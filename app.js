let positive = new Set(), negative = new Set();
let lastResult = null;
let fullHtml = "";
let plainText = "";
let stopped = false;

const $ = id => document.getElementById(id);
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wordKey = w => w.toLowerCase().replace(/^[^a-z0-9+*-]+|[^a-z0-9+*-]+$/gi, "");

async function init(){
  const [pos, neg] = await Promise.all([
    fetch("assets/positive_words.json").then(r=>r.json()),
    fetch("assets/negative_words.json").then(r=>r.json())
  ]);
  positive = new Set(pos); negative = new Set(neg);
  $("readyState").textContent = "Ready";
  $("lexiconStats").textContent = `${positive.size.toLocaleString()} positive · ${negative.size.toLocaleString()} negative words`;
  bind();
  updateCounts();
}
init();

function bind(){
  $("inputText").addEventListener("input", updateCounts);
  $("sampleBtn").onclick = loadSample;
  $("clearBtn").onclick = () => {$("inputText").value=""; $("preview").innerHTML=""; updateCounts();};
  $("fileInput").onchange = importFile;
  $("processBtn").onclick = () => processText(false);
  $("renderAllBtn").onclick = () => processText(true);
  $("stopBtn").onclick = () => {stopped = true;};
  $("zoomIn").onclick = () => changeFont(1);
  $("zoomOut").onclick = () => changeFont(-1);
  $("copyHtmlBtn").onclick = () => navigator.clipboard.writeText(fullHtml || $("preview").innerHTML);
  $("copyPlainBtn").onclick = () => navigator.clipboard.writeText(plainText);
  $("exportHtml").onclick = exportHtml;
  $("exportTxt").onclick = () => save("formatted_text.txt","text/plain",plainText || $("inputText").value);
  $("exportJson").onclick = exportJson;
  $("exportCsv").onclick = exportCsv;
  $("exportPdf").onclick = exportPdf;
  $("exportProject").onclick = exportSettings;
}

function updateCounts(){
  const t = $("inputText").value;
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  $("charCount").textContent = `${t.length.toLocaleString()} chars`;
  $("wordCount").textContent = `${words.toLocaleString()} words`;
  $("lineCount").textContent = `${(t.match(/\n/g)||[]).length+1} lines`;
  $("limitBar").style.width = Math.min(100, words/1000000*100) + "%";
}

function loadSample(){
  $("inputText").value = `This is a strong and hopeful test. The design is excellent, useful, and creative.

Some sections are difficult, confusing, and frustrating. The goal is to make the final document clearer, cleaner, and more effective.

The system should preserve paragraphs, detect sentiment words, scale colour intensity, and export usable files.`;
  updateCounts();
}

function importFile(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {$("inputText").value = String(reader.result || ""); updateCounts();};
  reader.readAsText(file);
}

function getSentiment(key){
  if(positive.has(key) && negative.has(key)) return 0;
  if(positive.has(key)) return 1;
  if(negative.has(key)) return -1;
  return 0;
}

function scaled(v){
  const a = Math.abs(v);
  let s = a;
  if($("scaleMode").value === "sqrt") s = Math.sqrt(a);
  if($("scaleMode").value === "log") s = Math.log1p(a*9)/Math.log(10);
  if($("scaleMode").value === "binary") s = a > 0 ? 1 : 0;
  return Math.sign(v) * Math.min(1,s);
}

function mix(a,b,t){return Math.round(a+(b-a)*t)}
function hex(r,g,b){return `#${[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("")}`}

function sentimentColor(score, index){
  const strength = Number($("strength").value)/100;
  const metric = $("metricMode").value;
  const palette = $("paletteMode").value;
  if(metric === "random"){
    const n = Math.sin(index*999.123)*10000;
    return `hsl(${Math.floor((n-Math.floor(n))*360)},75%,42%)`;
  }
  if(metric === "hybrid" && score === 0){
    const n = Math.sin(index*44.41)*10000;
    return `hsl(${Math.floor((n-Math.floor(n))*360)},45%,38%)`;
  }
  const s = scaled(score) * strength;
  if(s === 0) return palette === "print" ? "#333333" : "#687386";
  const t = Math.min(1, Math.abs(s));
  if(palette === "heat") return s > 0 ? hex(mix(255,255,t),mix(204,88,t),mix(55,35,t)) : hex(mix(100,180,t),mix(160,0,t),mix(255,50,t));
  if(palette === "coolwarm") return s > 0 ? hex(mix(90,20,t),mix(150,200,t),mix(255,120,t)) : hex(mix(255,190,t),mix(120,20,t),mix(120,40,t));
  if(palette === "neon") return s > 0 ? `rgba(43,213,118,${.35+.65*t})` : `rgba(255,90,102,${.35+.65*t})`;
  if(palette === "print") return s > 0 ? "#087f3f" : "#b00020";
  return s > 0 ? hex(mix(70,0,t),mix(150,145,t),mix(110,70,t)) : hex(mix(160,210,t),mix(80,25,t),mix(90,40,t));
}

async function processText(renderAll){
  stopped = false;
  plainText = $("inputText").value;
  const tokens = plainText.match(/\s+|[^\s]+/g) || [];
  const preview = $("preview");
  preview.className = `preview font-${$("fontMode").value}`;
  preview.style.fontSize = $("fontSize").value + "px";
  preview.innerHTML = "<p>Processing...</p>";
  await new Promise(r=>setTimeout(r,20));

  const maxPreviewWords = renderAll ? Infinity : 12000;
  let pos=0, neg=0, neu=0, wordIndex=0, renderedWords=0;
  let chunks = [];
  let density = [];
  let recent = [];
  const windowSize = Number($("windowSize").value);
  const metric = $("metricMode").value;

  for(let i=0;i<tokens.length;i++){
    if(stopped) break;
    const tok = tokens[i];
    if(/^\s+$/.test(tok)){
      if(renderedWords <= maxPreviewWords) chunks.push(formatWhitespace(tok));
      continue;
    }
    const key = wordKey(tok);
    let s = getSentiment(key);
    if(s>0) pos++; else if(s<0) neg++; else neu++;

    recent.push(s);
    if(recent.length > windowSize) recent.shift();
    const local = recent.reduce((a,b)=>a+b,0) / Math.max(1,recent.length);
    const score = metric === "density" ? local : metric === "intensity" ? s * (key.length > 7 ? 1 : .65) : s;

    if(renderedWords <= maxPreviewWords){
      const color = sentimentColor(score, wordIndex);
      chunks.push(`<span class="word" style="color:${color}" data-s="${s}">${escapeHtml(tok)}</span>`);
      renderedWords++;
    }
    density.push(s);
    wordIndex++;
    if(i % 8000 === 0){
      preview.innerHTML = chunks.join("") + `<p class="note">Processed ${wordIndex.toLocaleString()} words...</p>`;
      await new Promise(r=>setTimeout(r,0));
    }
  }

  if(!renderAll && wordIndex > maxPreviewWords){
    chunks.push(`<p class="note">Preview limited to ${maxPreviewWords.toLocaleString()} words for browser speed. Use “Render Full Preview” before exporting full coloured HTML/PDF.</p>`);
  }

  fullHtml = wrapFormatted(chunks.join(""));
  preview.innerHTML = fullHtml;
  lastResult = {positive:pos, negative:neg, neutral:neu, total:wordIndex, score:(pos-neg)/Math.max(1,pos+neg+neu), density};
  updateDashboard();
}

function formatWhitespace(ws){
  const mode = $("formatMode").value;
  if(mode === "poetry") return escapeHtml(ws).replace(/\n/g,"<br>");
  if(mode === "paragraphs") return ws.includes("\n\n") ? "</p><p>" : escapeHtml(ws);
  if(mode === "sentences") return escapeHtml(ws);
  return " ";
}

function wrapFormatted(inner){
  const mode = $("formatMode").value;
  if(mode === "paragraphs") return `<p>${inner}</p>`;
  if(mode === "sentences"){
    return inner.replace(/([.!?])\s+/g, "$1</span><span class='sentence'>").replace(/^/,"<span class='sentence'>").replace(/$/,"</span>");
  }
  return inner;
}

function updateDashboard(){
  const r = lastResult || {positive:0,negative:0,neutral:0,total:0,score:0,density:[]};
  $("posCount").textContent = r.positive.toLocaleString();
  $("negCount").textContent = r.negative.toLocaleString();
  $("neuCount").textContent = r.neutral.toLocaleString();
  $("score").textContent = r.score.toFixed(3);
  drawChart(r.density);
}

function drawChart(data){
  const c = $("chart"), ctx = c.getContext("2d"), w=c.width, h=c.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#08111f"; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#274466"; ctx.strokeRect(8,8,w-16,h-16);
  const bins = 80, arr = Array(bins).fill(0);
  data.forEach((v,i)=> arr[Math.min(bins-1, Math.floor(i/data.length*bins))]+=v);
  const max = Math.max(1,...arr.map(Math.abs));
  arr.forEach((v,i)=>{
    const x=14+i*(w-28)/bins, bw=(w-28)/bins-2, mid=h/2;
    ctx.fillStyle = v>=0 ? "#2bd576" : "#ff5a66";
    const bh = Math.abs(v)/max*(h/2-20);
    ctx.fillRect(x, v>=0 ? mid-bh : mid, bw, bh);
  });
  ctx.strokeStyle="#9eb3cc"; ctx.beginPath(); ctx.moveTo(10,h/2); ctx.lineTo(w-10,h/2); ctx.stroke();
}

function changeFont(delta){
  const n = Math.max(12, Math.min(32, Number($("fontSize").value)+delta));
  $("fontSize").value = n;
  $("preview").style.fontSize = n+"px";
}

function save(name,type,data){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([data],{type}));
  a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

function documentHtml(){
  return `<!doctype html><html><head><meta charset="utf-8"><title>Coloured Sentiment Text</title><style>body{font-family:Georgia,serif;line-height:1.7;padding:40px;max-width:900px;margin:auto}.word{border-radius:3px;padding:0 .06em}.note{color:#666}</style></head><body>${fullHtml || escapeHtml($("inputText").value)}</body></html>`;
}
function exportHtml(){ save("coloured_sentiment_text.html","text/html",documentHtml()); }
function exportJson(){ save("sentiment_analysis.json","application/json",JSON.stringify({settings:getSettings(),result:lastResult},null,2)); }
function exportSettings(){ save("sentiment_colour_project_settings.json","application/json",JSON.stringify(getSettings(),null,2)); }
function getSettings(){
  return {formatMode:$("formatMode").value,metricMode:$("metricMode").value,scaleMode:$("scaleMode").value,paletteMode:$("paletteMode").value,fontMode:$("fontMode").value,fontSize:$("fontSize").value,strength:$("strength").value,windowSize:$("windowSize").value};
}
function exportCsv(){
  const tokens = $("inputText").value.match(/[^\s]+/g) || [];
  let rows = ["index,word,sentiment"];
  tokens.forEach((tok,i)=>{
    const s = getSentiment(wordKey(tok));
    rows.push(`${i+1},"${tok.replace(/"/g,'""')}",${s}`);
  });
  save("word_sentiment.csv","text/csv",rows.join("\n"));
}
function exportPdf(){
  const win = window.open("", "_blank");
  win.document.write(documentHtml());
  win.document.close();
  setTimeout(()=>win.print(),500);
}
