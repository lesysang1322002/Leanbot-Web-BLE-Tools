// ========================================================
//  Leanbot BLE Connection Manager
// ========================================================

import { LeanbotBLE } from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/Leanbot-BLE-Test/leanbot_ble.js";
import * as utils from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/Leanbot-BLE-Test/leanbot_utils.js";

// ================== DOM Elements ==================

const btnConnect     = utils.UI("toggleButton");
const btnReconnect   = utils.UI("BtnReconnect");
const lblStatus      = utils.UI("navbarTitle");

// ================== BLE Initialization ==================

const leanbot = new LeanbotBLE();

// --- Sự kiện click nút ---
btnConnect.onclick   = () => handleToggleConnection();
btnReconnect.onclick = () => leanbot.Reconnect();

// --- Gán callback BLE ---
leanbot.OnConnect    = () => handleConnected();
leanbot.OnDisconnect = () => handleDisconnected();

// ================== FUNCTIONS ==================

/**
 * Xử lý khi người dùng nhấn nút Connect / Rescan
 */
async function handleToggleConnection() {
  if (leanbot.IsConnected()) {
    lblStatus.innerText = "Rescanning...";
    await leanbot.Rescan();
  } else {
    lblStatus.innerText = "Connecting...";
    await leanbot.Connect();
  }
}

/**
 * Callback khi kết nối BLE thành công
 */
function handleConnected() {
  btnConnect.innerText = "Rescan";
  lblStatus.innerText  = "Connected to " + leanbot.getLeanbotID();
  resetReconnectButtonUI();
}

/**
 * Callback khi BLE ngắt kết nối
 */
function handleDisconnected() {
  btnConnect.innerText = "Connect to Leanbot...";
  lblStatus.innerText  = "No Leanbot connected";
  setTimeout(() => enableReconnectButton(), 2000);
}

/**
 * Kích hoạt lại nút Reconnect khi mất kết nối
 */
function enableReconnectButton() {
  btnReconnect.textContent = "Reconnect " + leanbot.getLeanbotID();
  btnReconnect.style.backgroundColor = "#4CAF50";
}

/**
 * Đặt lại giao diện nút Reconnect khi kết nối mới
 */
function resetReconnectButtonUI() {
  btnReconnect.textContent = "Reconnect";
  btnReconnect.style.backgroundColor = "#6e7173";
}

// ========================================================
//  Leanbot BLE Serial Monitor Functions
// ========================================================

// ================== DOM Elements ==================

const textArea          = utils.UI("terminalTextArea");
const checkboxTimestamp = utils.UI("checkboxTimestamp");

// ================== BLE Serial Monitor Initialization ==================

console.log("Leanbot instance:", leanbot);


// leanbot.Serial.OnMessage(LeanbotBLE.CHAR_UUID, msg => utils.log("Leanbot → " + msg));

let logBuffer       = "";
let lastTimestamp   = null;
let nextIsNewline   = false;
let isFromWeb       = false;

function showTerminalMessage(text) {
  // Goal: Replace the Leanbot initialization message sequence
  // "\nAT+NAME\nLB999999\n" with "\n>>> Leanbot ready >>>\n"
  if (text == "AT+NAME\n") return;

  if (text == "LB999999\n") {
    // Add "\n" before last line (works with TimestampPrefix too)
    let lines = textArea.value.split('\n');
    lines[lines.length - 1] = "\n" + lines[lines.length - 1];
    textArea.value = lines.join('\n');

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
  if (!isFromWeb && lastTimestamp) {
    gap = (now - lastTimestamp) / 1000;
    // console.log("Gap:", gap.toFixed(3), "seconds");
  }
  if (!isFromWeb) lastTimestamp = now;

  if (checkboxTimestamp.checked) {
    const hours        = String(now.getHours()).padStart(2, '0');
    const minutes      = String(now.getMinutes()).padStart(2, '0');
    const seconds      = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const gapStr = !isFromWeb ? `(+${gap.toFixed(3)})` : "        ";
    const prefix = `${hours}:${minutes}:${seconds}.${milliseconds} ${gapStr} -> `;
    // text = text.replace(/\n/g, '\n' + prefix);

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

  if (isFromWeb)  isFromWeb = false;

  logBuffer += text;
}
