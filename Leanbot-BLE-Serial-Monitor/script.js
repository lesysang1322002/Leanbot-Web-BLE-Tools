// ================== BLE Config ==================
const bleService        = '0000ffe0-0000-1000-8000-00805f9b34fb';
const bleCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';

let dev, gattCharacteristic;
let bluetoothDeviceDetected;

// ================== State ==================
let nextIsNewline   = true;
let lastTimestamp   = null;
let isFromWeb       = false;

// ================== DOM Elements ==================
function UI(id) {
    return document.getElementById(id);
}

const textArea            = UI("textareaNotification");
const buttonTextScan      = UI("buttonText");
const checkboxAutoScroll  = UI("CheckAutoScroll");
const checkboxTimestamp   = UI("CheckTimestamp");
const checkboxNewline     = UI("CheckNL");

// ================== BLE ==================
function isWebBluetoothEnabled() {
    if (!navigator.bluetooth) {
        console.log('Web Bluetooth API is not available in this browser!');
        return false;
    }
    return true;
}

function requestBluetoothDevice() {
    if (!isWebBluetoothEnabled()) return;

    logstatus('Finding...');
    navigator.bluetooth.requestDevice({ filters: [{ services: [bleService] }] })
        .then(device => {
            device.addEventListener('gattserverdisconnected', onDisconnected);
            dev = device;
            logstatus("Connect to " + dev.name);
            return device.gatt.connect();
        })
        .then(server => server.getPrimaryService(bleService))
        .then(service => service.getCharacteristic(bleCharacteristic))
        .then(characteristic => {
            gattCharacteristic = characteristic;
            gattCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue);
            return gattCharacteristic.startNotifications();
        })
        .then(() => {
            logstatus(dev.name);
            buttonTextScan.innerText = "Rescan";
        })
        .catch(error => {
            if (error.name === 'NotFoundError') {
                logstatus("Scan to connect");
                console.log("Người dùng đã hủy yêu cầu kết nối thiết bị.");
            } else {
                logstatus("ERROR");
                console.error("Không thể kết nối với thiết bị:", error);
            }
        });
}

function disconnect() {
    if (dev?.gatt.connected) {
        dev.gatt.disconnect();
        console.log("Đã ngắt kết nối với:", dev.name);
    }
}

function onDisconnected(event) {
    logstatus("SCAN to connect");
    buttonTextScan.innerText = "Scan";
    resetPage();
    console.log(`Device ${dev.name} is disconnected.`);
}

function resetPage() {
    // textArea.value = "";
    isFromWeb = false;
    lastTimestamp = null;
    nextIsNewline = true;
}

let writing = false;
let writeTimeout = null;

async function send() {
    if ( !gattCharacteristic ) {
        console.log("No device connected.");
        return;
    }

    writing = true; // Đặt writing thành true khi bắt đầu gửi
    clearTimeout(writeTimeout); // Xóa timeout trước đó nếu có

    const MsgSend = UI("input");
    isFromWeb = true;
    logBuffer += "\n";
    showTerminalMessage("    You -> " + MsgSend.value + "\n");
    logBuffer += "\n";

    const newline = checkboxNewline.checked ? "\n" : "";
    await gattCharacteristic.writeValue(str2ab(MsgSend.value + newline));

    MsgSend.value = "";

    writeTimeout = setTimeout(() => {
        writing = false; 
    }, 3);
}

function str2ab(str) {
    return new TextEncoder().encode(str).buffer;
}

let logBuffer = "";

setInterval(() => {
    if (logBuffer) {
        textArea.value += logBuffer;
        logBuffer = "";
        if (checkboxAutoScroll.checked) {
            textArea.scrollTop = textArea.scrollHeight;
        }
    }
}, 20); // update mỗi 20ms

// ================== UI Handlers ==================
function handleChangedValue(event) {
    if (writing) return; // Bỏ qua nếu event do Web ghi -> ESP

    const valueString = new TextDecoder('utf-8').decode(event.target.value).replace(/\r/g, '');
    showTerminalMessage(valueString);
    if (checkboxAutoScroll.checked) textArea.scrollTop = textArea.scrollHeight;
}

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
        console.log("Gap:", gap.toFixed(3), "seconds");
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

function toggleFunction() {
    if (buttonTextScan.innerText === "Scan") {
        requestBluetoothDevice();
    } else {
        buttonTextScan.innerText = "Scan";
        disconnect();
        requestBluetoothDevice();
        nextIsNewline = true;
    }
}

function logstatus(text) {
    UI('navbarTitle').textContent = text;
}

function clearTextarea() {
    textArea.value = "";
}

function copyToClipboard() {
    textArea.select();
    navigator.clipboard.writeText(textArea.value)
        .then(() => console.log("Copied!"))
        .catch(err => console.error("Copy failed:", err));
}

// ================== Info popup ==================
document.addEventListener('DOMContentLoaded', () => {
    const infoButton  = UI('infoButton');
    const infoContent = UI('infoContent');

    infoButton.addEventListener('click', e => {
        e.stopPropagation();
        infoContent.style.display = infoContent.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => infoContent.style.display = 'none');
});