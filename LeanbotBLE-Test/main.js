// main.js

// Import LeanbotBLE SDK
import { LeanbotBLE } from "./leanbot_ble.js";

const params = new URLSearchParams(window.location.search);
window.BLE_MaxLength = parseInt(params.get("BLE_MaxLength"));
window.BLE_Interval = parseInt(params.get("BLE_Interval"));

console.log(`BLE_MaxLength = ${window.BLE_MaxLength}`);
console.log(`BLE_Interval = ${window.BLE_Interval}`);

// =================== BLE Connection =================== //
const leanbotStatus = document.getElementById("leanbotStatus");
const btnConnect    = document.getElementById("btnConnect");
const btnReconnect  = document.getElementById("btnReconnect");

// Khởi tạo đối tượng LeanbotBLE
const leanbot = new LeanbotBLE();

console.log("Getting Leanbot ID:", leanbot.getLeanbotID());
leanbotStatus.textContent = leanbot.getLeanbotID();

leanbot.onConnect = () => {
  leanbotStatus.textContent = leanbot.getLeanbotID();
  leanbotStatus.style.color = "green";
}

leanbot.onDisconnect = () => {
  leanbotStatus.style.color = "red";
}

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
let nextIsNewline   = true;
let lastTimestamp   = null;

const serialLog           = document.getElementById("serialLog");
const checkboxAutoScroll  = document.getElementById("autoScroll");
const checkboxTimestamp   = document.getElementById("showTimestamp");
const btnClear            = document.getElementById("btnClear");
const btnCopy             = document.getElementById("btnCopy");

leanbot.Serial.onMessage = msg => {
  msg = msg.replace(/\r/g, '');
  showSerialLog(msg);
}

btnClear.onclick = () => clearSerialLog();
btnCopy.onclick  = () => copySerialLog();

let logBuffer = "";

setInterval(() => {
  if (logBuffer) {
    serialLog.value += logBuffer;
    logBuffer = "";

    if (checkboxAutoScroll.checked) serialLog.scrollTop = serialLog.scrollHeight;
  }
}, 20); // update mỗi 20ms

function showSerialLog(text) {
  // Goal: Replace the Leanbot initialization message sequence
  // "\nAT+NAME\nLB999999\n" with "\n>>> Leanbot ready >>>\n"
  if (text == "AT+NAME\n") return;

  if (text == "LB999999\n") {
    // Add "\n" before last line (works with TimestampPrefix too)
    let lines = serialLog.value.split('\n');
    lines[lines.length - 1] = "\n" + lines[lines.length - 1];
    serialLog.value = lines.join('\n');

    logBuffer += ">>> Leanbot ready >>>\n";
    return;
  }
  // ================================================
  if (nextIsNewline) {
    text = '\n' + text;
    nextIsNewline = false;
  }
  if (text.endsWith('\n')) {
    text = text.slice(0, -1); // Skipped "\n", Leanbot initialization message = "AT+NAME\nLB999999\n"
    nextIsNewline = true;
  }

  let now = new Date();
  let gap = 0;

  if (lastTimestamp) gap = (now - lastTimestamp) / 1000;

  if (checkboxTimestamp.checked) {
    const hours        = String(now.getHours()).padStart(2, '0');
    const minutes      = String(now.getMinutes()).padStart(2, '0');
    const seconds      = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const gapStr       = `(+${gap.toFixed(3)})`;

    text = text.split('\n').map((line, idx) => {
      if (idx === 0) {
        // Keep the first line unchanged
        return line;
      } else if (idx === 1) {
        // Second line -> use the actual gapStr
        return `${hours}:${minutes}:${seconds}.${milliseconds} ${gapStr} -> ${line}`;
      } else {
        // From the third line onward -> force gap = 0
        return `${hours}:${minutes}:${seconds}.${milliseconds} (+0.000) -> ${line}`;
      }
    }).join('\n');
  }

  logBuffer += text;
  lastTimestamp = now;
}

function clearSerialLog() {
  serialLog.value = "";
}

function copySerialLog() {
  serialLog.select();
  navigator.clipboard.writeText(serialLog.value)
    .then(()   => console.log("Copied!"))
    .catch(err => console.error("Copy failed:", err));
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

  uploadOpen();
  await leanbot.Uploader.upload(loadedHexContent); // Upload the HEX file
});

// =================== Upload Log =================== //
leanbot.Uploader.onMessage = (msg) => {
  UploaderLog.value += msg + "\n";
  UploaderLog.scrollTop = UploaderLog.scrollHeight;
};

leanbot.Uploader.onTransfer = (progress, totalBlocks) => {
  setBarColor(UploaderTransfer, progress + 1, totalBlocks);
};

leanbot.Uploader.onWrite = (progress, totalBytes) => {
  setBarColor(UploaderWrite, progress, totalBytes);
};

leanbot.Uploader.onVerify = (progress, totalBytes) => {
  setBarColor(UploaderVerify, progress, totalBytes);
};

leanbot.Uploader.onSuccess = () => {
  setTimeout(() => {
    UploaderDialog.classList.add("fade-out");
    setTimeout(() => { UploaderDialog.style.display = "none"; }, 600);
  }, 1000);
};

leanbot.Uploader.onError = (err) => {
  if (err === "Write failed")  return setBarColor(UploaderWrite, 1, 1, true);
  if (err === "Verify failed") return setBarColor(UploaderVerify, 1, 1, true);
};

// =================== Upload DOM Elements =================== //
const UploaderDialog   = document.getElementById("uploadDialog");
const UploaderCompile  = document.getElementById("progCompile");
const UploaderTransfer = document.getElementById("progTransfer");
const UploaderWrite    = document.getElementById("progWrite");
const UploaderVerify   = document.getElementById("progVerify");
const UploaderLog      = document.getElementById("uploadLog");
const UploaderBtnClose = document.getElementById("btnCloseUpload");

// =================== Upload UI Functions =================== //
function uploadOpen() {
  UploaderDialog.style.display = "flex";
  UploaderDialog.classList.remove("fade-out");

  // reset progress bars
  [UploaderCompile, UploaderTransfer, UploaderWrite, UploaderVerify].forEach(b => {
    b.value = 0;
    b.max   = 1;
    b.className = "yellow";
  });

  // reset log
  UploaderLog.value = "";

  // compile: 100%
  setBarColor(UploaderCompile, 1, 1);
}

function setBarColor(bar, value, maxValue, error = false) {
  bar.value = value;
  bar.max   = maxValue;

  if (error) {
    bar.className = "red";
    uploadHasError = true;
  }
  else if (value >= maxValue && maxValue > 0) {
    bar.className = "green";
  }
  else {
    bar.className = "yellow";
  }
}

UploaderBtnClose.onclick = () => {
  UploaderDialog.style.display = "none";
};
// End of main.js


