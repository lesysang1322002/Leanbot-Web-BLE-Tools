// main.js
/* ============================================================
 *  URL PARAMETERS
 *  - ?BLE_MaxLength=...&BLE_Interval=...&HASH=...
 * ============================================================ */
const params = new URLSearchParams(window.location.search);
window.BLE_MaxLength = parseInt(params.get("BLE_MaxLength"));
window.BLE_Interval  = parseInt(params.get("BLE_Interval"));
window.HASH          = parseInt(params.get("HASH"));
window.SERVER        = params.get("SERVER") || "ide-server-qa.leanbot.space";
window.MODE          = params.get("MODE");

if (window.MODE === "xyz123") {
  window.SERVER = "";
  console.log("[TEST MODE] Using empty SERVER");
}

console.log(`BLE_MaxLength = ${window.BLE_MaxLength}`);
console.log(`BLE_Interval = ${window.BLE_Interval}`);
console.log(`HASH = ${window.HASH}`);
console.log(`SERVER = ${window.SERVER}`);

/* ============================================================
 *  IMPORTS & INIT
 * ============================================================ */
import { LeanbotBLE } from "./leanbot_ble.js";

// Instances
const leanbot         = new LeanbotBLE();

// ================== Leanbot Connection =================== //
const leanbotStatus = document.getElementById("leanbotStatus");
const btnConnect    = document.getElementById("btnConnect");
const btnReconnect  = document.getElementById("btnReconnect");

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
  leanbotStatus.style.display = "inline-block";
  leanbotStatus.textContent   = getLeanbotIDWithoutBLE();
  leanbotStatus.style.color   = "green";
  btnReconnect.style.display  = "none";
}

leanbot.onDisconnect = () => {
  leanbotStatus.style.display = "none";
  btnReconnect.style.display  = "inline-block";
  btnReconnect.textContent    = "RECONNECT " + getLeanbotIDWithoutBLE();
};

btnConnect.onclick   = async () => connectLeanbot();
btnReconnect.onclick = async () => reconnectLeanbot();

async function connectLeanbot() {
  console.log("Scanning for Leanbot...");
  leanbot.disconnect(); // Ngắt kết nối nếu đang kết nối
  const result = await leanbot.connect();
  console.log("Connect result:", result.message);
}

async function reconnectLeanbot() {
  console.log("Reconnecting to Leanbot...");
  const result = await leanbot.reconnect();
  console.log("Reconnect result:", result.message);
}

// =================== Serial Monitor =================== //
const serialLog           = document.getElementById("serialLog");
const checkboxAutoScroll  = document.getElementById("autoScroll");
const checkboxTimestamp   = document.getElementById("showTimestamp");
const btnClear            = document.getElementById("btnClear");
const btnCopy             = document.getElementById("btnCopy");

btnClear.onclick = () => clearSerialLog();
btnCopy.onclick  = () => copySerialLog();

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

// Giới hạn log chỉ còn 30 dòng gần nhất khi upload và khôi phục sau khi upload xong
let fullSerialBackup = null;

function trimSerialLogTo30() {
  const lines = serialLog.value.split("\n");
  if (lines.length <= 30) return;

  if (fullSerialBackup === null) fullSerialBackup = serialLog.value;

  const last30 = lines.slice(-30);
  serialLog.value = last30.join("\n");
}

function restoreFullSerialLog() {
  if (fullSerialBackup === null) return;

  serialLog.value = fullSerialBackup;
  fullSerialBackup = null;
}

// ================== Send Command ==================
const inputCommand    = document.getElementById("serialInput");
const btnSend         = document.getElementById("btnSend");
const checkboxNewline = document.getElementById("addNewline");

btnSend.onclick = () => send();

async function send() {
  const newline = checkboxNewline.checked ? "\n" : "";
  await leanbot.Serial.send(inputCommand.value + newline);
  inputCommand.value = "";
}

// =================== FILE SELECTION MODAL =================== //
const modal          = document.getElementById("fileModal");
const closeModal     = document.getElementById("closeModal");
const fileNameLabel  = document.getElementById("fileName");

let fileLoaded = ""; // lưu nội dung file đã đọc

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});

// Load file từ URL và trả về { fileName, ext, text }
async function loadFromUrl(fileUrl) {
  const fileName = (fileUrl.split("/").pop() || "unknown").split("?")[0].split("#")[0];
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  const res = await fetch(fileUrl, { cache: "no-store" }); // tránh cache nếu có
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();

  return { fileName, ext, text };
}

document.querySelectorAll(".fileOption").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    const fileUrl = btn.dataset.file; // ổn định hơn e.target.getAttribute(...)
    if (!fileUrl) return;

    modal.classList.add("hidden");

    console.log(`[FETCH] URL: ${fileUrl}`);

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.leanbotStatus}`);
      const text = await res.text();
      window.arduinoEditor?.setValue(text); // Hiển thị nội dung file lên editor

      console.log(`Loaded HEX file: ${fileName}`);
    } catch (err) {
      console.log(`Failed to fetch HEX file: ${err}`);
      alert("Error loading file. Please check your internet or URL.");
    }
  });
});


// =================== Button Load File =================== //
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

      fileNameLabel.textContent = fileName; // Cập nhật tên file trên UI

      resolve({ fileName, ext, text }); // Trả về đối tượng file đã load
    };
  });
}

// =================== Button Compile =================== //
const btnCompile = document.getElementById("btnCompile");
const UploaderCompileLog = document.getElementById("compileLog");
const ProgramTab = document.getElementById("programGrid");

btnCompile.addEventListener("click", async () => {
  await doCompile();
});

async function doCompile() {
  const sourceCode = getSourceCode();
  if (!sourceCode || sourceCode.trim() === "") {
    alert("No code to compile!");
    return null;
  }

  compileStart = performance.now();
  ProgramTab.classList.add("hide-upload");
  uiSetTab("program");
  uiResetCompile();
  return await leanbot.Compiler.compile(sourceCode, window.SERVER);
}

leanbot.Compiler.onCompileSucess = (compileMessage) => {
  UploaderCompileLog.value = compileMessage;
  UploaderCompileTitle.className = "green";
  if (!isCompileAndUpload) return;
  uploadStart = performance.now(); // reset upload start time
};

leanbot.Compiler.onCompileError = (compileMessage) => {
  UploaderCompileLog.value = compileMessage;
  UploaderCompileProg.className = "red";
  UploaderCompileTitle.className = "red";
  if (!isCompileAndUpload) return;
  ProgramTab.classList.add("hide-upload"); // Ẩn upload khi compile lỗi
};

leanbot.Compiler.onCompileProgress = (elapsedTime, estimatedTotal) => {
  uiUpdateTime(compileStart, UploaderTimeCompile);
  uiUpdateProgress(UploaderCompileProg, elapsedTime, estimatedTotal); 
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

  const sourceCode = getSourceCode();
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
  await leanbot.compileAndUpload(sourceCode, window.SERVER);
});

// =================== Upload DOM Elements =================== //
const UploaderTitleUpload  = document.getElementById("uploadTitle");
const UploaderCompileTitle = document.getElementById("compileTitle");

const UploaderCompileProg  = document.getElementById("progCompile");
const UploaderTransfer     = document.getElementById("progTransfer");
const UploaderWrite        = document.getElementById("progWrite");
const UploaderVerify       = document.getElementById("progVerify");
const UploaderLogUpload          = document.getElementById("uploadLog");

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

async function SimulateCompiler() {
  UploaderCompileTitle.className = "yellow";
  const total = 3;
  for (let i = 1; i <= total; i++) {
    await new Promise(r => setTimeout(r, 100));
    uiUpdateTime(compileStart, UploaderTimeCompile);
    uiUpdateProgress(UploaderCompileProg, i, total);
  }
  UploaderCompileTitle.className = "green";
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
leanbot.Uploader.onMessage = (msg) => {
  uiUpdateTime(uploadStart, UploaderTimeUpload);

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
  UploaderTitleUpload.className = "green";
};

leanbot.Uploader.onError = (err) => {
  UploaderTitleUpload.className = "red";
};

// Lấy nội dung code từ Monaco Editor
function getSourceCode() {
  return window.arduinoEditor?.getValue() || "";
}

// =================== SERIAL =================== //
const workspace     = document.getElementById("workspace");
const serialSection = document.getElementById("serialSection");
const btnSerial     = document.getElementById("btnSerial");

const programPanel  = document.getElementById("programPanel");
const monitorPanel  = document.getElementById("monitorPanel");
const tabs          = document.querySelectorAll("#serialTabs .serial-tab");
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

// =================== Monaco Editor for Arduino =================== //

require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" } });

    require(["vs/editor/editor.main"], function () {
      // Arduino keywords thêm vào highlight
      monaco.languages.register({ id: "arduino" });
      monaco.languages.setMonarchTokensProvider("arduino", {
        tokenizer: {
          root: [
            // multi-line comment start /* ... */
            [/\/\*/, "comment", "@comment"],

            // single-line comment
            [/\/\/.*$/, "comment"],

            // strings
            [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

            // keywords/types
            [/\b(void|int|char|float|double|bool|byte|long|short|unsigned|signed|const)\b/, "keyword"],
            [/\b(setup|loop|Serial|pinMode|digitalWrite|digitalRead|analogRead|analogWrite|delay|millis|micros)\b/, "type.identifier"],
            [/\b(begin|println|print|available|read|write)\b/, "identifier"],

            // numbers
            [/\b\d+(\.\d+)?\b/, "number"],
          ],

          // comment state: ăn mọi thứ đến khi gặp */
          comment: [
            [/[^\*]+/, "comment"],
            [/\*\//, "comment", "@pop"],
            [/\*/, "comment"],
          ],

          string: [
            [/[^\\"]+/, "string"],
            [/\\./, "string.escape"],
            [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
          ],
        },
      });

      // Light theme cho Arduino
      monaco.editor.defineTheme("arduinoLight", {
        base: "vs",          // theme sáng
        inherit: true,
        rules: [
          { token: "comment", foreground: "008000" },      // xanh lá comment
          { token: "keyword", foreground: "0000FF" },      // xanh dương
          { token: "number", foreground: "098658" },       // xanh lá số
          { token: "string", foreground: "A31515" },       // đỏ nâu
          { token: "type.identifier", foreground: "267F99" }, // xanh da trời
          { token: "identifier", foreground: "001080" },   // xanh đậm
        ],
        colors: {
          "editor.background": "#FFFFFF", // trắng
          "editorLineNumber.foreground": "#999999", // xám line number
          "editorLineNumber.activeForeground": "#000000", // đen line number active
          "editorCursor.foreground": "#000000", // đen con trỏ
          "editor.selectionBackground": "#ADD6FF", // xanh dương chọn
          "editor.inactiveSelectionBackground": "#E5EBF1", // xám nhạt chọn
        }
      });

      // set theme
      monaco.editor.setTheme("arduinoLight");

      // Create editor
      window.arduinoEditor = monaco.editor.create(document.getElementById("codeEditor"), {
      value: '',
      language: "arduino",
      automaticLayout: true,   
      lineNumbers: "on",      
      fontSize: 13,           
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "off",
      minimap: { enabled: true },
      smoothScrolling: true,
      cursorSmoothCaretAnimation: "on",
      bracketPairColorization: { enabled: true },
      });

      window.__isMonacoReady = true;

      if (window.__pendingOpenFileId) {
        const id = window.__pendingOpenFileId;
        window.__pendingOpenFileId = null;
        openFileInMonaco(id);
      }


      window.arduinoEditor.updateOptions({
        scrollBeyondLastLine: false,       // Dòng cuối luôn nằm sát đáy editor

        quickSuggestions: true,           // Tự động hiện gợi ý khi đang gõ
        suggestOnTriggerCharacters: true, // Gợi ý khi gõ các ký tự kích hoạt (., (, <)
        tabCompletion: "on",              // Tab để chấp nhận gợi ý
        acceptSuggestionOnEnter: "on",    // Enter để chấp nhận gợi 
        snippetSuggestions: "top",        // Ưu tiên gợi ý snippet lên đầu
        wordBasedSuggestions: "off",      // Tắt gợi ý dựa trên từ trong văn bản
      });

      const { languages } = monaco;

      const SUGGESTIONS = [
        {
          label: "setup",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "void setup() {\n\t$0\n}\n",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Arduino setup()",
        },
        {
          label: "loop",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "void loop() {\n\t$0\n}\n",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Arduino loop()",
        },
        {
          label: "Serial.println",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "Serial.println(${1:\"text\"});",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Print line",
        },
        {
          label: "delay",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "delay(${1:500});",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Delay ms",
        },

        // Leanbot (ví dụ)
        {
          label: "Leanbot.begin",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "Leanbot.begin();",
          detail: "Init Leanbot",
        },
        {
          label: "LbMission.begin",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "LbMission.begin(${1:TB1A} + ${2:TB1B});",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Start mission",
        },
      ];

      languages.registerCompletionItemProvider("arduino", { // cung cấp gợi ý
        triggerCharacters: [".", "(", "<"],                 // ký tự kích hoạt gợi ý        
        provideCompletionItems: (model, position) => {
          // Lấy word hiện tại để filter gợi ý theo cái user đang gõ
          const word = model.getWordUntilPosition(position); 
          const range = new monaco.Range(
            position.lineNumber, 
            word.startColumn,
            position.lineNumber,
            word.endColumn
          );

          return {
            suggestions: SUGGESTIONS.map((s) => ({ ...s, range })),
          };
        },
      });
    });


//==================== FILE TREE =================== //
// trạng thái Monaco
window.__isMonacoReady ||= false;
window.__pendingOpenFileId = window.__pendingOpenFileId ?? null;

// Tạo dữ liệu tree
const items = {
  root:      { index: "root",     isFolder: true,  children: ["src"],      data: "Workspace" },
  src:       { index: "src",      isFolder: true,  children: ["main_ino"], data: "src" },
  main_ino:  { index: "main_ino", isFolder: false, children: [],           data: "BasicLeanbotMotion.ino" },
};

// nội dung file, key theo id file (item.index)
const fileContents = {
  main_ino:
`/*Basic Leanbot Motion

  Wait for TB1A+TB1B touch signal, then go straight for 100 mm, then stop.

  More Leanbot examples at  https://git.pythaverse.space/leanbot/Examples
*/


#include <Leanbot.h>                    // use Leanbot library


void setup() {
  Leanbot.begin();                      // initialize Leanbot
}


void loop() {
  LbMission.begin( TB1A + TB1B );       // start mission when both TB1A and TB1B touched

  LbMotion.runLR( +1000, +1000 );       // go straight forward with speed 1000 steps/s
  LbMotion.waitDistanceMm( 100 );       // for 100 mm distance

  LbMission.end();                      // stop, finish mission
}`,
};

// track focus, selection để tạo file, folder, move đúng vị trí
let lastFocusedId = "main_ino";
let lastSelectedIds = ["main_ino"];

// gắn parent cho mỗi node, để move nhanh
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
  const out = [];
  let p = items[id]?.parent;

  while (p && p !== "root") {
    out.unshift(p);
    p = items[p]?.parent;
  }
  return out;
}

const mount = document.getElementById("fileTreeMount");
const { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } = window.ReactComplexTree;

const dataProvider = new StaticTreeDataProvider(items, (item, data) => ({ ...item, data }));
const emitChanged = (ids) => dataProvider.onDidChangeTreeDataEmitter.emit(ids);

// Autosave nội dung từ Monaco về fileContents
let saveTimer = null;

function hookMonacoAutosaveOnce() {
  if (window.__monacoAutosaveHooked) return;
  if (!window.arduinoEditor) return;

  window.__monacoAutosaveHooked = true;

  window.arduinoEditor.onDidChangeModelContent(() => {
    const id = window.currentFileId;
    if (!id) return;

    fileContents[id] = window.arduinoEditor.getValue();

    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWorkspaceToLocalStorage, 500); // save after 500ms of inactivity
  });
}

function openFileInMonaco(fileId) {
  if (!window.__isMonacoReady || !window.arduinoEditor) {
    window.__pendingOpenFileId = fileId;
    return;
  }

  hookMonacoAutosaveOnce();

  const content = fileContents[fileId] ?? "";
  window.currentFileId = fileId;
  window.arduinoEditor.setValue(content);

  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWorkspaceToLocalStorage, 200);
}

// id generator
function slugifyId(name) {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || "item";
}

function uniqueId(base) {
  let id = base;
  let i = 1;
  while (items[id]) id = base + "_" + i++;
  return id;
}

// Lấy folder đích để thêm file, folder
function getTargetFolderId() {
  const focus = items[lastFocusedId] ? lastFocusedId : "root";
  if (items[focus]?.isFolder) return focus;

  const parent = items[focus]?.parent;
  if (parent && items[parent]?.isFolder) return parent;

  return "root";
}

// Nhận file local đã đọc từ loadFile() và tạo file mới trong tree
window.importLocalFileToTree = (loaded) => {
  if (!loaded) return;

  const fileName = String(loaded.fileName || "New_File.ino");
  const text = String(loaded.text ?? "");

  const parentId = getTargetFolderId();

  // id theo tên file, chống trùng
  const id = uniqueId(slugifyId(fileName));

  items[id] = {
    index: id,
    isFolder: false,
    children: [],
    data: fileName,
    parent: parentId
  };

  items[parentId].children ||= [];
  items[parentId].children.push(id);

  fileContents[id] = text;

  emitChanged([parentId, id]);

  pendingTreeFocusId = id;
  openFileInMonaco(id);
  saveWorkspaceToLocalStorage();
};

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

// Thêm file, folder
function createItem(isFolder, defaultName) {
  const parentId = getTargetFolderId();
  const name = defaultName;

  const id = uniqueId(slugifyId(name));

  items[id] = { index: id, isFolder, children: [], data: name, parent: parentId };
  items[parentId].children ||= [];
  items[parentId].children.push(id);

  if (!isFolder) fileContents[id] = "";

  emitChanged([parentId, id]);

  if (!isFolder) {
    pendingTreeFocusId = id;   // để tree highlight đúng item mới
    openFileInMonaco(id);      // mở luôn trong Monaco
  } else {
    pendingTreeFocusId = id;   // tạo folder xong cũng focus để dễ thao tác tiếp
  }
  saveWorkspaceToLocalStorage();
}

document.getElementById("btnNewFile")?.addEventListener("click", () => createItem(false, "New_File.ino"));
document.getElementById("btnNewFolder")?.addEventListener("click", () => createItem(true, "New_Folder"));

// rename file bằng F2
function renameFileId(oldId, newDisplayName) {
  const oldItem = items[oldId];
  if (!oldItem) return;

  // folder: chỉ đổi data
  if (oldItem.isFolder) {
    oldItem.data = newDisplayName;
    emitChanged([oldId]);
    pendingTreeFocusId = oldId;
    saveWorkspaceToLocalStorage();
    return;
  }

  const newId = uniqueId(slugifyId(newDisplayName));
  const parentId = oldItem.parent || "root";

  items[newId] = { ...oldItem, index: newId, data: newDisplayName, parent: parentId };

  const arr = items[parentId]?.children || [];
  const pos = arr.indexOf(oldId);
  if (pos >= 0) arr[pos] = newId;

  fileContents[newId] = fileContents[oldId] ?? "";
  delete fileContents[oldId];

  if (window.currentFileId === oldId) window.currentFileId = newId;
  if (lastFocusedId === oldId) lastFocusedId = newId;

  delete items[oldId];

  emitChanged([parentId, oldId, newId]);

  pendingTreeFocusId = newId;
  openFileInMonaco(newId);
  saveWorkspaceToLocalStorage();
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
    if (!it?.isFolder || !Array.isArray(it.children)) continue;

    const before = it.children.length;
    it.children = it.children.filter((x) => x !== childId);
    if (it.children.length !== before) removedParent = removedParent || id;
  }

  return removedParent;
}


function insertIntoFolder(folderId, childId, index) {
  const f = items[folderId];
  if (!f || !f.isFolder) return;

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

    destFolderId = targetItem.isFolder ? targetId : (targetItem.parent || "root");
    insertIndex = Number.isFinite(target.childIndex)
      ? target.childIndex
      : (items[destFolderId]?.children?.length ?? 0);
  }

  // Chặn kéo folder vào chính con của nó
  for (const id of draggedIds) {
    if (id === destFolderId) return;
    if (items[id]?.isFolder && isDescendantOf(destFolderId, id)) return;
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
  saveWorkspaceToLocalStorage();
}

// ==================== Lưu / Load workspace từ LocalStorage ==================== //
const LS_KEY = "leanbot_workspace";

function saveWorkspaceToLocalStorage() {
  const data = {
    items,                              // tree structure
    fileContents,                       // nội dung file
    currentFileId: window.currentFileId // file đang mở trong Monaco
  };

  localStorage.setItem(LS_KEY, JSON.stringify(data));
  console.log("[LS] Workspace saved");
}

function loadWorkspaceFromLocalStorage() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    Object.keys(items).forEach(k => delete items[k]);
    Object.assign(items, data.items || {});

    Object.keys(fileContents).forEach(k => delete fileContents[k]);
    Object.assign(fileContents, data.fileContents || {});

    window.currentFileId = data.currentFileId || "main_ino";

    rebuildParents();
    console.log("[LS] Workspace restored");
  } catch (e) {
    console.log("[LS] Restore failed", e);
  }
}

loadWorkspaceFromLocalStorage();
window.__pendingOpenFileId = window.currentFileId || "main_ino";

// initial viewState
const initialOpenId = (window.currentFileId && items[window.currentFileId])
  ? window.currentFileId
  : "main_ino";

const ancestorFolders = getAncestorFolders(initialOpenId);

const viewState = {
  tree: {
    expandedItems: ["root", ...ancestorFolders],
    selectedItems: [initialOpenId],
    focusedItem: initialOpenId,
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

  if (it.isFolder && Array.isArray(it.children)) {
    for (const cid of it.children) deleteSubtree(cid);
  } else {
    delete fileContents[id];
  }

  delete items[id];
}

function deleteItemById(id) {
  if (!id || !items[id] || id === "root") return;

  // gỡ id khỏi mọi folder trước, tránh lệch parent sau drag
  const removedParent = removeFromParent(id) || (items[id].parent || "root");

  deleteSubtree(id);

  // focus lại
  pendingTreeFocusId = items[removedParent] ? removedParent : "root";

  // nếu đang mở file bị xóa, mở lại main_ino
  if (window.currentFileId && !items[window.currentFileId]) {
    window.currentFileId = "main_ino";
    if (items.main_ino) openFileInMonaco("main_ino");
  }

  if (!items[lastFocusedId]) lastFocusedId = pendingTreeFocusId;
  if (lastSelectedIds.some((x) => !items[x])) lastSelectedIds = [lastFocusedId];

  rebuildParents();
  emitChanged([removedParent, "root"]);
  saveWorkspaceToLocalStorage();
}


ctxDeleteBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const id = ctxTargetId;
  hideCtxMenu();
  deleteItemById(id);
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

// ==================== RENDER FILE TREE ==================== //
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

      onFocusItem: (item) => {
        if (!item) return;
        lastFocusedId = item.index;
      },

      onSelectItems: (ids) => {
        lastSelectedIds = Array.isArray(ids) ? ids.slice() : [];
        if (lastSelectedIds.length > 0) lastFocusedId = lastSelectedIds[lastSelectedIds.length - 1];
      },

      onPrimaryAction: (item) => {
        if (!item || item.isFolder) return;

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

        const Tag = context.isRenaming ? "div" : "button";

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

        return window.React.createElement(
          "li",
          { ...context.itemContainerWithChildrenProps, style: { margin: 0 } },
          window.React.createElement(
            Tag,
            {
              ...context.itemContainerWithoutChildrenProps,
              ...context.interactiveElementProps,
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
            title
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
openFileInMonaco(initialOpenId);

