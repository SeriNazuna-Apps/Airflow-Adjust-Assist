const MAX=20;
let state={vents:[],currentIndex:0,calculated:false};
const $=s=>document.querySelector(s);
const tbody=$("#ventTable tbody");

function newVent(no){return {no,target:"",initial:"",xi:null,factor:null,before:""}}
function init(){
 if(!load()) state.vents=[1,2].map(newVent);
 render();
 bind();
 const stamp=localStorage.getItem("airflowAssist_lastSavedAt");
 if(stamp) updateSaveStatus(`端末内保存：${stamp} に保存済み`);
}
function n(v){let x=parseFloat(String(v).replace(/,/g,""));return Number.isFinite(x)?x:null}
function fmt(v,d=0){return Number.isFinite(v)?v.toLocaleString("ja-JP",{maximumFractionDigits:d,minimumFractionDigits:d}):"—"}

function render(){
 tbody.innerHTML="";
 state.vents.forEach((v,i)=>{
  const tr=document.createElement("tr");
  tr.innerHTML=`<td><button class="row-btn" data-up="${i}">↑</button><button class="row-btn" data-down="${i}">↓</button></td>
  <td class="vent-no">${v.no}</td>
  <td><input class="num-input target" data-i="${i}" inputmode="decimal" value="${v.target}"></td>
  <td><input class="num-input initial" data-i="${i}" inputmode="decimal" value="${v.initial}"></td>
  <td class="xi">${v.xi==null?"—":`${fmt(v.xi,3)}<span class="subcalc">(${fmt(n(v.initial),0)} ÷ ${fmt(n(v.target),0)})</span>${isBase(i)?'<span class="tag">(Xm)</span>':''}`}</td>
  <td class="factor">${v.factor==null?"—":`${fmt(v.factor,3)}<span class="subcalc">(${fmt(minXi(),3)} ÷ ${fmt(v.xi,3)})</span>${isBase(i)?'<span class="tag base">(基準)</span>':''}`}</td>
  <td><button class="delete-btn" data-delete="${i}" aria-label="制気口${v.no}を削除">削除</button></td>`;
  tbody.appendChild(tr);
 });
 updateTotals(); updateAdjust();
}
function minXi(){const a=state.vents.map(v=>v.xi).filter(Number.isFinite);return a.length?Math.min(...a):null}
function baseIndex(){const m=minXi();return m==null?-1:state.vents.findIndex(v=>v.xi===m)}
function isBase(i){return state.calculated && i===baseIndex()}

function calculate(){
 // 目標風量が入力されている行だけを有効行とする。
 // ただし、有効行の途中に目標風量の空欄がある場合は入力漏れとして停止する。
 const hasTarget=state.vents.map(v=>n(v.target)>0);
 const lastActive=hasTarget.lastIndexOf(true);
 if(lastActive<0){alert("目標風量を入力してください。");state.calculated=false;render();return}
 for(let i=0;i<=lastActive;i++){
  if(!hasTarget[i]){
   alert(`制気口${state.vents[i].no}の目標風量が空欄です。途中の行を空欄にはできません。不要な行は削除するか、末尾を空欄にしてください。`);
   state.calculated=false;render();return;
  }
 }
 const active=state.vents.slice(0,lastActive+1);
 for(const v of active){
  const q=n(v.initial);
  if(q==null || q<0){alert(`制気口${v.no}の初回全開風量を入力してください。`);state.calculated=false;render();return}
  v.xi=q/n(v.target);
 }
 // 末尾の未入力行は計算対象外。
 state.vents.slice(lastActive+1).forEach(v=>{v.xi=null;v.factor=null;v.before=""});
 const m=Math.min(...active.map(v=>v.xi));
 active.forEach(v=>v.factor=m/v.xi);
 state.calculated=true;
 const b=baseIndex();
 const first=state.vents.findIndex((v,i)=>i<=lastActive && i!==b);
 state.currentIndex=first>=0?first:b;
 if(state.currentIndex>=0 && state.vents[state.currentIndex].before==="") state.vents[state.currentIndex].before=state.vents[state.currentIndex].initial;
 render(); save();
}

function updateTotals(){
 const ts=state.vents.reduce((s,v)=>s+(n(v.target)||0),0);
 const qs=state.vents.reduce((s,v)=>s+(n(v.initial)||0),0);
 $("#targetTotal").textContent=fmt(ts,0); $("#measuredTotal").textContent=fmt(qs,0);
}
function updateAdjust(){
 const v=state.vents[state.currentIndex], b=baseIndex();
 if(!v||!state.calculated){$("#currentNo").textContent="—";$("#currentInstruction").textContent="自動計算後に調整を開始できます";["beforeDisplay","factorDisplay","adjustTarget","baseNo","baseTarget"].forEach(id=>$("#"+id).textContent="—");$("#beforeInput").value="";return}
 $("#currentNo").textContent=v.no;
 if(state.currentIndex===b){
  $("#currentInstruction").textContent="基準のため調整不要です";
  $("#beforeInput").disabled=true;
 }else{
  $("#currentInstruction").textContent="を調整してください";
  $("#beforeInput").disabled=false;
 }
 $("#beforeInput").value=v.before;
 const before=n(v.before);
 $("#beforeDisplay").textContent=before==null?"—":fmt(before,0);
 $("#factorDisplay").textContent=fmt(v.factor,3);
 $("#adjustTarget").textContent=(before==null||state.currentIndex===b)?"—":fmt(before*v.factor,0);
 const bv=state.vents[b];
 $("#baseNo").textContent=bv?.no??"—"; $("#baseTarget").textContent=fmt(n(bv?.target),0);
 $("#finalText").innerHTML=bv?`基準口（${bv.no}番）の風量を測定しながら、主ダンパーを調整して <b>${fmt(n(bv.target),0)} m³/h</b> に合わせてください。`:"自動計算後に表示します。";
 const activeIndexes=state.vents.map((x,i)=>Number.isFinite(x.factor)?i:-1).filter(i=>i>=0);
 const pos=activeIndexes.indexOf(state.currentIndex);
 const prevIndex=pos>0?activeIndexes[pos-1]:-1;
 const nextIndex=(pos>=0 && pos<activeIndexes.length-1)?activeIndexes[pos+1]:-1;
 const prev=prevIndex>=0?state.vents[prevIndex]:null, next=nextIndex>=0?state.vents[nextIndex]:null;
 $("#prevBtn").dataset.go=prevIndex; $("#nextBtn").dataset.go=nextIndex;
 $("#prevBtn").disabled=!prev;$("#nextBtn").disabled=!next;
 $("#prevText").textContent=prev?`（${prev.no}番へ戻る）`:"";
 $("#nextText").textContent=next?`（${next.no}番へ進む）`:"";
}
function move(i,d){const j=i+d;if(j<0||j>=state.vents.length)return;[state.vents[i],state.vents[j]]=[state.vents[j],state.vents[i]];state.calculated=false;render();}
function addVent(){if(state.vents.length>=MAX)return alert("最大20台です。");const used=state.vents.map(v=>v.no);let no=1;while(used.includes(no))no++;state.vents.push(newVent(no));state.calculated=false;render();}
function deleteVent(i){if(state.vents.length<=1)return alert("制気口は最低1台必要です。");const no=state.vents[i].no;if(!confirm(`制気口${no}を削除しますか？`))return;state.vents.splice(i,1);state.currentIndex=Math.min(state.currentIndex,state.vents.length-1);state.calculated=false;render();save();}
function allReset(){
 if(confirm("目標風量・初回全開風量・調整途中の値など、すべての入力内容をリセットしますか？")){
  localStorage.removeItem("airflowAssist_v11");
  state={vents:[1,2].map(newVent),currentIndex:0,calculated:false};
  render();
 }
}
function initialReset(){
 if(!confirm("目標風量と制気口の並び順を残して、初回全開風量と計算結果をクリアしますか？")) return;
 state.vents.forEach(v=>{
  v.initial="";
  v.xi=null;
  v.factor=null;
  v.before="";
 });
 state.calculated=false;
 state.currentIndex=0;
 render();
 save();
}
function save(){
 localStorage.setItem("airflowAssist_v11",JSON.stringify(state));
}
function updateSaveStatus(text){
 const el=$("#saveStatus");
 if(el) el.textContent=text;
}
function saveLocalWithStatus(){
 save();
 const now=new Date();
 const stamp=now.toLocaleString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
 localStorage.setItem("airflowAssist_lastSavedAt",stamp);
 updateSaveStatus(`端末内保存：${stamp} に保存済み`);
}

function load(){
 try{
  const s=JSON.parse(localStorage.getItem("airflowAssist_v11"));
  if(s?.vents?.length){state=s;return true}
 }catch(e){}
 return false
}
function exportPayload(){
 return {
  app:"風量調整アシスト",
  version:"1.7",
  savedAt:new Date().toISOString(),
  state:state
 };
}
function exportFilename(){
 const d=new Date();
 const pad=v=>String(v).padStart(2,"0");
 return `風量調整_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}
async function saveFile(){
 const text=JSON.stringify(exportPayload(),null,2);
 const filename=exportFilename();
 const file=new File([text],filename,{type:"application/json"});

 // iPhone/iPadでは、ユーザー操作から直接共有シートを開く。
 if(navigator.share){
  try{
   const shareData={files:[file],title:"風量調整アシスト 保存データ"};
   if(!navigator.canShare || navigator.canShare(shareData)){
    await navigator.share(shareData);
    return {ok:true,method:"share"};
   }
  }catch(e){
   if(e?.name==="AbortError") return {ok:false,cancelled:true};
   console.error("Share failed:",e);
  }
 }

 // 共有ファイル非対応時は通常ダウンロードにフォールバック。
 try{
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  a.style.display="none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  return {ok:true,method:"download"};
 }catch(e){
  console.error("Download failed:",e);
  return {ok:false,error:true};
 }
}
async function importFile(file){
 if(!file) return;
 try{
  const text=await file.text();
  const obj=JSON.parse(text);
  const imported=obj?.state || obj;
  if(!Array.isArray(imported?.vents) || imported.vents.length<1 || imported.vents.length>MAX){
   throw new Error("形式が正しくありません");
  }
  state=imported;
  state.currentIndex=Number.isInteger(state.currentIndex)?Math.max(0,Math.min(state.currentIndex,state.vents.length-1)):0;
  state.calculated=!!state.calculated;
  save();
  render();
  alert("保存データを読み込みました。");
 }catch(e){
  alert("このファイルは読み込めません。風量調整アシストで保存したJSONファイルを選択してください。");
 }
}

function bind(){
 tbody.addEventListener("input",e=>{const i=+e.target.dataset.i;if(e.target.classList.contains("target"))state.vents[i].target=e.target.value;if(e.target.classList.contains("initial"))state.vents[i].initial=e.target.value;state.calculated=false;updateTotals();});
 tbody.addEventListener("click",e=>{if(e.target.dataset.up!=null)move(+e.target.dataset.up,-1);if(e.target.dataset.down!=null)move(+e.target.dataset.down,1);if(e.target.dataset.delete!=null)deleteVent(+e.target.dataset.delete)});
 $("#addBtn").onclick=addVent;
 $("#calcBtn").onclick=calculate;
 $("#allResetBtn").onclick=allReset;
 $("#initialResetBtn").onclick=initialReset;
 $("#saveBtn").onclick=()=>$("#savePanel").classList.toggle("hidden");
 $("#loadBtn").onclick=()=>$("#loadFileInput").click();
 $("#loadFileInput").addEventListener("change",async e=>{
   await importFile(e.target.files?.[0]);
   e.target.value="";
 });
 $("#saveLocalBtn").onclick=()=>{
   saveLocalWithStatus();
   const btn=$("#saveLocalBtn");
   const old=btn.textContent;
   btn.textContent="保存しました";
   setTimeout(()=>btn.textContent=old,1200);
 };
 $("#saveFileBtn").onclick=async()=>{
   saveLocalWithStatus();
   const btn=$("#saveFileBtn");
   const old=btn.textContent;
   btn.textContent="共有画面を開いています…";
   btn.disabled=true;
   try{
     const result=await saveFile();
     if(result?.method==="download"){
       updateSaveStatus("ファイル保存：ダウンロードとして保存しました。iPhoneの「ファイル」→「ダウンロード」を確認してください。");
     }else if(result?.method==="share"){
       updateSaveStatus("ファイル保存：共有画面から保存先を選択しました。");
     }else if(result?.cancelled){
       updateSaveStatus("ファイル保存：キャンセルしました。");
     }else{
       updateSaveStatus("ファイル保存：保存画面を開けませんでした。");
     }
   } finally {
     btn.disabled=false;
     btn.textContent=old;
   }
 };
 $("#closeSave").onclick=()=>$("#savePanel").classList.add("hidden");
 $("#beforeInput").addEventListener("input",e=>{state.vents[state.currentIndex].before=e.target.value;updateAdjust();save()});
 $("#prevBtn").onclick=()=>{const i=Number($("#prevBtn").dataset.go);if(i>=0){state.currentIndex=i;updateAdjust();save()}};
 $("#nextBtn").onclick=()=>{const i=Number($("#nextBtn").dataset.go);if(i>=0){state.currentIndex=i;const v=state.vents[i];if(v.before==="")v.before=v.initial;updateAdjust();save()}};
 $("#helpBtn").onclick=()=>$("#helpModal").classList.remove("hidden");$("#closeHelp").onclick=()=>$("#helpModal").classList.add("hidden");
 setupMiniCalc();
}
function setupMiniCalc(){
 const ids=["area","velocity","airflow"];let last="";
 ids.forEach(id=>$("#"+id).addEventListener("input",()=>{last=id;miniCalc(last)}));
}
function miniCalc(last){
 let a=n($("#area").value),v=n($("#velocity").value),q=n($("#airflow").value);
 const filled=[a,v,q].filter(x=>x!=null).length;
 if(filled<2)return;
 if(last!=="airflow" && a!=null&&v!=null){$("#airflow").value=fmt(a*v*3600,1);return}
 if(last!=="velocity" && a!=null&&q!=null&&a!==0){$("#velocity").value=fmt(q/(a*3600),3);return}
 if(last!=="area" && v!=null&&q!=null&&v!==0){$("#area").value=fmt(q/(v*3600),4);return}
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      await reg.update();

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch (e) {
      console.error("Service Worker update failed:", e);
    }
  });
}
init();