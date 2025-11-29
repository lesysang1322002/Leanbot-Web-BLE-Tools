// main.js

// Import LeanbotBLE SDK
import { LeanbotBLE } from "./leanbot_ble.js";

const params = new URLSearchParams(window.location.search);
window.BLE_MaxLength = parseInt(params.get("BLE_MaxLength"));
window.BLE_Interval  = parseInt(params.get("BLE_Interval"));

console.log(`BLE_MaxLength = ${window.BLE_MaxLength}`);
console.log(`BLE_Interval = ${window.BLE_Interval}`);

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
  restoreFullSerialLog();

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
  // const lines = serialLog.value.split("\n");
  // if (lines.length <= 30) return;

  // if (fullSerialBackup === null) fullSerialBackup = serialLog.value;

  // const last30 = lines.slice(-30);
  // serialLog.value = last30.join("\n");
}

function restoreFullSerialLog() {
  // if (fullSerialBackup !== null) {
  //   serialLog.value = fullSerialBackup;
  //   fullSerialBackup = null;
  // }
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

let loadedHexContent = ""; // lưu nội dung file HEX đã đọc

btnCode.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.querySelectorAll(".fileOption").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    const fileUrl = e.target.getAttribute("data-file");
    const fileName = fileUrl.split("/").pop();

    fileNameLabel.textContent = fileName;
    modal.classList.add("hidden");

    console.log(`Fetching HEX file from GitHub...`);
    console.log(`URL: ${fileUrl}`);

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.leanbotStatus}`);
      const text = await res.text();
      loadedHexContent = text;

      console.log(`Loaded HEX file: ${fileName}`);
    } catch (err) {
      console.log(`Failed to fetch HEX file: ${err}`);
      alert("Error loading file. Please check your internet or URL.");
    }
  });
});

// =================== Button Load HEX =================== //
const btnLoadHex = document.getElementById("btnLoadHex");
const fileInput  = document.getElementById("hexFileInput");

btnLoadHex.addEventListener("click", () => {
  fileInput.click();
  loadHexFile();
});

async function loadHexFile() {
  return new Promise((resolve) => {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return resolve(null);

      fileNameLabel.textContent = file.name;
      const text = await file.text();
      loadedHexContent = text;
      resolve(text);
    }, { once: true });
  });
}

// =================== Button Upload =================== //
const btnUpload = document.getElementById("btnUpload");

btnUpload.addEventListener("click", async () => {
  if (!loadedHexContent) {
    fileInput.click();
    loadedHexContent = await loadHexFile();
    if (!loadedHexContent) {
      alert("No HEX file loaded!");
      return;
    }
  }

  const result = await leanbot.reconnect();
  if (!result.success) {
    alert("Please connect to Leanbot first!");
    return;
  }
  
  trimSerialLogTo30();
  uiUploadDialogOpen();

  compileStart = performance.now();
  UploaderTitleCompile.className = "yellow";
  await SimulateCompiler();
  UploaderTitleCompile.className = "green";

  uploadStart = performance.now();
  UploaderTitleUpload.className = "yellow";
  await leanbot.Uploader.upload(loadedHexContent); // Upload the HEX file
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
  const total = 3;
  for (let i = 1; i <= total; i++) {
    await new Promise(r => setTimeout(r, 100));
    uiUpdateTime(compileStart, UploaderTimeCompile);
    uiUpdateProgress(UploaderCompile, i, total);
  }
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
  restoreFullSerialLog();
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
  restoreFullSerialLog();
  UploaderBtnClose.innerText = "Close";
  UploaderTitleUpload.className = "red";
};
// End of main.js