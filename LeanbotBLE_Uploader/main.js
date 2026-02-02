// main.js
// ============================================================
// IMPORTS
// ============================================================
import { LeanbotBLE } from "./LeanbotBLE.js";
import { InoEditor } from "./InoEditor.js";
import { LeanbotCompiler } from "./LeanbotCompiler.js";
import { LeanbotConfig } from "./Config.js";

// ============================================================
//  LOCALSTORAGE (WORKSPACE)
// ============================================================

const LS_KEY_TREE = "leanbot_workspace_tree";

const FILE_KEY_PREFIX = "Workspace_File_";

const CURRENT_FILEID_KEY = "leanbot_workspace_current_fileID";

window.currentFileId = null;

// Tạo dữ liệu tree
const items = {
  root: {
    index: "root",
    isFolder: true,
    children: [],
    data: "Workspace"
  },
};

function saveWorkspaceTreeToLocalStorage() {
  const data = {
    items,
    currentFileId: window.currentFileId
  };

  localStorage.setItem(LS_KEY_TREE, JSON.stringify(data));
}

function readFile(itemId) {
  if(!itemId)return;
  return localStorage.getItem(FILE_KEY_PREFIX + itemId) || null;
}

function writeFile(itemId, content){
  if(!itemId)return;
  localStorage.setItem(FILE_KEY_PREFIX + itemId, content);
}

function removeFile(itemId){
  if(!itemId)return;
  localStorage.removeItem(FILE_KEY_PREFIX + itemId);
}

function saveCurrentFileID(){
  localStorage.setItem(CURRENT_FILEID_KEY,window.currentFileId);
}

function loadWorkspaceFromLocalStorage() {
  try {
    const rawTree = localStorage.getItem(LS_KEY_TREE);

    if (!rawTree) {
      console.log("[LS] No workspace found in localStorage");
      return;
    }

    // load tree
    const data = JSON.parse(rawTree);
    Object.keys(items).forEach(k => delete items[k]);
    Object.assign(items, data.items || {});

    window.currentFileId = localStorage.getItem(CURRENT_FILEID_KEY) || window.currentFileId;

    console.log("[LS] Workspace restored");
  } catch (e) {
    console.log("[LS] Restore failed", e);
  } finally {
    saveWorkspaceTreeToLocalStorage();
  }
}

// find and load from tree with absolute path 
// e.g: path = test/test.txt => find test.txt inside test inside root.
function loadFromLocalTree(path) { 
  
  if (!items) return "";

  const parts = String(path).trim().split("/").filter(Boolean);
  let currentId = "root";

  for (let i = 0; i < parts.length; i++) {
    const name = parts[i];

    const parent = items[currentId];
    if (!parent || !Array.isArray(parent.children)) return "";

    const nextId = parent.children.find(
      id => items[id]?.data === name
    );

    if (!nextId) return "";

    currentId = nextId;
  }
  
  return readFile(currentId);
}

loadWorkspaceFromLocalStorage();

// ============================================================
// CONFIG LOADING
// ============================================================

const LocalConfigName = "IDELocalConfig"

const LocalConfigFile = loadFromLocalTree(`${LocalConfigName}/${LocalConfigName}.yaml`)

const Config = new LeanbotConfig();

const IDEConfig = await Config.getIDEConfig(LocalConfigFile);

console.log(IDEConfig);

// ============================================================
// URL PARAMETERS + GLOBAL CONFIG
// ============================================================

console.log(`BLE_MaxLength = ${IDEConfig.LeanbotBLE.EspUploader.BLE_MaxLength}`);
console.log(`BLE_Interval = ${IDEConfig.LeanbotBLE.EspUploader.BLE_Interval}`);
console.log(`SERVER = ${IDEConfig.LeanbotCompiler.Server}`);

// ============================================================
// save config then INIT LEANBOT
// ============================================================

LeanbotBLE.setConfig(IDEConfig.LeanbotBLE);
LeanbotCompiler.setConfig(IDEConfig.LeanbotCompiler);

const leanbot = new LeanbotBLE();
const inoEditor = new InoEditor();

// ============================================================
// LEANBOT CONNECTION
// ============================================================
const leanbotStatus = document.getElementById("leanbotStatus");
const btnConnect    = document.getElementById("btnConnect");
const btnReconnect  = document.getElementById("btnReconnect"); 
let ConnectType = "";

function getLeanbotIDWithoutBLE() {
  return leanbot.getLeanbotID().replace(" BLE", "");
}

if (leanbot.getLeanbotID() === "No Leanbot"){
  leanbotStatus.style.display = "inline-block";
  leanbotStatus.textContent   = "NO Leanbot"
}
else{
  btnReconnect.style.display  = "inline-block";
  btnReconnect.textContent    = "RECONNECT " + getLeanbotIDWithoutBLE();
}

leanbot.onConnect = () => {

	// LbIDEEvent = onConnect
  const LbIDEEvent = {
    objectpk: ConnectType,
    thongtin: "",
    noidung: getLeanbotIDWithoutBLE(),
    server_: "",
    t_phanhoi: Math.round(leanbot.connectingTimeMs())
  };
  logLbIDEEvent(LbIDEEvent);

  leanbotStatus.style.display = "inline-block";
  leanbotStatus.textContent   = getLeanbotIDWithoutBLE();
  leanbotStatus.style.color   = "green";
  btnReconnect.style.display  = "none";
  uiResetUpload();
}

leanbot.onDisconnect = () => {

	// LbIDEEvent = onDisconnect
  const LbIDEEvent = {
    objectpk: "ble_disconnect",
    thongtin: "",
    noidung: getLeanbotIDWithoutBLE(),
    server_: "",
    t_phanhoi: 0
  };
  logLbIDEEvent(LbIDEEvent);

  leanbotStatus.style.display = "none";
  btnReconnect.style.display  = "inline-block";
  btnReconnect.textContent    = "RECONNECT " + getLeanbotIDWithoutBLE();
};

leanbot.onConnectError = (error_message) => { 
	// LbIDEEvent = onDisconnect
  const LbIDEEvent = {
    objectpk: "ble_err",
    thongtin: "",
    noidung: error_message,
    server_: "",
    t_phanhoi: 0
  };
  logLbIDEEvent(LbIDEEvent);
}

btnConnect.onclick   = async () => connectLeanbot();
btnReconnect.onclick = async () => reconnectLeanbot();

async function connectLeanbot() {
  ConnectType = 'ble_connect';
  console.log("Scanning for Leanbot...");
  leanbot.disconnect(); // Ngắt kết nối nếu đang kết nối
  const result = await leanbot.connect();
  console.log("Connect result:", result.message);
}

async function reconnectLeanbot() {
  ConnectType = 'ble_reconnect';
  console.log("Reconnecting to Leanbot...");
  const result = await leanbot.reconnect();
  console.log("Reconnect result:", result.message);
}

// ============================================================
// SERIAL MONITOR
// ============================================================
const serialLog           = document.getElementById("serialLog");
const inputCommand        = document.getElementById("serialInput");
const btnSend             = document.getElementById("btnSend");
const checkboxNewline     = document.getElementById("addNewline");
const checkboxAutoScroll  = document.getElementById("autoScroll");
const checkboxTimestamp   = document.getElementById("showTimestamp");
const btnClear            = document.getElementById("btnClear");
const btnCopy             = document.getElementById("btnCopy");

btnClear.onclick = () => clearSerialLog();
btnCopy.onclick  = () => copySerialLog();
btnSend.onclick  = () => send();

inputCommand.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    event.preventDefault(); // prevents form submit or newline
    send();                 // send line
  }
});

function formatTimestamp(ts) {
  const hours        = String(ts.getHours()).padStart(2,'0');
  const minutes      = String(ts.getMinutes()).padStart(2,'0');
  const seconds      = String(ts.getSeconds()).padStart(2,'0');
  const milliseconds = String(ts.getMilliseconds()).padStart(3,'0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

leanbot.Serial.onMessage = (message, timeStamp, timeGapMs) => {
  let prefix = "";
  if (checkboxTimestamp.checked) prefix = `${formatTimestamp(timeStamp)} (+${timeGapMs.toString().padStart(3, "0")}) -> `;

  serialLog.value += prefix + message;
  if (checkboxAutoScroll.checked) setTimeout(() => { serialLog.scrollTop = serialLog.scrollHeight;}, 0);
};

function clearSerialLog() {
  serialLog.value = "";
}

function copySerialLog() {
  serialLog.select();
  navigator.clipboard.writeText(serialLog.value)
    .then(()   => console.log("Copied!"))
    .catch(err => console.error("Copy failed:", err));
}

async function send() {
  const newline = checkboxNewline.checked ? "\n" : "";
  await leanbot.Serial.send(inputCommand.value + newline);
  inputCommand.value = "";
}

// ============================================================
// COMPILE + UPLOAD CORE
// ============================================================

// =================== Button Compile =================== //
const btnCompile = document.getElementById("btnCompile");
const ProgramTab = document.getElementById("programGrid");
const UploaderCompileLog   = document.getElementById("compileLog");
const UploaderCompileTitle = document.getElementById("compileTitle");
const UploaderCompileProg  = document.getElementById("progCompile");

btnCompile.addEventListener("click", async () => {
  await doCompile();
});

let currentCompileCode = null; // Use to capture snapshot of the source code being compiled

async function doCompile() {
  const sourceCode = inoEditor.getCppCode();
  currentCompileCode = sourceCode;
  if (!sourceCode || sourceCode.trim() === "") {
    alert("No code to compile!");
    return null;
  }

  compileStart = performance.now();
  ProgramTab.classList.add("hide-upload");
  uiSetTab("program");
  uiResetCompile();

  return await leanbot.Compiler.compile(sourceCode);
}

leanbot.Compiler.onCompileSucess = (compileMessage) => {
  const CompileCode = currentCompileCode;
	// LbIDEEvent = onRespond
  const LbIDEEvent = {
    objectpk: "compile_res",
    thongtin: CompileCode,
    noidung: compileMessage,
    server_: IDEConfig.LeanbotCompiler.Server,
    t_phanhoi: Math.round(leanbot.Compiler.elapsedTimeMs())
  };
  logLbIDEEvent(LbIDEEvent);

  UploaderCompileLog.value = compileMessage;
  UploaderCompileTitle.className = "green";

  if (!isCompileAndUpload) return;
  uploadStart = performance.now(); // reset upload start time
};

leanbot.Compiler.onCompileError = (compileMessage) => {
  const CompileCode = currentCompileCode;

	// LbIDEEvent = onRespond (error)
  const LbIDEEvent = {
    objectpk: "compile_err",
    thongtin: CompileCode,
    noidung: compileMessage,
    server_: IDEConfig.LeanbotCompiler.Server,
    t_phanhoi: Math.round(leanbot.Compiler.elapsedTimeMs())
  };
  logLbIDEEvent(LbIDEEvent);

  UploaderCompileLog.value = compileMessage;
  UploaderCompileProg.className = "red";
  UploaderCompileTitle.className = "red";
 
  if (!isCompileAndUpload) return;
  ProgramTab.classList.add("hide-upload"); // Ẩn upload khi compile lỗi
};

leanbot.Compiler.onCompileProgress = (elapsedTime, estimatedTotal) => {
  uiUpdateTime(compileStart, UploaderTimeCompile);
  uiUpdateProgress(UploaderCompileProg, elapsedTime, estimatedTotal); // ms = > s 
};

// =================== Button Upload =================== //
const btnUpload = document.getElementById("btnUpload");
let isCompileAndUpload = false;

btnUpload.addEventListener("click", async () => {
  const result = await leanbot.reconnect();
  if (!result.success) {
    alert("Please connect to Leanbot first!");
    return;
  }

  const sourceCode = inoEditor.getCppCode();
  if (!sourceCode || sourceCode.trim() === "") {
    alert("No code to compile!");
    return null;
  }

  compileStart = performance.now();
  ProgramTab.classList.remove("hide-upload"); // Hiện phần upload
  uiSetTab("program");
  uiResetCompile();
  uiResetUpload();
  isCompileAndUpload = true;

  await leanbot.compileAndUpload(sourceCode, IDEConfig.LeanbotCompiler.Server);
});

// =================== Upload DOM Elements =================== //
const UploaderTitleUpload  = document.getElementById("uploadTitle");
const UploaderTransfer     = document.getElementById("progTransfer");
const UploaderWrite        = document.getElementById("progWrite");
const UploaderVerify       = document.getElementById("progVerify");
const UploaderLogUpload    = document.getElementById("uploadLog");

const UploaderTimeCompile  = document.getElementById("compileTime");
const UploaderRSSI         = document.getElementById("uploadRSSI");
const UploaderTimeUpload   = document.getElementById("uploadTime");

function uiResetCompile() {
  UploaderCompileProg.value = 0;
  UploaderCompileProg.max   = 1;
  UploaderCompileProg.className = "yellow";
  UploaderCompileLog.value = "";
  UploaderCompileTitle.className  = "yellow";
  UploaderTimeCompile.textContent = "0.0 sec";
}

function uiResetUpload() {
  [UploaderTransfer, UploaderWrite, UploaderVerify].forEach(b => {
    b.value = 0;
    b.max   = 1;
    b.className = "yellow";
  });

  // reset 
  UploaderLogUpload.value = "";
  UploaderTitleUpload.textContent = "Upload to " + getLeanbotIDWithoutBLE();
  UploaderTitleUpload.className   = "yellow";
  UploaderTimeUpload.textContent  = "0.0 sec";
  UploaderRSSI.textContent        = "";
}

// =================== Uploader UI Updates =================== //
let compileStart = 0;
let uploadStart  = 0;

function uiUpdateTime(start, el) { 
  el.textContent = `${((performance.now() - start) / 1000).toFixed(1)} sec`;
};

function uiUpdateRSSI(rssi) {
  UploaderRSSI.textContent = `${rssi} dBm`;
}

function uiUpdateProgress(element, progress, total) {
  element.value = progress;
  element.max   = total;
  if (progress === total) element.className = "green";
}

// =================== Uploader Event Handlers =================== //
leanbot.Uploader.onMessage = ({ timeStamp, message }) => {
  uiUpdateTime(uploadStart, UploaderTimeUpload);

  const msg = `[${(timeStamp / 1000).toFixed(3)}] ${message}`;

  UploaderLogUpload.value += "\n" + msg;
  UploaderLogUpload.scrollTop = UploaderLogUpload.scrollHeight;
};

leanbot.Uploader.onRSSI = (rssi) => {
  uiUpdateRSSI(rssi);
};

leanbot.Uploader.onTransfer = (progress, totalBlocks) => {
  uiUpdateProgress(UploaderTransfer, progress, totalBlocks);
};

leanbot.Uploader.onTransferError = () => {
  UploaderTransfer.className = "red";
  UploaderTitleUpload.className = "red";
};

leanbot.Uploader.onWrite = (progress, totalBytes) => {
  uiUpdateProgress(UploaderWrite, progress, totalBytes);
};

leanbot.Uploader.onWriteError = () => {
  UploaderWrite.className = "red";
};

leanbot.Uploader.onVerify = (progress, totalBytes) => {
  uiUpdateProgress(UploaderVerify, progress, totalBytes);
};

leanbot.Uploader.onVerifyError = () => {
  UploaderVerify.className = "red";
};

leanbot.Uploader.onSuccess = () => {

  // LbIDEEvent = onUploadDone
  const LbIDEEvent = {
    objectpk: "upload_done",
    thongtin: "arduino:avr:uno",
    noidung: getLeanbotIDWithoutBLE(),
    server_: leanbot.Uploader.isSupported()?"LbEsp32":"JDY",
    t_phanhoi: Math.round(leanbot.Uploader.elapsedTimeMs())
  };

  logLbIDEEvent(LbIDEEvent);

  UploaderTitleUpload.className = "green";
  setTimeout(() => uiSetTab("monitor"), 1000); // Chuyển sang tab monitor sau 1 giây
};

leanbot.Uploader.onError = (err) => {
  
  // LbIDEEvent = onUploadError
  const LbIDEEvent = {
    objectpk: "upload_err",
    thongtin: "arduino:avr:uno",
    noidung: err,
    server_: leanbot.Uploader.isSupported()?"LbEsp32":"JDY",
    t_phanhoi: Math.round(leanbot.Uploader.elapsedTimeMs())
  };

  logLbIDEEvent(LbIDEEvent);

  UploaderTitleUpload.className = "red";
};

// ============================================================
// SERIAL SECTION TABS
// ============================================================
const workspace      = document.getElementById("workspace");
const serialSection  = document.getElementById("serialSection");
const btnSerial      = document.getElementById("btnSerial");

const programPanel   = document.getElementById("programPanel");
const monitorPanel   = document.getElementById("monitorPanel");
const tabs           = document.querySelectorAll("#serialTabs .serial-tab");
const btnCloseSerial = document.getElementById("btnCloseSerial");

function openSerial() {
  workspace.classList.add("serial-open");
  serialSection.classList.remove("is-hidden");
}

function closeSerial() {
  workspace.classList.remove("serial-open");
  serialSection.classList.add("is-hidden");
}

btnCloseSerial.addEventListener("click", () => {
  closeSerial();
}); 

function uiSetTab(name) {
  openSerial();

  // active tab
  tabs.forEach(tab =>
    tab.classList.toggle("active", tab.dataset.tab === name)
  );

  // show / hide panel
  programPanel.classList.toggle("is-hidden", name !== "program");
  monitorPanel.classList.toggle("is-hidden", name !== "monitor");
}

// Click SERIAL → mở PROGRAM
btnSerial.addEventListener("click", () => {
  uiSetTab("monitor");
});

// Click tab
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    uiSetTab(tab.dataset.tab);
  });
});

// ============================================================
// MONACO EDITOR (ARDUINO)
// ============================================================

await inoEditor.attach(document.getElementById("codeEditor"));

if (window.__pendingOpenFileId) {
  const id = window.__pendingOpenFileId;
  window.__pendingOpenFileId = null;
  openFileInMonaco(id);
}

// Autosave nội dung từ Monaco về fileContents
let saveTimer = null;

inoEditor.onChangeContent = () =>  {
  const id = window.currentFileId;
  if (!id) return;

  const currentfileContents = inoEditor.getContent();

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {writeFile(id, currentfileContents)}, IDEConfig.Editor.AutoSaveDelayMs); // save after 10000ms of inactivity
}

// ============================================================
// WORKSPACE BOOTSTRAP & INVARIANTS
// - Load .ino templates
// - Ensure workspace always contains at least one .ino file
// ============================================================

// Templates ino
const inoTemplates = {
  basicMotion: "",
  default: ""
};

async function loadText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Load template failed: ${url} (HTTP ${res.status})`);
  }
  return await res.text();
}

async function initInoTemplates() {
  inoTemplates.basicMotion = await loadText("./TemplateSourceCode/BasicMotion.ino");
  inoTemplates.default     = await loadText("./TemplateSourceCode/Default.ino");
}

await initInoTemplates();

// Trạng thái Monaco
window.__pendingOpenFileId = window.__pendingOpenFileId ?? null;

function createUUID() {
  return crypto.randomUUID();
}

function isFolder(id) {
  return !!id && !!items[id] && items[id].isFolder === true;
}

function isInoFile(id) {
  if (!id || !items[id]) return false;

  const it = items[id];
  if (!it || it.isFolder) return false;

  const name = String(it.data || "").trim().toLowerCase();
  return name.endsWith(".ino");
}

// Create basicMotion.ino if there isnt any .ino file in the workspace

function hasAnyInoFile() { // Check if there is any .ino file in the workspace
  for (const id in items) {
    if (!isInoFile(id)) continue;
    return true;
  }
  return false;
}

if (!hasAnyInoFile()) { // If no .ino file exists, create a default basicMotion.ino directly at root
  console.log("[LS] No .ino file found, creating default BasicMotion.ino");
  const id = createUUID();
  items[id] = {
    index: id,
    isFolder: false,
    children: [],
    data: "BasicMotion.ino",
    parent: "root",
 };
      
  items.root.children ||= [];
  if (!items.root.children.includes(id)) {
    items.root.children.push(id);
  }

  window.currentFileId = id;
  writeFile(id, inoTemplates.basicMotion || "");
}

openFileInMonaco(window.currentFileId || null); 
// Reopen the item that was last opened in the previous session.
// If no workspace exists (first time opening the editor), open basicMotion.ino.

// ============================================================
//  FILE TREE + WORKSPACE management
// ============================================================

// track focus, selection để tạo file, folder, move đúng vị trí
let lastFocusedId    = window.currentFileId; 
let lastSelectedIds  = [window.currentFileId];

// Gắn parent cho mỗi node, để move nhanh
function rebuildParents() {
  for (const id in items) items[id].parent = null;
  for (const id in items) {
    const ch = items[id].children;
    if (!Array.isArray(ch)) continue;
    for (const cid of ch) if (items[cid]) items[cid].parent = id;
  }
}
rebuildParents();

function getAncestorFolders(id) {

  if (!id || !items[id]) return []; // incase id is null or invalid

  const out = [];
  let p = items[id]?.parent;

  while (p && p !== "root") {
    out.unshift(p);
    p = items[p]?.parent;
  }
  return out;
}

const { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } = window.ReactComplexTree;
const dataProvider = new StaticTreeDataProvider(items, (item, data) => ({ ...item, data }));
const emitChanged = (ids) => dataProvider.onDidChangeTreeDataEmitter.emit(ids);

function openFileInMonaco(fileId) { 
  if (isFolder(fileId)) return; // avoid if a folder is passed

  if (!inoEditor.__isMonacoReady|| !inoEditor) {
    window.__pendingOpenFileId = fileId;
    return;
  }

  const content = readFile(fileId) ?? "";
  window.currentFileId = fileId;
  inoEditor.setContent(content);

  saveCurrentFileID(); // save current file id to local storage  
}

// Lấy folder đích để thêm file, folder
function getTargetFolderId() {
  const focus = items[lastFocusedId] ? lastFocusedId : "root";
  if (isFolder(focus)) return focus;

  const parent = items[focus]?.parent;
  if (isFolder(parent)) return parent;

  return "root";
}

// Import local file into tree
const btnLoadFile = document.getElementById("btnLoadFile");
const fileInput   = document.getElementById("FileInput");

btnLoadFile.addEventListener("click", async () => {
  fileInput.click();                // mở hộp chọn file
  const loaded = await loadFile();  // { fileName, ext, text }
  if (!loaded) return;

  // chuyển cho FILE TREE tạo file mới + mở trong Monaco
  window.importLocalFileToTree?.(loaded);
});

// Hàm load file và trả về đối tượng { fileName, ext, text }
async function loadFile() {
  return new Promise((resolve) => {
    fileInput.value = "";

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return resolve(null);

      const fileName = file.name;
      const ext = fileName.split(".").pop().toLowerCase();
      const text = await file.text();

      resolve({ fileName, ext, text }); // Trả về đối tượng file đã load
    };
  });
}

// Nhận file local đã đọc từ loadFile() và tạo file mới trong tree
window.importLocalFileToTree = (loaded) => {
  if (!loaded) return;

  const fileName = String(loaded.fileName || getTimestampName() + ".ino");
  const text = String(loaded.text ?? "");

  const parentId = getTargetFolderId();

  const id = createUUID();

  items[id] = {
    index: id,
    isFolder: false,
    children: [],
    data: fileName,
    parent: parentId
  };

  items[parentId].children ||= [];
  items[parentId].children.push(id);

  writeFile(id, text);

  emitChanged([parentId, id]);

  pendingTreeFocusId = id;
  openFileInMonaco(id);
  saveWorkspaceTreeToLocalStorage();
};


// Drag & Drop file vào file tree
const fileTreePanel = document.getElementById("fileTreePanel");

function isValidDropFile(file) {
  if (!file || !file.name) return false;
  const name = file.name.toLowerCase();
  return name.endsWith(".ino") || name.endsWith(".h") || name.endsWith(".cpp") || name.endsWith(".c");
}

fileTreePanel?.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  fileTreePanel.classList.add("is-drop-hover");
});

fileTreePanel?.addEventListener("dragleave", () => {
  fileTreePanel.classList.remove("is-drop-hover");
});

fileTreePanel?.addEventListener("drop", async (e) => {
  e.preventDefault();
  fileTreePanel.classList.remove("is-drop-hover");

  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length === 0) return;

  for (const f of files) {
    if (!isValidDropFile(f)) continue;

    try {
      const text = await readFileAsText(f);
      window.importLocalFileToTree?.({
        fileName: f.name,
        ext: (f.name.split(".").pop() || "").toLowerCase(),
        text
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Drop file lỗi: " + msg);
      break;
    }
  }
});

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Read file failed"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

// ===== sync state tree (selected, focused) cho thao tác ngoài tree =====
window.__rctItemActions ||= new Map();
const rememberItemActions = (id, ctx) => id && ctx && window.__rctItemActions.set(id, ctx);

let pendingTreeFocusId = null;

function focusTreeItemNow(id) {
  const ctx = window.__rctItemActions.get(id);
  if (!ctx) return false;

  try { ctx.focusItem?.(); } catch (e) {}
  try { ctx.selectItem?.(); } catch (e) {}

  lastFocusedId = id;
  lastSelectedIds = [id];
  return true;
}

function requestTreeFocus(id) {
  if (!id || !items[id]) return;

  // Ensure visibility
  const parent = items[id].parent;
  if (parent) expandFolderChain(parent);

  // Request focus (deferred)
  pendingTreeFocusId = id;

  // Force tree to re-render so renderItem can consume the request
  emitChanged([parent || "root", id]);
}

let pendingTreeRenameId = null;

// "2025.12.31-08.44.22.ino"
function createItemName(desiredName) {
  let name = String(desiredName || "").trim();
  if (name === "") name = getTimestampName() + ".ino";
  return name;
}

// Mở folder nếu nó đang collapsed
function expandFolderChain(folderId) {
  let id = folderId; 

  while (id && id !== "root") {
    const ctx = window.__rctItemActions.get(id);
    try { ctx?.expandItem?.(); } catch (e) {} 
    id = items[id]?.parent;
  }
}

function getFolderContent(id, prefix = "") {
  const folderNode = items[id];

  if (!folderNode) return ""; // item not exist
  if (!isFolder(id)) return `${prefix}${folderNode.data}`; // file => return name

  const lines = [];
  lines.push(folderNode.data + " /"); // folder name

  const children = (folderNode.children || [])
    .map(id => items[id])
    .filter(Boolean);

  if (children.length === 0) {
    lines.push(`${prefix}└─ Folder empty`); // empty folder
    return lines.join("\n");
  }

  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
    const connector = isLast ? "└─ " : "├─ ";
    const isChildFolder = isFolder(child.index);

    const childPrefix = prefix + (isLast ? "   " : "│  "); // next level prefix
    const contentPrefix = isChildFolder
      ? childPrefix
      : prefix + connector; // prefix passed to recursion

    const content = getFolderContent(child.index, contentPrefix); // recursive call

    lines.push(
      isChildFolder
        ? prefix + connector + content // folder entry
        : content // file entry
    );
  });

  return lines.join("\n");
}

// Thêm file, folder
function createItem(isFolder, defaultName, defaultfileContent = null) {
  const parentId = getTargetFolderId();
  console.log("[CREATE] target parentId =", parentId);

  let name = String(defaultName || "").trim();

  if (!isFolder){
    // If name already has an extension (anything after a dot), keep it
    // If not, name = timestamp.ino
    name = /\.[^./]+$/.test(name) ? name : ensureInoExtension(createItemName(name));
  }

  const id = createUUID();

  items[id] = { index: id, isFolder, children: [], data: name, parent: parentId };
  console.log("[CREATE] item.parent =", items[id].parent);
  items[parentId].children ||= [];
  items[parentId].children.push(id);
  console.log(
    "[CHECK] parent contains child =",
    items[parentId].children.includes(id)
  );

  if (!isFolder) writeFile(id, defaultfileContent || inoTemplates.default || "");

  emitChanged([parentId, id]);

  // Mở chain folder cha để nhìn thấy item mới
  // Nếu tạo folder, mở luôn chính folder đó
  setTimeout(() => {
    expandFolderChain(parentId);

    if (isFolder) {
      try {
        const folderContent = getFolderContent(id); // in folder structure to console
        window.currentFileId = id;
        inoEditor.setContentReadOnly(folderContent);
        const ctx = window.__rctItemActions.get(id);
        ctx?.expandItem?.();
      } catch (e) {
        console.log("[TREE] expand new folder failed =", id, e);
      }
    }
  }, 0);

  pendingTreeRenameId = id;
  pendingTreeFocusId  = id;

  if (!isFolder) openFileInMonaco(id);
  saveWorkspaceTreeToLocalStorage();
}

const btnNewFile = document.getElementById("btnNewFile");
const btnNewFolder = document.getElementById("btnNewFolder");

function getTimestampName() {
  const d = new Date();

  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");

  const hh   = String(d.getHours()).padStart(2, "0");
  const mi   = String(d.getMinutes()).padStart(2, "0");
  const sec  = String(d.getSeconds()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd}-${hh}.${mi}.${sec}`;
}

btnNewFile?.addEventListener("click", () => {
  const name = getTimestampName() + ".ino";
  console.log("Creating new file:", name);
  createItem(false, name);
});

btnNewFolder?.addEventListener("click", () => {
  const name = getTimestampName();
  console.log("Creating new folder:", name);
  createItem(true, name);
});

function ensureInoExtension(name) {
  const n = String(name || "").trim();
  if (n === "") return getTimestampName() + ".ino";

  // nếu đã có .ino thì giữ nguyên
  if (n.toLowerCase().endsWith(".ino")) return n;

  // không có đuôi → tự thêm .ino
  return n + ".ino";
}

// rename file bằng F2
function renameFileId(id, newDisplayName) {
  const item = items[id];
  if (!item) return;

  if (item.index === "root") return; // NEVER rename root

  if(newDisplayName === LocalConfigName && items[id].parent == "root"){ // Creat localConfigFolder => also create localConfigFile.yaml
    createItem(false, `${LocalConfigName}.yaml`, Config.getUserConfigFile());
  }

  item.data = newDisplayName;
  emitChanged([id]);

  pendingTreeFocusId = id;
  saveWorkspaceTreeToLocalStorage();
}

// drag drop, reorder, move folder
function removeFromParent(childId) {
  let removedParent = null;

  const p = items[childId]?.parent;
  if (p && items[p]?.children) {
    const list = items[p].children;
    const before = list.length;
    items[p].children = list.filter((x) => x !== childId);
    if (items[p].children.length !== before) removedParent = p;
  }

  // fallback: nếu parent bị sai, quét toàn bộ folder để xóa mọi chỗ đang chứa childId
  for (const id in items) {
    const it = items[id];
    if (!isFolder(id) || !Array.isArray(it.children)) continue;

    const before = it.children.length;
    it.children = it.children.filter((x) => x !== childId);
    if (it.children.length !== before) removedParent = removedParent || id;
  }

  return removedParent;
}

function insertIntoFolder(folderId, childId, index) {
  if (!isFolder(folderId)) return;

  const f = items[folderId];

  f.children ||= [];

  f.children = f.children.filter((x) => x !== childId);

  let idx = Number.isFinite(index) ? index : f.children.length;
  if (idx < 0) idx = 0;
  if (idx > f.children.length) idx = f.children.length;

  f.children.splice(idx, 0, childId);
  items[childId].parent = folderId;
}

function isDescendantOf(candidateChild, candidateParent) {
  let p = items[candidateChild]?.parent;
  while (p) {
    if (p === candidateParent) return true;
    p = items[p]?.parent;
  }
  return false;
}

function handleDrop(itemsDragged, target) {
  if (!target) return;

  const draggedIds = Array.from(new Set((itemsDragged || []).map(x => x.index)));

  // Xác định folder đích và vị trí chèn
  let destFolderId = "root";
  let insertIndex = 0;

  if (target.targetType === "between-items") {
    // Thả giữa các item, dùng parentItem và childIndex
    destFolderId = target.parentItem || "root";
    insertIndex = Number.isFinite(target.childIndex)
      ? target.childIndex
      : (items[destFolderId]?.children?.length ?? 0);

  } else {
    // Thả lên item cụ thể
    const targetId = target.targetItem;
    const targetItem = items[targetId];

    console.log("Target item:", targetItem);

    if (!targetItem) return;

    destFolderId = isFolder(targetId) ? targetId : (targetItem.parent || "root");
    insertIndex = Number.isFinite(target.childIndex)
      ? target.childIndex
      : (items[destFolderId]?.children?.length ?? 0);
  }

  // Chặn kéo folder vào chính con của nó
  for (const id of draggedIds) {
    if (id === destFolderId) return;
    if (isFolder(id) && isDescendantOf(destFolderId, id)) return;
  }

  const changed = new Set([destFolderId]);

  // Bỏ khỏi parent cũ
  for (const id of draggedIds) {
    const oldParent = removeFromParent(id);
    if (oldParent) changed.add(oldParent);
  }

  // Chèn vào folder đích theo thứ tự
  draggedIds.forEach((id, i) => {
    insertIntoFolder(destFolderId, id, insertIndex + i);
    changed.add(id);
  });

  rebuildParents();
  emitChanged(Array.from(changed));
  saveWorkspaceTreeToLocalStorage();

  setTimeout(() => {
    expandFolderChain(destFolderId);

    if (draggedIds.length === 1) {
      const movedId = draggedIds[0];
      const movedItem = items[movedId];
      if (!movedItem) return;

      pendingTreeFocusId = movedId;

      // Nếu là folder: mở luôn folder đó
      if (isFolder(movedId)) {
        try {
          const ctx = window.__rctItemActions.get(movedId);
          ctx?.expandItem?.();
          console.log("[MOVE] expanded moved folder =", movedId);
        } catch (e) {
          console.log("[MOVE] expand moved folder failed =", movedId, e);
        }
        return;
      }

      // Nếu là file: mở file, đồng thời folder cha đã được expand ở trên
      console.log("[MOVE] open moved file =", movedId, "parent =", movedItem.parent);
      openFileInMonaco(movedId);
    }
  }, 0);
}

// ============================================================
// TREE VIEWSTATE + CONTEXT MENU
// ============================================================
const initialOpenId = (window.currentFileId && items[window.currentFileId])
  ? window.currentFileId
  : null;

const ancestorFolders = getAncestorFolders(initialOpenId);

const viewState = {
  tree: {
    expandedItems: ["root", ...ancestorFolders],
    selectedItems: initialOpenId ? [initialOpenId] : [],
    focusedItem: initialOpenId || undefined,
  },
};

// ==================== TREE CONTEXT MENU (RIGHT CLICK) ==================== //
const ctxMenu = document.getElementById("treeCtxMenu");
const ctxRenameBtn = document.getElementById("ctxRename");
const ctxDeleteBtn = document.getElementById("ctxDelete");

let ctxTargetId = null;

function hideCtxMenu() {
  ctxMenu?.classList.add("is-hidden");
  ctxTargetId = null;
}

function showCtxMenu(x, y, itemId) {
  if (!ctxMenu) return;
  ctxTargetId = itemId;

  ctxMenu.classList.remove("is-hidden");

  const pad = 6;
  const w = ctxMenu.offsetWidth || 160;
  const h = ctxMenu.offsetHeight || 90;

  ctxMenu.style.left = Math.max(pad, Math.min(x, innerWidth - w - pad)) + "px";
  ctxMenu.style.top = Math.max(pad, Math.min(y, innerHeight - h - pad)) + "px";
}

addEventListener("click", hideCtxMenu);
// addEventListener("scroll", hideCtxMenu, true);
// addEventListener("keydown", (e) => { if (e.key === "Escape") hideCtxMenu(); });

ctxMenu?.addEventListener("click", (e) => e.stopPropagation());

// Xóa item 
function deleteSubtree(id) {
  const it = items[id];
  if (!it) return;

  if (isFolder(id) && Array.isArray(it.children)) {
    for (const cid of it.children) deleteSubtree(cid);
  } else {
    delete removeFile(id);
  }

  delete items[id];
}

function deleteItemWithConfirm(itemId) {
  const it = items[itemId];
  if (!it) return;

  const name = it.data || itemId;
  const childCount = isFolder(itemId) ? (it.children?.length || 0) : 0;

  let message;

  if (isFolder(itemId)) {
    message = childCount > 0
      ? `Delete folder "${name}" and its ${childCount} items?`
      : `Delete folder "${name}"?`;
  } else {
    message = `Delete file "${name}"?`;
  }

  const ok = window.confirm(message);
  console.log("[DELETE] confirm =", ok, "id =", itemId);

  if (!ok) return;

  deleteItemById(itemId);
}

function pickNextTreeItem(id) {
  let firstFolder = null;

  for (const it of Object.values(items)) {
    if (!it || it.index === "root") continue;

    if(id === it.index) continue; // id is the id going to be deleted

    // prefer file
    if (!isFolder(it.index)) {
      return it.index;
    }

    // remember first folder as fallback
    if (!firstFolder) {
      firstFolder = it.index;
    }
  }

  // no file => return a folder if exists
  if (firstFolder) return firstFolder;

  // tree empty (only root exists)
  return null;
}

function deleteItemById(id) {
  if (!id || !items[id] || id === "root") return;

  const parent = items[id]?.parent;
  const nextFocus = parent && parent !== "root"? parent: pickNextTreeItem(id); // when delte, focus parent, buf if parent is non exits or root, focus the first file in tree

  // gỡ id khỏi mọi folder trước, tránh lệch parent sau drag
  const removedParent = removeFromParent(id) || (items[id].parent || "root");

  deleteSubtree(id);

  // focus lại
  pendingTreeFocusId = items[removedParent] ? removedParent : "root";

  window.currentFileId = nextFocus;
  if (nextFocus) {
    requestTreeFocus(nextFocus);
    if(!isFolder(nextFocus))openFileInMonaco(nextFocus); // Nếu là file, mở trong editor
    else {
        const folderContent = getFolderContent(nextFocus); // in folder structure to console
        inoEditor.setContentReadOnly(folderContent);  
    }
  } 
  else { // Nếu không còn file nào, clear editor
    inoEditor.setContentReadOnly("\\");
  }

  if (!items[lastFocusedId]) lastFocusedId = pendingTreeFocusId;
  if (lastSelectedIds.some((x) => !items[x])) lastSelectedIds = [lastFocusedId];

  rebuildParents();
  emitChanged([removedParent, "root"]);
  saveWorkspaceTreeToLocalStorage();
}

ctxDeleteBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const id = ctxTargetId;
  hideCtxMenu();
  deleteItemWithConfirm(id);
});

// Rename ngay khi bấm rename trong context menu
ctxRenameBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const id = ctxTargetId;
  hideCtxMenu();

  const ctx = window.__rctItemActions.get(id);
  if (!ctx?.startRenamingItem) return;

  try { ctx.focusItem?.(); } catch (err) {}
  try { ctx.selectItem?.(); } catch (err) {}
  try { ctx.startRenamingItem(); } catch (err) {}
});

// ============================================================
// RENDER FILE TREE
// ============================================================
const mount = document.getElementById("fileTreeMount");
const reactRoot = window.ReactDOM.createRoot(mount);

reactRoot.render(
  window.React.createElement(
    UncontrolledTreeEnvironment,
    {
      dataProvider,
      getItemTitle: (item) => item.data,
      viewState,

      allowRenaming: true,

      canDragAndDrop: true,
      canDropOnFolder: true,
      canReorderItems: true,
      canInvokePrimaryActionOnItemContainer: true,
      defaultInteractionMode: "click-arrow-to-expand",

      onFocusItem: (item) => {
        if (!item) return;
        lastFocusedId = item.index;
      },

      onSelectItems: (ids) => {
        // console.log("onSelectItems:", ids, "\nlength =", Array.isArray(ids) ? ids.length : 0);
        lastSelectedIds = Array.isArray(ids) ? ids.slice() : [];
        if (lastSelectedIds.length > 0) lastFocusedId = lastSelectedIds[lastSelectedIds.length - 1];
      },

      onPrimaryAction: (item) => {
        // console.log("onPrimaryAction:", item.index);
        if (isFolder(item.index)){ // if folder, show content in editor
          const folderContent = getFolderContent(item.index); // in folder structure to console
          window.currentFileId = item.index;
          inoEditor.setContentReadOnly(folderContent);
          return;
        }
        // if file, open in monaco
        pendingTreeFocusId = item.index;
        openFileInMonaco(item.index);
      },

      onRenameItem: (item, name) => {
        if (!item) return;
        renameFileId(item.index, name);
      },

      onDrop: (itemsDragged, target) => {
        handleDrop(itemsDragged, target);
      },

      renderItem: ({ item, title, arrow, context, children, depth }) => {
        rememberItemActions(item.index, context);

        if (pendingTreeFocusId === item.index) {
          pendingTreeFocusId = null;
          setTimeout(() => focusTreeItemNow(item.index), 0);
        }

        if (pendingTreeRenameId === item.index) {
          pendingTreeRenameId = null;
          setTimeout(() => {
          try { context.focusItem?.(); } catch {}
          try { context.selectItem?.(); } catch {}
          try { context.startRenamingItem?.(); } catch {}
          }, 0);
        }

        const Tag = "button";

        const onCtx = (e) => {
          e.preventDefault();
          try { context.focusItem?.(); } catch {}
          try { context.selectItem?.(); } catch {}
          lastFocusedId = item.index;
          lastSelectedIds = [item.index];
          showCtxMenu(e.clientX, e.clientY, item.index);
        };

        const className =
          "file-tree-item" +
          (context.isSelected ? " is-selected" : "") +
          (context.isFocused ? " is-focused" : "");

        const indent = Math.max(0, (depth || 0)) * 14; // thụt lề

        let titleNode = title;

        if (context.isRenaming) {
          titleNode = window.React.createElement(
            "span",
            {
              ref: (el) => {
                if (!el) return;

                const inp = el.querySelector("input,textarea");
                if (!inp) return;

                // chỉ xử lý 1 lần cho input này
                if (inp.dataset.inoSelDone === "1") return;
                inp.dataset.inoSelDone = "1";

                const applySelection = () => {
                  inp.focus();

                  const val0 = inp.value ?? "";
                  const val = String(val0).trim();           // bỏ khoảng trắng thừa
                  const lower = val.toLowerCase();

                  if (lower.endsWith(".ino")) {
                    const end = Math.max(0, val.length - 4);
                    try {
                      // nếu trim làm đổi độ dài, cập nhật value để selection đúng
                      if (inp.value !== val) inp.value = val;
                      inp.setSelectionRange(0, end);
                    } catch (e) {
                      try { inp.select(); } catch (e2) {}
                    }
                  } else {
                    try { inp.select(); } catch (e) {}
                  }
                };

                // chạy sau khi input render xong
                requestAnimationFrame(() => {
                  applySelection();

                  // chạy lại sau đó để tránh bị thư viện ghi đè selection
                  setTimeout(applySelection, 30);
                });
              }
            },
            title
          );
        }

        return window.React.createElement(
          "li",
          { ...context.itemContainerWithChildrenProps, style: { margin: 0 } },
          window.React.createElement(
            Tag,
            {
              ...context.itemContainerWithoutChildrenProps,
              ...context.interactiveElementProps,
              disabled: context.isRenaming,
              onContextMenu: onCtx,
              className,
              style: {
                border: 0,
                background: "transparent",
                padding: "4px 6px",
                paddingLeft: (6 + indent) + "px",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                width: "100%",
                textAlign: "left",
              },
            },
            arrow,
            titleNode
          ),
          children
        );
      },

    },
    window.React.createElement(Tree, {
      treeId: "tree",
      rootItem: "root",
      treeLabel: "Files",
    })
  )
);

// Initial focus file
pendingTreeFocusId = initialOpenId;
if (initialOpenId) {
  openFileInMonaco(initialOpenId);
}

// ============================================================
// Leanbot IDE Event(ARDUINO)
// ============================================================

function logLbIDEEvent(event) {

  const shorten = (text, len = 64) => {
    const normalized = String(text ?? "")
      .replace(/\r?\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return normalized.length > len
      ? normalized.slice(0, len)
      : normalized;
  };

  console.log(
    `LbIDEEvent
    objectpk   : ${event.objectpk}
    thongtin   : ${shorten(event.thongtin)}
    noidung    : ${shorten(event.noidung)}
    server_    : ${event.server_}
    t_phanhoi  : ${event.t_phanhoi}`
  );
}