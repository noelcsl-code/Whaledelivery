// Whale Delivery Log - local-first PWA
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const KEY = "whale_delivery_log_v1";
const CLOUD_LINK_KEY = "whale_delivery_cloud_link_v1"; // stores linked uid
const CLOUD_LAST_PULL_KEY = "whale_delivery_cloud_lastpull_v1";

const state = {
  meta: {
    date: null,
    dow: "Tue",
    cutoff: "18:00",
    headerNote: "（以最後版本為準）"
  },
  deliver: [],
  pickup: [],
  pending: [],
  customers: [],
  changelog: []
};

function nowHHMM(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return;
    const obj = JSON.parse(raw);
    Object.assign(state, obj);
  }catch(e){ console.warn(e); }
}

function save(){
  state._updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
  scheduleCloudPush();
}

function log(action){
  const line = `${nowHHMM()}  ${action}`;
  state.changelog.unshift(line);
  if(state.changelog.length > 200) state.changelog.pop();
  renderLog();
  save();
}

function uid(){
  return Math.random().toString(36).slice(2,10);
}

function defaultItem(){
  return {
    id: uid(),
    title: "",
    addr: "",
    phone: "",
    time: "",
    note: "",
    amt: "",
    pay: "",
    done: false,
    late: false,   // 🔴
    cancel: false, // ❌
    edited: false, // ✏️
    updated: false // 🔄
  };
}

function elFromTemplate(){
  const tpl = $("#itemTemplate");
  return tpl.content.firstElementChild.cloneNode(true);
}

function bindItemEl(el, item, listName){
  const title = el.querySelector(".title");
  const addr = el.querySelector(".addr");
  const phone = el.querySelector(".phone");
  const time = el.querySelector(".time");
  const note = el.querySelector(".note");
  const amt = el.querySelector(".amt");
  const pay = el.querySelector(".pay");
  const done = el.querySelector(".done");

  const custSelect = el.querySelector(".custSelect");
  const btnApplyCust = el.querySelector(".applyCust");

  const btnLate = el.querySelector(".late");
  const btnPendingTag = el.querySelector(".pendingTag");
  const btnCancel = el.querySelector(".cancel");
  const btnDel = el.querySelector(".tag:not(.late):not(.pendingTag):not(.cancel)");

  const badgeEdited = el.querySelector(".metaBadge.edited");
  const badgeUpdated = el.querySelector(".metaBadge.updated");

  // init
  title.value = item.title || "";
  addr.value = item.addr || "";
  phone.value = item.phone || "";
  time.value = item.time || "";
  note.value = item.note || "";
  amt.value = item.amt || "";
  pay.value = item.pay || "";
  done.checked = !!item.done;

  // customer picker
  if(custSelect){
    custSelect.innerHTML = customersOptionsHtml(item.customerId||"");
    custSelect.value = item.customerId || "";
  }

  setActive(btnLate, item.late);
  setActive(btnCancel, item.cancel);

  // pendingTag only meaningful if item is in pending list
  btnPendingTag.hidden = (listName !== "pending");

  badgeEdited.classList.toggle("show", !!item.edited);
  badgeUpdated.classList.toggle("show", !!item.updated);

  // handlers
  const onChange = (field, value) => {
    const before = item[field] ?? "";
    if(before === value) return;
    item[field] = value;
    item.edited = true;
    badgeEdited.classList.add("show");
    log(`✏️ 改過：${shortTitle(item)}（${field}）`);
    save();
  };

  const onUpdate = (field, value) => {
    item[field] = value;
    item.updated = true;
    badgeUpdated.classList.add("show");
    log(`🔄 更新：${shortTitle(item)}（${field}）`);
    save();
  };

  if(custSelect){
    custSelect.addEventListener("change", e => {
      item.customerId = e.target.value;
      item.updated = true;
      log(`🔄 更新：${shortTitle(item)}（客戶）`);
      save();
    });
  }
  if(btnApplyCust){
    btnApplyCust.addEventListener("click", () => {
      if(!custSelect || !custSelect.value){ alert("請先選擇常用客戶"); return; }
      applyCustomerToItem(item, custSelect.value);
      // rerender to reflect filled fields
      render();
      save();
    });
  }

  title.addEventListener("input", e => onChange("title", e.target.value.trim()));
  addr.addEventListener("input", e => onChange("addr", e.target.value.trim()));
  phone.addEventListener("input", e => onChange("phone", e.target.value.trim()));
  time.addEventListener("input", e => onChange("time", e.target.value.trim()));
  note.addEventListener("input", e => onChange("note", e.target.value.trim()));
  amt.addEventListener("input", e => onChange("amt", e.target.value.trim()));
  pay.addEventListener("change", e => onChange("pay", e.target.value));

  done.addEventListener("change", e => {
    item.done = e.target.checked;
    onUpdate("done", item.done);
  });

  btnLate.addEventListener("click", () => {
    item.late = !item.late;
    setActive(btnLate, item.late);
    onUpdate("late", item.late);
  });

  btnCancel.addEventListener("click", () => {
    item.cancel = !item.cancel;
    setActive(btnCancel, item.cancel);
    if(item.cancel) item.done = false;
    done.checked = item.done;
    onUpdate("cancel", item.cancel);
  });

  btnDel.addEventListener("click", () => {
    removeItem(listName, item.id);
  });
}

function setActive(btn, active){
  btn.classList.toggle("active", !!active);
}

function shortTitle(item){
  const t = (item.title || "").trim();
  if(t) return t.length > 18 ? t.slice(0,18) + "…" : t;
  if(item.addr) return item.addr.length > 18 ? item.addr.slice(0,18) + "…" : item.addr;
  return "（未命名）";
}

function addItem(listName){
  const item = defaultItem();
  state[listName].unshift(item);
  log(`🔄 新增：${listLabel(listName)} 一單`);
  render();
  save();
}

function removeItem(listName, id){
  const idx = state[listName].findIndex(x => x.id === id);
  if(idx >= 0){
    const t = shortTitle(state[listName][idx]);
    state[listName].splice(idx,1);
    log(`🔄 刪除：${listLabel(listName)} ${t}`);
    render();
    save();
  }
}


function renderCustomers(){
  const box = $("#custList");
  if(!box) return;
  box.innerHTML = "";
  if(state.customers.length === 0){
    const div = document.createElement("div");
    div.className = "logline";
    div.textContent = "（未有常用客戶。你可以先新增：例如「松池」、「Miki」、「Gelato」）";
    box.appendChild(div);
    return;
  }
  state.customers.forEach(c => {
    const row = document.createElement("div");
    row.className = "custRow";
    row.innerHTML = `
      <div class="name">${escapeHtml(c.name)}</div>
      <div class="mini">${escapeHtml(c.phone || "")}</div>
      <div class="mini">${escapeHtml(c.addr || "")}</div>
      <div class="spacer"></div>
      <button class="btn ghost small" data-edit="${c.id}">編輯</button>
      <button class="btn danger small" data-del="${c.id}">刪除</button>
    `;
    box.appendChild(row);
  });

  // bind edit/del
  box.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      const c = state.customers.find(x=>x.id===id);
      if(!confirm(`刪除客戶「${c?.name||""}」？`)) return;
      state.customers = state.customers.filter(x=>x.id!==id);
      log(`🔄 刪除客戶：${c?.name||id}`);
      render(); save();
    });
  });

  box.querySelectorAll("button[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-edit");
      const c = state.customers.find(x=>x.id===id);
      if(!c) return;
      // load into inputs for quick edit
      $("#custName").value = c.name || "";
      $("#custAddr").value = c.addr || "";
      $("#custPhone").value = c.phone || "";
      $("#custNote").value = c.note || "";
      $("#custAmt").value = c.amt || "";
      $("#btnAddCust").dataset.editing = id;
      $("#btnAddCust").textContent = "保存修改";
      document.getElementById("customersCard")?.scrollIntoView({behavior:"smooth", block:"start"});
    });
  });
}

function bindCustomerAdd(){
  const btn = $("#btnAddCust");
  if(!btn) return;
  btn.addEventListener("click", ()=>{
    const name = $("#custName").value.trim();
    const addr = $("#custAddr").value.trim();
    const phone = $("#custPhone").value.trim();
    const note = $("#custNote").value.trim();
    const amt = $("#custAmt").value.trim();
    if(!name){
      alert("請輸入客戶名（例如：松池 / Miki / Gelato）。");
      return;
    }
    const editingId = btn.dataset.editing || "";
    if(editingId){
      const c = state.customers.find(x=>x.id===editingId);
      if(c){
        c.name=name; c.addr=addr; c.phone=phone; c.note=note; c.amt=amt;
        log(`✏️ 改過：客戶 ${name}`);
      }
      delete btn.dataset.editing;
      btn.textContent = "＋新增客戶";
    }else{
      state.customers.unshift({id: uid(), name, addr, phone, note, amt});
      log(`🔄 新增客戶：${name}`);
    }
    // clear inputs
    $("#custName").value=""; $("#custAddr").value=""; $("#custPhone").value="";
    $("#custNote").value=""; $("#custAmt").value="";
    render(); save();
  });
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function customersOptionsHtml(selectedId=""){
  const opts = state.customers.map(c=>{
    const sel = (c.id===selectedId) ? "selected" : "";
    return `<option value="${c.id}" ${sel}>${escapeHtml(c.name)}</option>`;
  }).join("");
  return `<option value="">（選擇常用客戶）</option>` + opts;
}

function applyCustomerToItem(item, custId){
  const c = state.customers.find(x=>x.id===custId);
  if(!c) return;
  item.customerId = custId;
  // overwrite fields (so you don't need to type)
  item.title = item.title || c.name; // if title empty, use name
  item.addr = c.addr || item.addr;
  item.phone = c.phone || item.phone;
  item.note = (c.note && !item.note) ? c.note : item.note;
  item.amt = (c.amt && !item.amt) ? c.amt : item.amt;
  item.updated = true;
  log(`🔄 套用客戶：${c.name}`);
}

function listLabel(name){
  if(name==="deliver") return "送";
  if(name==="pickup") return "收";
  return "未定";
}

function renderList(listName, containerSel){
  const box = $(containerSel);
  box.innerHTML = "";
  const arr = state[listName];
  arr.forEach(item => {
    const el = elFromTemplate();
    bindItemEl(el, item, listName);
    box.appendChild(el);
  });
}

function renderMeta(){
  $("#date").value = state.meta.date || todayISO();
  $("#dow").value = state.meta.dow || "Tue";
  $("#cutoff").value = state.meta.cutoff || "18:00";
  $("#headerNote").value = state.meta.headerNote || "（以最後版本為準）";
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function render(){
  renderMeta();
  renderList("deliver", "#listDeliver");
  renderList("pickup", "#listPickup");
  renderList("pending", "#listPending");
  renderCustomers();
  renderLog();
}

function renderLog(){
  const box = $("#changelog");
  box.innerHTML = "";
  state.changelog.slice(0,120).forEach(line => {
    const div = document.createElement("div");
    div.className = "logline";
    div.textContent = line;
    box.appendChild(div);
  });
}

function headerText(){
  // format date as "20 Feb (Fri)"
  const d = new Date(($("#date").value || todayISO()) + "T00:00:00");
  const day = d.getDate();
  const mon = d.toLocaleString("en-US",{month:"short"});
  const dowSel = $("#dow").value;
  const dow = (dowSel==="Tue") ? "Tue" : (dowSel==="Fri") ? "Fri" : d.toLocaleString("en-US",{weekday:"short"});
  const cnDow = (dowSel==="Tue") ? "星期二" : (dowSel==="Fri") ? "星期五" : "其他";
  const cutoff = $("#cutoff").value || "18:00";
  const note = $("#headerNote").value || "";
  return [
    `📅 ${day} ${mon}（${cnDow}）｜Live 收送單`,
    `⏰ 截單：${cutoff} ${note}`.trim(),
    "",
    "狀態說明：",
    "✏️ = 改過",
    "🔄 = 更新",
    "🔴 = 10 點後／一定要留意",
    ""
  ].join("\n");
}

function itemToLines(i, idx){
  const parts = [];

  // Checkbox display
  const box = i.done ? "[✔]" : "[ ]";
  const prefix = `${box} ${idx}. `;

  let first = (i.title || "").trim();
  if(!first) first = (i.addr || "").trim() || "（未命名）";

  const late = i.late ? " 🔴" : "";
  const cancel = i.cancel ? " ❌" : "";
  parts.push(`${prefix}${first}${late}${cancel}`);

  if(i.addr) parts.push(`📍 ${i.addr}`);
  if(i.phone) parts.push(`📞 ${i.phone}`);
  if(i.time) parts.push(`⏱ ${i.time}`);
  if(i.note) parts.push(`⚠️ ${i.note}`);
  if(i.amt || i.pay){
    const a = i.amt ? `💰 ${i.amt}` : "";
    const p = i.pay ? ` ${i.pay}` : "";
    parts.push((a + p).trim());
  }
  return parts.join("\n");
}

function exportText(){
  const lines = [];
  lines.push(headerText());

  // Deliver
  lines.push("## 🚚【送】");
  if(state.deliver.length===0) lines.push("（無）");
  state.deliver.forEach((i, k) => {
    lines.push("");
    lines.push(itemToLines(i, k+1));
  });

  // Pickup
  lines.push("\n## 📥【收】");
  if(state.pickup.length===0) lines.push("（無）");
  state.pickup.forEach((i, k) => {
    lines.push("");
    lines.push(itemToLines(i, k+1));
  });

  // Pending
  lines.push("\n## 🟨【未定／之後】");
  if(state.pending.length===0) lines.push("（無）");
  state.pending.forEach((i, k) => {
    lines.push("");
    // Pending uses bullet label but keep checkbox for consistency
    lines.push(itemToLines(i, k+1));
  });

  lines.push("\n---\n📦 最終單（截單後）請以此為準");
  return lines.join("\n");
}

function wireMeta(){
  $("#date").addEventListener("change", e => { state.meta.date = e.target.value; log(`🔄 更新：日期 ${e.target.value}`); save(); });
  $("#dow").addEventListener("change", e => { state.meta.dow = e.target.value; log(`🔄 更新：星期 ${e.target.options[e.target.selectedIndex].text}`); save(); });
  $("#cutoff").addEventListener("change", e => { state.meta.cutoff = e.target.value; log(`🔄 更新：截單 ${e.target.value}`); save(); });
  $("#headerNote").addEventListener("input", e => { state.meta.headerNote = e.target.value; save(); });
}

function setupButtons(){
  $$("button[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addItem(btn.dataset.add));
  });

  $("#btnExport").addEventListener("click", () => {
    const text = exportText();
    $("#exportText").value = text;
    log("🔄 產生最終單文字");
    save();
  });

  $("#btnCopy").addEventListener("click", async () => {
    const text = $("#exportText").value.trim();
    if(!text){ alert("請先按「📦 產生最終單」。"); return; }
    try{
      await navigator.clipboard.writeText(text);
      log("🔄 已 Copy 到剪貼簿");
      alert("已 Copy！直接貼去 WhatsApp delivery group 就得。");
    }catch(e){
      // fallback: select
      $("#exportText").focus();
      $("#exportText").select();
      document.execCommand("copy");
      log("🔄 已 Copy（fallback）");
      alert("已 Copy（fallback）！直接貼去 WhatsApp delivery group 就得。");
    }
  });

  $("#btnClearLog").addEventListener("click", () => {
    state.changelog = [];
    renderLog();
    save();
  });

  $("#btnResetDay").addEventListener("click", () => {
    if(!confirm("確定重置今日單？（送/收/未定 + 輸出文字會清空）")) return;
    state.deliver = [];
    state.pickup = [];
    state.pending = [];
    $("#exportText").value = "";
    log("🔄 已重置今日單");
    render();
    save();
  });
}

// PWA install prompt (Android Chrome)
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("#btnInstall");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
});

async function registerSW(){
  if("serviceWorker" in navigator){
    try{
      await navigator.serviceWorker.register("service-worker.js");
    }catch(e){ console.warn("SW failed", e); }
  }
}

function init(){
  load();
  // backward compatible defaults
  if(!state.customers) state.customers = [];
  if(!state.changelog) state.changelog = [];
  if(!state._updatedAt) state._updatedAt = Date.now();
  // ensure date default
  if(!state.meta.date) state.meta.date = todayISO();
  render();
  wireMeta();
  setupButtons();
  initCloudSync();
  bindCustomerAdd();
  registerSW();
}
init();


// =============================
// CLOUD_SYNC (Firebase + Firestore)
// =============================
let __cloud = null;
let __cloudUid = null;
let __cloudLinked = false;
let __pushTimer = null;

function qs(id){ return document.getElementById(id); }

async function getCloud(){
  if(__cloud) return __cloud;
  if(!window.__whaleFirebaseReady) return null;
  try{
    __cloud = await window.__whaleFirebaseReady;
    __cloudUid = __cloud.auth.currentUser ? __cloud.auth.currentUser.uid : null;
    __cloudLinked = (localStorage.getItem(CLOUD_LINK_KEY) === __cloudUid);
    updateCloudStatus();
    return __cloud;
  }catch(e){
    console.warn("[Cloud] not ready", e);
    updateCloudStatus("error");
    return null;
  }
}

function updateCloudStatus(mode){
  const el = qs("cloudStatus");
  if(!el) return;
  if(mode === "error"){
    el.textContent = "☁️ 錯誤";
    return;
  }
  if(!window.__whaleFirebaseReady){
    el.textContent = "☁️ 離線";
    return;
  }
  if(__cloudUid){
    el.textContent = __cloudLinked ? "☁️ 已連線" : "☁️ 未綁定";
    el.title = __cloudLinked ? "雲端同步已啟用" : "已登入，但未綁定到雲端（第一次請按『上雲』）";
  }else{
    el.textContent = "☁️ 連線中";
  }
}

function initCloudSync(){
  const btnPull = qs("btnCloudPull");
  const btnPush = qs("btnCloudPush");
  if(btnPull) btnPull.addEventListener("click", cloudPull);
  if(btnPush) btnPush.addEventListener("click", cloudPush);
  // kick off init (non-blocking)
  getCloud();
}

async function cloudPull(){
  const fb = await getCloud();
  if(!fb || !__cloudUid){ alert("雲端未就緒，請稍後再試"); return; }
  const ref = fb.doc(fb.db, "users", __cloudUid);
  const snap = await fb.getDoc(ref);
  if(!snap.exists()){
    alert("雲端暫時未有資料（第一次請按『上雲』）");
    return;
  }
  const data = snap.data();
  if(!data || !data.state){ alert("雲端資料格式不正確"); return; }

  const localTs = Number(state._updatedAt || 0);
  const cloudTs = data.updatedAtMs ? Number(data.updatedAtMs) : 0;
  const msg = `準備從雲端拉取資料並覆蓋本機\n\n本機更新：${new Date(localTs).toLocaleString()}\n雲端更新：${cloudTs ? new Date(cloudTs).toLocaleString() : "(未知)"}\n\n確定要拉取？`;
  if(!confirm(msg)) return;

  Object.assign(state, data.state);
  state._updatedAt = Date.now();
  localStorage.setItem(CLOUD_LAST_PULL_KEY, String(Date.now()));
  localStorage.setItem(CLOUD_LINK_KEY, __cloudUid);
  __cloudLinked = true;
  save();
  render();
  updateCloudStatus();
  alert("✅ 已從雲端拉取完成");
}

async function cloudPush(){
  const fb = await getCloud();
  if(!fb || !__cloudUid){ alert("雲端未就緒，請稍後再試"); return; }

  const firstTime = (localStorage.getItem(CLOUD_LINK_KEY) !== __cloudUid);
  if(firstTime){
    const ok = confirm("第一次上雲：會把『本機資料』上傳到雲端，之後手機/電腦會同步同一份資料。\n\n確定上雲？");
    if(!ok) return;
  }

  const ref = fb.doc(fb.db, "users", __cloudUid);
  await fb.setDoc(ref, {
    state: state,
    updatedAt: fb.serverTimestamp(),
    updatedAtMs: Date.now(),
    app: "whale-delivery-log",
    v: 1
  }, { merge: true });

  localStorage.setItem(CLOUD_LINK_KEY, __cloudUid);
  __cloudLinked = true;
  updateCloudStatus();
  alert("☁️ 上雲完成");
}

function scheduleCloudPush(){
  if(!__cloudLinked) return;
  if(__pushTimer) clearTimeout(__pushTimer);
  __pushTimer = setTimeout(() => {
    cloudPush().catch(e => console.warn("[Cloud] auto push failed", e));
  }, 1500);
}
