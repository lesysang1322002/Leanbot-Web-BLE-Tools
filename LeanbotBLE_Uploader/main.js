// main.js
// ============================================================
// IMPORTS
// ============================================================
import { LeanbotBLE } from "./LeanbotBLE.js";
import { InoEditor } from "./InoEditor.js";
import { LeanbotCompiler } from "./LeanbotCompiler.js";
import { LeanbotConfig } from "./Config.js";
import { LeanFs } from "./LeanFs.js";

// ============================================================
//  Mount Leanbot File System
// ============================================================

const leanfs = new LeanFs();
leanfs.mount();

// ============================================================
// Restore Current ID
// ============================================================

const CURRENT_FILEID_KEY = "leanbot_workspace_current_fileID";

window.currentFileId = localStorage.getItem(CURRENT_FILEID_KEY) || leanfs.getRoot() || null;

function saveCurrentFileID(){
  localStorage.setItem(CURRENT_FILEID_KEY, window.currentFileId);
}

async function changeCurrentFileId(newFileId){
  if(newFileId === window.currentFileId)return;
  await leanfs.writeFile(window.currentFileId, inoEditor.getContent());
  window.currentFileId = newFileId;
}

// ============================================================
// CONFIG LOADING
// ============================================================

const LocalConfigName = "IDELocalConfig";

const LocalConfigUUID = leanfs.getItemByPath(leanfs.getRoot(), `${LocalConfigName}/${LocalConfigName}.yaml`); // find from root

const LocalConfigFile = await leanfs.readFile(LocalConfigUUID);

const Config = new LeanbotConfig();

const IDEConfig = await Config.getIDEConfig(LocalConfigFile);

console.log(IDEConfig);

// URL PARAMETERS + GLOBAL CONFIG
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
  const uuid = window.__pendingOpenFileId;
  window.__pendingOpenFileId = null;
  await openFileInMonaco(uuid);
}

// Autosave nội dung từ Monaco về fileContents
let saveTimer = null;

inoEditor.onChangeContent = () =>  {
  const uuid = window.currentFileId;
  if (!uuid) return;
  
  const currentfileContents = inoEditor.getContent();

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {await leanfs.writeFile(uuid, currentfileContents)}, IDEConfig.Editor.AutoSaveDelayMs); // save after 10000ms of inactivity
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

const { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } = window.ReactComplexTree;
const dataProvider = new StaticTreeDataProvider(leanfs.getItems(), (item, data) => ({ ...item, data }));
const emitChanged = (ids) => dataProvider.onDidChangeTreeDataEmitter.emit(ids);

// Trạng thái Monaco
window.__pendingOpenFileId = window.__pendingOpenFileId ?? null;

// Create basicMotion.ino if there isnt any .ino file in the workspace

function hasAnyInoFile(fs) { // Check if there is any .ino file in the workspace
  const root = leanfs.getRoot();

  const stack = [root];

  while (stack.length) {
    const uuid = stack.pop();

    if (leanfs.isType(uuid, LeanFs.leanfs_TYPE.INO)) {
      return true;
    }

    if (leanfs.isDir(uuid)) {
      stack.push(...leanfs.getAllChildren(uuid));
    }
  }

  return false;
}

if (!hasAnyInoFile()) { // If no .ino file exists, create a default basicMotion.ino directly at root
  console.log("[LS] No .ino file found, creating default BasicMotion.ino");
  const uuid = leanfs.createFile(leanfs.getRoot());
  leanfs.rename(uuid, "BasicMotion.ino");
  await leanfs.writeFile(uuid, inoTemplates.basicMotion || "");
  await changeCurrentFileId(uuid);
}

await openFileInMonaco(window.currentFileId || null); 
// Reopen the item that was last opened in the previous session.
// If no workspace exists (first time opening the editor), open basicMotion.ino.

// ============================================================
//  FILE TREE management
// ============================================================

// track focus, selection để tạo file, folder, move đúng vị trí
let lastFocusedId    = window.currentFileId; 
let lastSelectedIds  = [window.currentFileId];

function getAncestorFolders(uuid) { // get ancestor until the root

  if (!uuid) return []; // incase uuid is null or invalid

  const out = [];
  let p = leanfs.getParent(uuid);

  while (p && p !== leanfs.getRoot()) {
    out.unshift(p);
    p = leanfs.getParent(p);
  }
  return out;
}

async function openFileInMonaco(fileId) { 
  if (leanfs.isDir(fileId)) return; // avoid if a folder is passed

  if (!inoEditor.__isMonacoReady|| !inoEditor) {
    window.__pendingOpenFileId = fileId;
    return;
  }

  const content = await leanfs.readFile(fileId) ?? "";
  await changeCurrentFileId(fileId);
  inoEditor.setContent(content);

  saveCurrentFileID(); // save current file uuid to local storage  
}

// Lấy folder đích để thêm file, folder
function getTargetFolderId() {
  const focus = leanfs.isExist(lastFocusedId)? lastFocusedId : leanfs.getRoot();
  if (leanfs.isDir(focus)) return focus;

  const parent = leanfs.getParent(focus);
  if (leanfs.isDir(parent)) return parent;

  return leanfs.getRoot();
}

// Import local file into tree
const btnLoadFile = document.getElementById("btnLoadFile");
const fileInput   = document.getElementById("FileInput");

btnLoadFile.addEventListener("click", async () => {
  fileInput.click();                // mở hộp chọn file
  const loaded = await loadFile();  // { fileName, ext, text }
  if (!loaded) return;

  // chuyển cho FILE TREE tạo file mới + mở trong Monaco
  await window.importLocalFileToTree?.(loaded);
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
window.importLocalFileToTree = async (loaded) => {
  if (!loaded) return;

  // const fileName = String(loaded.fileName || getTimestampName() + ".ino");
  const fileName =   loaded.fileName == null? null: String(loaded.fileName);
  const text = String(loaded.text ?? "");

  const parentId = getTargetFolderId();

  const uuid = leanfs.createFile(parentId);
  leanfs.rename(uuid, fileName);

  await leanfs.writeFile(uuid, text);

  emitChanged([parentId, uuid]);

  pendingTreeFocusId = uuid;
  await openFileInMonaco(uuid);
};

// Drag & Drop file vào file tree
const fileTreePanel = document.getElementById("fileTreePanel");

function isValidDropFile(file) {
  if (!file) return false;
  if (!file.name) return false;
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
      await window.importLocalFileToTree?.({
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
const rememberItemActions = (uuid, ctx) => uuid && ctx && window.__rctItemActions.set(uuid, ctx);

let pendingTreeFocusId = null;

function focusTreeItemNow(uuid) {
  const ctx = window.__rctItemActions.get(uuid);
  if (!ctx) return false;

  try { ctx.focusItem?.(); } catch (e) {}
  try { ctx.selectItem?.(); } catch (e) {}

  lastFocusedId = uuid;
  lastSelectedIds = [uuid];
  return true;
}

let pendingTreeRenameId = null;

// Mở folder nếu nó đang collapsed
function expandFolderChain(folderId) {
  let uuid = folderId; 

  while (uuid && uuid !== leanfs.getRoot()) {
    const ctx = window.__rctItemActions.get(uuid);
    try { ctx?.expandItem?.(); } catch (e) {} 
    uuid = leanfs.getParent(uuid);
  }
}

const btnNewFile = document.getElementById("btnNewFile");
const btnNewFolder = document.getElementById("btnNewFolder");

btnNewFile?.addEventListener("click", async () => {
  const parentId = getTargetFolderId();
  // console.log("[CREATE] target parentId =", parentId);

  const itemUUID = leanfs.createFile(parentId); // Create a file
  const newname = NameEnsureInoExtension(itemUUID);
  console.log("new file name:", newname);
  leanfs.rename(itemUUID, newname);             // rename it to somename with .ino (for example: "2025.12.31-08.44.22.ino")
  await leanfs.writeFile(itemUUID, inoTemplates.default || ""); // content = deafult.ino
  
  emitChanged([parentId, itemUUID]);
  
  pendingTreeRenameId = itemUUID;
  pendingTreeFocusId  = itemUUID;

  await openFileInMonaco(itemUUID);
});

btnNewFolder?.addEventListener("click", () => {
 const parentId = getTargetFolderId();
  // console.log("[CREATE] target parentId =", parentId);

  const itemUUID = leanfs.createDir(parentId); // Create a dir, default name: "2025.12.31-08.44.22"

  emitChanged([parentId, itemUUID]);

 // Mở chain folder cha để nhìn thấy item mới
  // Nếu tạo folder, mở luôn chính folder đó
  setTimeout(async () => {
    expandFolderChain(parentId);
    try {
      const folderContent = leanfs.readDir(itemUUID); // in folder structure to console
      await changeCurrentFileId(itemUUID);
      inoEditor.setContentReadOnly(folderContent);
      const ctx = window.__rctItemActions.get(itemUUID);
      ctx?.expandItem?.();
    } catch (e) {
      console.log("[TREE] expand new folder failed =", itemUUID, e);
    }
  }, 0);
  
  pendingTreeRenameId = itemUUID;
  pendingTreeFocusId  = itemUUID;
});

// rename file bằng F2
async function renameFileId(uuid, newDisplayName) {
  
  if (leanfs.isExist(uuid) === false) return;

  leanfs.rename(uuid, newDisplayName);

  // Rename a folder in root to LocalConfigName => auto  Create LocalConfig File
  if(newDisplayName === LocalConfigName && leanfs.getParent(uuid) == leanfs.getRoot()){ // Creat localConfigFolder => also create localConfigFile.yaml
    console.log("Auto Create Local Config File");
    const childUUID = leanfs.createFile(uuid); // Create a file
    leanfs.rename(childUUID,  `${LocalConfigName}.yaml`);    // rename
    await leanfs.writeFile(childUUID, Config.getUserConfigFile()); // copy content of UserConfigFile
  
    emitChanged([uuid, childUUID]);
  
    pendingTreeFocusId  = childUUID;
    await openFileInMonaco(childUUID);
    return;
  }

  emitChanged([uuid]);
  pendingTreeFocusId = uuid;
}

// function insertIntoFolder(folderId, childId, index) {
//   if (!isFolder(folderId)) return;

//   const f = items[folderId];

//   f.children ||= [];

//   f.children = f.children.filter((x) => x !== childId);

//   let idx = Number.isFinite(index) ? index : f.children.length;
//   if (idx < 0) idx = 0;
//   if (idx > f.children.length) idx = f.children.length;

//   f.children.splice(idx, 0, childId);
//   items[childId].parent = folderId;
// }

// function isDescendantOf(candidateChild, candidateParent) {
//   let p = items[candidateChild]?.parent;
//   while (p) {
//     if (p === candidateParent) return true;
//     p = items[p]?.parent;
//   }
//   return false;
// }

// async function handleDrop(itemsDragged, target) {
//   if (!target) return;

//   const draggedIds = Array.from(new Set((itemsDragged || []).map(x => x.index)));

//   // Xác định folder đích và vị trí chèn
//   let destFolderId = leanfs.getRoot();
//   let insertIndex = 0;

//   if (target.targetType === "between-items") {
//     // Thả giữa các item, dùng parentItem và childIndex
//     destFolderId = target.parentItem || leanfs.getRoot();
//     insertIndex = Number.isFinite(target.childIndex)
//       ? target.childIndex
//       : (items[destFolderId]?.children?.length ?? 0);

//   } else {
//     // Thả lên item cụ thể
//     const targetId = target.targetItem;
//     const targetItem = items[targetId];

//     console.log("Target item:", targetItem);

//     if (!targetItem) return;

//     destFolderId = isFolder(targetId) ? targetId : (targetItem.parent || leanfs.getRoot());
//     insertIndex = Number.isFinite(target.childIndex)
//       ? target.childIndex
//       : (items[destFolderId]?.children?.length ?? 0);
//   }

//   // Chặn kéo folder vào chính con của nó
//   for (const uuid of draggedIds) {
//     if (uuid === destFolderId) return;
//     if (isFolder(uuid) && isDescendantOf(destFolderId, uuid)) return;
//   }

//   const changed = new Set([destFolderId]);

//   // Bỏ khỏi parent cũ
//   for (const uuid of draggedIds) {
//     const oldParent = removeFromParent(uuid);
//     if (oldParent) changed.add(oldParent);
//   }

//   // Chèn vào folder đích theo thứ tự
//   draggedIds.forEach((uuid, i) => {
//     insertIntoFolder(destFolderId, uuid, insertIndex + i);
//     changed.add(uuid);
//   });

//   rebuildParents();
//   emitChanged(Array.from(changed));
//   await saveWorkspaceTreeToLocalStorage();

//   setTimeout(async () => {
//     expandFolderChain(destFolderId);

//     if (draggedIds.length === 1) {
//       const movedId = draggedIds[0];
//       const movedItem = items[movedId];
//       if (!movedItem) return;

//       pendingTreeFocusId = movedId;

//       // Nếu là folder: mở luôn folder đó
//       if (isFolder(movedId)) {
//         try {
//           const ctx = window.__rctItemActions.get(movedId);
//           ctx?.expandItem?.();
//           console.log("[MOVE] expanded moved folder =", movedId);
//         } catch (e) {
//           console.log("[MOVE] expand moved folder failed =", movedId, e);
//         }
//         return;
//       }

//       // Nếu là file: mở file, đồng thời folder cha đã được expand ở trên
//       console.log("[MOVE] open moved file =", movedId, "parent =", movedItem.parent);
//       await openFileInMonaco(movedId);
//     }
//   }, 0);
// }

// ============================================================
// TREE VIEWSTATE + CONTEXT MENU
// ============================================================
const initialOpenId = (window.currentFileId && leanfs.isExist(window.currentFileId))
  ? window.currentFileId
  : null;

const ancestorFolders = getAncestorFolders(initialOpenId);

const viewState = {
  tree: {
    expandedItems: [leanfs.getRoot(), ...ancestorFolders],
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

function showCtxMenu(x, y, uuid) {
  if (!ctxMenu) return;
  ctxTargetId = uuid;

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

async function deleteItemWithConfirm(uuid) {
  if (!leanfs.isExist(uuid)) return;
  if (uuid === leanfs.getRoot()) return;

  const name = leanfs.getName(uuid);
  const isFolder = leanfs.isDir(uuid);
  const childCount = isFolder ? (leanfs.getAllChildren(uuid)?.length || 0) : 0;

  let message;

  if (isFolder) {
    message = childCount > 0
      ? `Delete folder "${name}" and its ${childCount} items?`
      : `Delete folder "${name}"?`;
  } else {
    message = `Delete file "${name}"?`;
  }

  const ok = window.confirm(message);
  console.log("[DELETE] confirm =", ok, "uuid =", uuid);

  if (!ok) return;

  await deleteItemById(uuid);
}

function pickNextTreeItem(uuid) {
  // Prefer parent folder
  const parent = leanfs.getParent(uuid);
  if (parent && parent !== leanfs.getRoot()) {
    return parent;
  }

  // Otherwise scan root children
  const children = leanfs.getAllChildren(leanfs.getRoot());
  let firstFolder = null;

  for (const id of children) {
    if (id === uuid) continue;

    if (leanfs.isFile(id)) {
      return id;
    }

    if (!firstFolder) {
      firstFolder = id;
    }
  }

  return firstFolder || null;
}

async function deleteItemById(uuid) {
  if (!leanfs.isExist(uuid)) return;
  if (uuid === leanfs.getRoot()) return;

  const nextFocus = pickNextTreeItem(uuid);

  if (leanfs.isDir(uuid)) {
    leanfs.deleteDir(uuid);
  } else {
    leanfs.deleteFile(uuid);
  }

  await changeCurrentFileId(nextFocus);

  if (nextFocus) {
    pendingTreeFocusId = nextFocus;

    if (leanfs.isFile(nextFocus)) {
      await openFileInMonaco(nextFocus);
    } else {
      inoEditor.setContentReadOnly(leanfs.readDir(nextFocus));
    }
  } else {
    inoEditor.setContentReadOnly("\\");
  }

  emitChanged([leanfs.getRoot()]);
}

ctxDeleteBtn?.addEventListener("click", async (e) => {
  e.stopPropagation();
  const uuid = ctxTargetId;
  hideCtxMenu();
  await deleteItemWithConfirm(uuid);
});

// Rename ngay khi bấm rename trong context menu
ctxRenameBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const uuid = ctxTargetId;
  hideCtxMenu();

  const ctx = window.__rctItemActions.get(uuid);
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

      onPrimaryAction: async (item) => {
        // console.log("onPrimaryAction:", item.index);
        if (leanfs.isDir(item.index)){ // if folder, show content in editor
          const folderContent = leanfs.readDir(item.index); // in folder structure to console
          // window.currentFileId = item.index;
          await changeCurrentFileId(item.index);
          inoEditor.setContentReadOnly(folderContent);
          return;
        }
        // if file, open in monaco
        pendingTreeFocusId = item.index;
        await openFileInMonaco(item.index);
      },

      onRenameItem: async (item, name) => {
        if (!item) return;
        await renameFileId(item.index, name);
      },

      // onDrop: async (itemsDragged, target) => {
      //   await handleDrop(itemsDragged, target);
      // },

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
      rootItem: leanfs.getRoot(),
      treeLabel: "Files",
    })
  )
);

// Initial focus file
pendingTreeFocusId = initialOpenId;
if (initialOpenId) {
  await openFileInMonaco(initialOpenId);
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

function NameEnsureInoExtension(itemUUID) {

  if(!leanfs.isExist(itemUUID)) return null;

  let currentName = String(leanfs.getName(itemUUID));

  // nếu đã có .ino thì giữ nguyên
  if (currentName.toLowerCase().endsWith(".ino")) return currentName;

  // không có đuôi → tự thêm .ino
  return currentName + ".ino";
}
