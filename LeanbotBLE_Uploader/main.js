// main.js

// Import LeanbotBLE SDK
import { LeanbotBLE } from "./leanbot_ble.js";

const params = new URLSearchParams(window.location.search);
window.BLE_MaxLength = parseInt(params.get("BLE_MaxLength"));
window.BLE_Interval  = parseInt(params.get("BLE_Interval"));
window.HASH          = parseInt(params.get("HASH"));

console.log(`BLE_MaxLength = ${window.BLE_MaxLength}`);
console.log(`BLE_Interval = ${window.BLE_Interval}`);
console.log(`HASH = ${window.HASH}`);

localStorage.removeIteam("leanbot_device")

// =================== BLE Connection =================== //
const leanbotStatus = document.getElementById("leanbotStatus");
const btnConnect    = document.getElementById("btnConnect");
const btnReconnect  = document.getElementById("btnReconnect");

// Khởi tạo đối tượng LeanbotBLE
const leanbot = new LeanbotBLE();

function getLeanbotIDWithoutBLE() {
  return leanbot.getLeanbotID().replace(" BLE", "");
}

if (leanbot.getLeanbotID() === "No Leanbot"){
  leanbotStatus.style.display = "inline-block";
  leanbotStatus.textContent   = getLeanbotIDWithoutBLE();
}
else{
  btnReconnect.style.display  = "inline-block";
  btnReconnect.textContent    = "Reconnect " + getLeanbotIDWithoutBLE();
}

leanbot.onConnect = () => {
  leanbotStatus.style.display = "inline-block";
  leanbotStatus.textContent   = getLeanbotIDWithoutBLE();
  leanbotStatus.style.color   = "green";

  btnReconnect.style.display  = "none";
}

leanbot.onDisconnect = () => {
  // restoreFullSerialLog();

  leanbotStatus.style.display = "none";

  btnReconnect.style.display  = "inline-block";
  btnReconnect.textContent    = "Reconnect " + getLeanbotIDWithoutBLE();
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
const btnCode        = document.getElementById("btnCode");
const modal          = document.getElementById("fileModal");
const closeModal     = document.getElementById("closeModal");
const fileNameLabel  = document.getElementById("fileName");

let fileLoaded = ""; // lưu nội dung file đã đọc

btnCode.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

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
      const loaded = await loadFromUrl(fileUrl);

      fileNameLabel.textContent = loaded.fileName;

      // bạn muốn lưu kiểu object để dùng chung với Compiler / Upload
      fileLoaded = loaded; // { fileName, ext, text }

      console.log(`[FETCH] Loaded: ${loaded.fileName} (${loaded.ext}), size=${loaded.text.length}`);
    } catch (err) {
      console.log(`[FETCH] Failed: ${err}`);
      alert("Error loading file. Please check your internet or URL.");
    }
  });
});


// =================== Button Load HEX =================== //
const btnLoadFile = document.getElementById("btnLoadFile");
const fileInput   = document.getElementById("FileInput");

btnLoadFile.addEventListener("click", async () => {
  fileInput.click(); // Mở hộp thoại chọn file
  fileLoaded = await loadFile(); // Đợi người dùng chọn file và load nội dung
  window.arduinoEditor?.setValue(fileLoaded.text); // Hiển thị nội dung file lên editor
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

// =================== Button Upload =================== //
const btnUpload = document.getElementById("btnUpload");

btnUpload.addEventListener("click", async () => {
  // Kết nối Leanbot nếu chưa kết nối
  const result = await leanbot.reconnect();
  if (!result.success) {
    alert("Please connect to Leanbot first!");
    return;
  }
  
  uiUploadDialogOpen();                    // Mở hộp thoại Upload
  compileStart = performance.now();       
  const codeINO = getEditorCode();         // Lấy code từ editor
  if (!codeINO) {
    alert("No code to upload! Please write or load an Leanbot sketch.");
    return;
  }
  const hexText = await Compiler(codeINO); // Biên dịch file INO sang HEX

  uploadStart = performance.now();         
  UploaderTitleUpload.className = "yellow";
  await leanbot.Uploader.upload(hexText);  // Bắt đầu upload HEX lên Leanbot
});

// =================== Upload DOM Elements =================== //
const UploaderDialog       = document.getElementById("uploadDialog");
const UploaderBtnShowLast  = document.getElementById("btnShowLast");

const UploaderTitleUpload  = document.getElementById("uploadTitle");
const UploaderTitleCompile = document.getElementById("compileTitle");

const UploaderCompile      = document.getElementById("progCompile");
const UploaderTransfer     = document.getElementById("progTransfer");
const UploaderWrite        = document.getElementById("progWrite");
const UploaderVerify       = document.getElementById("progVerify");
const UploaderLog          = document.getElementById("uploadLog");

const UploaderAutoClose    = document.getElementById("chkAutoClose");
const UploaderBtnClose     = document.getElementById("btnCloseUpload");

const UploaderTimeCompile  = document.getElementById("compileTime");
const UploaderRSSI         = document.getElementById("uploadRSSI");
const UploaderTimeUpload   = document.getElementById("uploadTime");

UploaderBtnClose.onclick = () => {
  if (UploaderBtnClose.innerText === "Cancel") {
    leanbot.Uploader.cancel();
    UploaderBtnClose.innerText = "Close";
    // restoreFullSerialLog();
  }
  UploaderDialog.style.display = "none";
};

UploaderBtnShowLast.onclick = () => {
  UploaderDialog.classList.remove("fade-out");
  UploaderDialog.style.display = "flex";
};

// Gọi khi nhấn nút Upload và bắt đầu gửi dữ liệu
function uiUploadDialogOpen() {
  UploaderDialog.style.display = "flex";
  UploaderDialog.classList.remove("fade-out");

  // reset progress bars
  [UploaderCompile, UploaderTransfer, UploaderWrite, UploaderVerify].forEach(b => {
    b.value = 0;
    b.max   = 1;
    b.className = "yellow";
  });

  // reset 
  UploaderLog.value = "";
  UploaderBtnClose.innerText      = "Cancel";
  UploaderTimeCompile.textContent = "0.0 sec";
  UploaderTimeUpload.textContent  = "0.0 sec";
  UploaderTitleUpload.textContent = "Upload to " + getLeanbotIDWithoutBLE();
  UploaderRSSI.textContent        = "0 dBm";
  UploaderTitleUpload.className   = "black";
  UploaderTitleCompile.className  = "black";
}

async function SimulateCompiler() {
  UploaderTitleCompile.className = "yellow";
  const total = 3;
  for (let i = 1; i <= total; i++) {
    await new Promise(r => setTimeout(r, 100));
    uiUpdateTime(compileStart, UploaderTimeCompile);
    uiUpdateProgress(UploaderCompile, i, total);
  }
  UploaderTitleCompile.className = "green";
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

  UploaderLog.value += "\n" + msg;
  UploaderLog.scrollTop = UploaderLog.scrollHeight;
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
  // restoreFullSerialLog();
  UploaderTitleUpload.className = "green";
  UploaderBtnClose.innerText = "Close";
  if (UploaderAutoClose.checked) {
    setTimeout(() => {
      UploaderDialog.classList.add("fade-out");
      setTimeout(() => { UploaderDialog.style.display = "none"; }, 600);
    }, 1000);
  }
};

leanbot.Uploader.onError = (err) => {
  // restoreFullSerialLog();
  UploaderBtnClose.innerText = "Close";
  UploaderTitleUpload.className = "red";
};

// =================== INO Compiler =================== //
async function Compiler(loaded) {
  // UI: màu vàng, tiến trình 1/2
  UploaderTitleCompile.className = "yellow";
  uiUpdateProgress(UploaderCompile, 1, 2);
  // Bỏ đuôi .ino để lấy tên sketch
  const sketchName = loaded.fileName.replace(/\.ino$/i, "");
  // Tạo payload để gửi lên server compiler
  const payload = {
    fqbn: "arduino:avr:uno",
    files: [
      {
        content: loaded.text,
        name: `${sketchName}/${sketchName}.ino`,
      },
    ],
    flags: { verbose: false, preferLocal: false },
    libs: [],
  };

  // Gọi server compile, nhận về { hex (base64), log }
  const out = await compileIno(payload);
  // Append log compile vào ô log UI
  UploaderLog.value += "\n" + out.log;
  uiUpdateProgress(UploaderCompile, 2, 2);
  uiUpdateTime(compileStart, UploaderTimeCompile);

  // Nếu không có hex trả về => compile fail
  if (!out.hex || out.hex.trim() === "") {
    // UI: cập nhật time + báo đỏ
    UploaderTitleCompile.className = "red";
    UploaderCompile.className = "red";
    throw new Error("Compile failed – no hex returned");
  }

  // UI: màu xanh khi compile thành công
  UploaderTitleCompile.className = "green";
  // Decode base64 hex sang text và trả về
  return base64ToText(out.hex);
}

// Gọi API compile: gửi payload JSON lên server và nhận kết quả compile
async function compileIno(payload) {
  const res = await fetch("https://ide-server-qa.leanbot.space/v3/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Compile HTTP ${res.status}`);
  return await res.json(); // { hex: base64, log: "..." }
}

// Decode base64 string -> UTF-8 text
function base64ToText(b64) {
  // atob: base64 -> "binary string" (mỗi ký tự 0..255)
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // Chuyển bytes -> string UTF-8
  return new TextDecoder("utf-8").decode(bytes);
}

// =================== Get Code from Editor =================== //
// Lấy code từ editor và trả về object phù hợp với hàm Compiler đã viết
function getEditorCode() {
  const text = getCodeText();
  if (!text || !text.trim()) return null;

  return {
    fileName: "sketch.ino",
    ext: "ino",
    text: text,
  };
}

// Lấy nội dung code từ Monaco Editor
function getCodeText() {
  return window.arduinoEditor?.getValue() || "";
}

// =================== Serial Monitor Toggle =================== //
const workspace = document.getElementById("workspace");
const btnSerial = document.getElementById("btnSerial");
const serialSection = document.getElementById("serialSection");

btnSerial.addEventListener("click", () => {
  const open = workspace.classList.toggle("serial-open");

  // sync trạng thái ẩn/hiện theo class
  serialSection.classList.toggle("is-hidden", !open);

  // (tuỳ chọn) đổi style nút để biết đang bật
  btnSerial.classList.toggle("active", open);
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
value: `/*Basic Leanbot Motion

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