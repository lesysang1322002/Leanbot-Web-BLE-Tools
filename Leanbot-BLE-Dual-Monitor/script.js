// ================== BLE Config ==================
const bleService        = '0000ffe0-0000-1000-8000-00805f9b34fb';
const bleCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';

function UI(id) {
  return document.getElementById(id);
}

function isWebBluetoothEnabled() {
    if (!navigator.bluetooth) {
        console.log('Web Bluetooth API is not available in this browser!');
        return false;
    }
    return true;
}

function str2ab(str) {
    return new TextEncoder().encode(str).buffer;
}

// ================== Dùng chung ==================
const checkboxAutoScroll  = UI("CheckAutoScroll");
const checkboxTimestamp   = UI("CheckTimestamp");

function clearTextareaAll() {
  UI("textareaNotificationA").value = "";
  UI("textareaNotificationB").value = "";
}
function copyToClipboardAll() {
  const textA = UI("textareaNotificationA");
  const textB = UI("textareaNotificationB");

  const text = "Leanbot A:\n" + textA.value + "\n\nLeanbot B:\n" + textB.value;

  navigator.clipboard.writeText(text)
    .then(() => {
      console.log("Copied!");

      // Highlight A trước
      textA.focus();
      textA.select();

      setTimeout(() => {
        // Sau 400ms highlight B
        textB.focus();
        textB.select();
      }, 400);

      // Bỏ chọn sau 1 giây
      setTimeout(() => {
        window.getSelection().removeAllRanges();
      }, 1000);
    })
    .catch(err => console.error("Copy failed:", err));
}


// ==================================================
// ============== Leanbot A =========================
// ==================================================
let devA = null, gattCharacteristicA = null;
let nextIsNewlineA = true, lastTimestampA = null, isFromWebA = false;
let logBufferA = "";

// DOM A
const textAreaA       = UI("textareaNotificationA");
const buttonTextScanA = UI("buttonTextA");

function requestBluetoothDeviceA() {
  if (!isWebBluetoothEnabled()) return;
  logstatusA('Finding A ...');

  navigator.bluetooth.requestDevice({ filters: [{ services: [bleService] }] })
    .then(device => {
      device.addEventListener('gattserverdisconnected', onDisconnectedA);
      devA = device;
      logstatusA("Connect to " + device.name);
      return device.gatt.connect();
    })
    .then(server => server.getPrimaryService(bleService))
    .then(service => service.getCharacteristic(bleCharacteristic))
    .then(characteristic => {
      gattCharacteristicA = characteristic;
      gattCharacteristicA.addEventListener('characteristicvaluechanged', handleChangedValueA);
      return gattCharacteristicA.startNotifications();
    })
    .then(() => buttonTextScanA.innerText = "Rescan A")
    .catch(err => console.error("A error:", err));
}

function disconnectA() {
  if (devA?.gatt.connected) devA.gatt.disconnect();
}

function onDisconnectedA() {
  logstatusA("SCAN A to connect");
  buttonTextScanA.innerText = "Scan A";
}

function sendA() {
  const msgBox = UI("inputMsg");
  let text = msgBox.value.trim();
  if (!text) return;

  isFromWebA = true;
  showTerminalMessageA("    You -> " + text + "\n");

  const newline = UI("CheckNL").checked ? "\n" : "";
  gattCharacteristicA?.writeValue(str2ab(text + newline));

  msgBox.value = "";
}

function handleChangedValueA(event) {
  const value = new TextDecoder('utf-8').decode(event.target.value).replace(/\r/g, '');
  showTerminalMessageA(value);
  if (checkboxAutoScroll.checked) textAreaA.scrollTop = textAreaA.scrollHeight;
}

function showTerminalMessageA(text) {
  // Bỏ qua chuỗi init
  if (text === "AT+NAME\n") return;
  if (text === "LB999999\n") {
    logBufferA += "\n>>> Leanbot ready >>>\n";
    return;
  }

  if (nextIsNewlineA) { text = "\n" + text; nextIsNewlineA = false; }
  if (text.endsWith("\n")) { text = text.slice(0, -1); nextIsNewlineA = true; }

  if (checkboxTimestamp.checked) {
    const now = new Date();
    let gap = 0;
    if (!isFromWebA && lastTimestampA) {
      gap = (now - lastTimestampA) / 1000;
    }
    if (!isFromWebA) lastTimestampA = now;

    const hours        = String(now.getHours()).padStart(2, '0');
    const minutes      = String(now.getMinutes()).padStart(2, '0');
    const seconds      = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const gapStr = !isFromWebA ? `(+${gap.toFixed(3)})` : "        ";
    const prefix = `${hours}:${minutes}:${seconds}.${milliseconds} ${gapStr} -> `;

    // Thêm prefix cho từng dòng
    text = text.split('\n').map((line, idx) => {
      if (idx === 0) return line; // dòng đầu giữ nguyên
      else if (idx === 1) return prefix + line; // dòng 2 tính gap thật
      else return `${hours}:${minutes}:${seconds}.${milliseconds} (+0.000) -> ${line}`;
    }).join('\n');
  }

  if (isFromWebA) isFromWebA = false;

  logBufferA += text;
}

setInterval(() => {
  if (logBufferA) {
    textAreaA.value += logBufferA;
    logBufferA = "";
    if (checkboxAutoScroll.checked) textAreaA.scrollTop = textAreaA.scrollHeight;
  }
}, 20);

function logstatusA(text) { UI("navbarTitleA").textContent = text; }

function toggleFunctionA() {
  if (buttonTextScanA.innerText === "Scan A") {
    requestBluetoothDeviceA();
  } else {
    buttonTextScanA.innerText = "Scan A";
    disconnectA();
    requestBluetoothDeviceA();
    nextIsNewlineA = true;
  }
}

// ==================================================
// ============== Leanbot B =========================
// ==================================================
let devB = null, gattCharacteristicB = null;
let nextIsNewlineB = true, lastTimestampB = null, isFromWebB = false;
let logBufferB = "";

// DOM B
const textAreaB       = UI("textareaNotificationB");
const buttonTextScanB = UI("buttonTextB");

function requestBluetoothDeviceB() {
  if (!isWebBluetoothEnabled()) return;
  logstatusB('Finding B ...');

  navigator.bluetooth.requestDevice({ filters: [{ services: [bleService] }] })
    .then(device => {
      device.addEventListener('gattserverdisconnected', onDisconnectedB);
      devB = device;
      logstatusB("Connect to " + device.name);
      return device.gatt.connect();
    })
    .then(server => server.getPrimaryService(bleService))
    .then(service => service.getCharacteristic(bleCharacteristic))
    .then(characteristic => {
      gattCharacteristicB = characteristic;
      gattCharacteristicB.addEventListener('characteristicvaluechanged', handleChangedValueB);
      return gattCharacteristicB.startNotifications();
    })
    .then(() => buttonTextScanB.innerText = "Rescan B")
    .catch(err => console.error("B error:", err));
}

function disconnectB() {
  if (devB?.gatt.connected) devB.gatt.disconnect();
}

function onDisconnectedB() {
  logstatusB("SCAN B to connect");
  buttonTextScanB.innerText = "Scan B";
}

function sendB() {
  const msgBox = UI("inputMsg");
  let text = msgBox.value.trim();
  if (!text) return;

  isFromWebB = true;
  showTerminalMessageB("    You -> " + text + "\n");

  const newline = UI("CheckNL").checked ? "\n" : "";
  gattCharacteristicB?.writeValue(str2ab(text + newline));

  msgBox.value = "";
}

function handleChangedValueB(event) {
  const value = new TextDecoder('utf-8').decode(event.target.value).replace(/\r/g, '');
  showTerminalMessageB(value);
  if (checkboxAutoScroll.checked) textAreaB.scrollTop = textAreaB.scrollHeight;
}

function showTerminalMessageB(text) {
  // Bỏ qua chuỗi init
  if (text === "AT+NAME\n") return;
  if (text === "LB999999\n") {
    logBufferB += "\n>>> Leanbot ready >>>\n";
    return;
  }

  if (nextIsNewlineB) { text = "\n" + text; nextIsNewlineB = false; }
  if (text.endsWith("\n")) { text = text.slice(0, -1); nextIsNewlineB = true; }

  if (checkboxTimestamp.checked) {
    const now = new Date();
    let gap = 0;
    if (!isFromWebB && lastTimestampB) {
      gap = (now - lastTimestampB) / 1000;
    }
    if (!isFromWebB) lastTimestampB = now;

    const hours        = String(now.getHours()).padStart(2, '0');
    const minutes      = String(now.getMinutes()).padStart(2, '0');
    const seconds      = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const gapStr = !isFromWebB ? `(+${gap.toFixed(3)})` : "        ";
    const prefix = `${hours}:${minutes}:${seconds}.${milliseconds} ${gapStr} -> `;

    // Thêm prefix cho từng dòng
    text = text.split('\n').map((line, idx) => {
      if (idx === 0) return line; // dòng đầu giữ nguyên
      else if (idx === 1) return prefix + line; // dòng 2 tính gap thật
      else return `${hours}:${minutes}:${seconds}.${milliseconds} (+0.000) -> ${line}`;
    }).join('\n');
  }

  if (isFromWebB) isFromWebB = false;

  logBufferB += text;
}

setInterval(() => {
  if (logBufferB) {
    textAreaB.value += logBufferB;
    logBufferB = "";
    if (checkboxAutoScroll.checked) textAreaB.scrollTop = textAreaB.scrollHeight;
  }
}, 20);

function logstatusB(text) { UI("navbarTitleB").textContent = text; }

function toggleFunctionB() {
  if (buttonTextScanB.innerText === "Scan B") {
    requestBluetoothDeviceB();
  } else {
    buttonTextScanB.innerText = "Scan B";
    disconnectB();
    requestBluetoothDeviceB();
    nextIsNewlineB = true;
  }
}

// ==================================================
// ============== Send to A + B =====================
// ==================================================
async function sendAB() {
  const msgBox = UI("inputMsg");
  let text = msgBox.value.trim();
  if (!text) return;

  const lines = text.split(/\r?\n/);
  const newline = UI("CheckNL").checked ? "\n" : "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] + newline;

    // Gửi tới A
    if (gattCharacteristicA) {
      showTerminalMessageA("    You -> " + lines[i] + "\n");
      await gattCharacteristicA.writeValue(str2ab(line));
    }

    // Gửi tới B
    if (gattCharacteristicB) {
      showTerminalMessageB("    You -> " + lines[i] + "\n");
      await gattCharacteristicB.writeValue(str2ab(line));
    }

    // Delay nhỏ giữa các dòng (5ms)
    await new Promise(r => setTimeout(r, 5));
  }

  msgBox.value = "";
}

// ==================================================
// ============== Info popup ========================
// ==================================================
document.addEventListener('DOMContentLoaded', () => {
    const infoButtonA  = UI('infoButtonA');
    const infoContentA = UI('infoContentA');
    const infoButtonB  = UI('infoButtonB');
    const infoContentB = UI('infoContentB');

    infoButtonA.addEventListener('click', e => {
        e.stopPropagation();
        infoContentA.style.display = infoContentA.style.display === 'block' ? 'none' : 'block';
    });
    infoButtonB.addEventListener('click', e => {
        e.stopPropagation();
        infoContentB.style.display = infoContentB.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
        infoContentA.style.display = 'none';
        infoContentB.style.display = 'none';
    });
});