let Device, LeanbotCharacteristic, WebTxCharacteristic, WebRxCharacteristic;

let SERVICE_UUID        = '0000ffe0-0000-1000-8000-00805f9b34fb';
let LEANBOT_UUID        = '0000ffe1-0000-1000-8000-00805f9b34fb';
let WEB_TX_UUID         = '0000ffe2-0000-1000-8000-00805f9b34fb'; 
let WEB_RX_UUID         = '0000ffe3-0000-1000-8000-00805f9b34fb'; 

// ================== DOM Elements ==================

function isWebBluetoothEnabled() {
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth API is not available in this browser!');
    return false;
  }
  return true;
}

async function requestBluetoothDevice() {
  if (!isWebBluetoothEnabled()) return;

  try {
    logstatus('Scanning ...');

    // --- 1. Quét và chọn thiết bị ---
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }]
    });

    device.addEventListener('gattserverdisconnected', onDisconnected);
    Device = device;
    dev    = device; // Biến liên kết với trang Leanbot BLE Serial Monitor

    // --- 2. Gọi hàm chung để kết nối ---
    await connectDevice(device);

  } catch (error) {
    if (error.name === 'NotFoundError') {
      console.log("User canceled device selection.");
      logstatus("No Leanbot connected");
    } else {
      console.error("Unable to connect to device:", error);
      logstatus("ERROR");
    }
  }
}

async function connectDevice(device) {
  try {
    logstatus(`Connecting to ${device.name}...`);
    console.log('Connecting to', device);

    // --- 1. Kết nối GATT ---
    const server = await device.gatt.connect();
    logstatus('Getting Service...');
    const service = await server.getPrimaryService(SERVICE_UUID);

    // --- 2. Lấy các đặc tính (characteristics) ---
    logstatus('Getting Characteristics...');
    const [leanbot, tx, rx] = await Promise.all([
      service.getCharacteristic(LEANBOT_UUID),
      service.getCharacteristic(WEB_TX_UUID),
      service.getCharacteristic(WEB_RX_UUID)
    ]);

    // --- 3. Lưu & cấu hình ---
    LeanbotCharacteristic = leanbot;
    WebTxCharacteristic = tx;
    WebRxCharacteristic = rx;

    // Event listener
    LeanbotCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue);
    WebRxCharacteristic.addEventListener('characteristicvaluechanged', handleUploadRxChangedValue);

    // --- 4. Bật notify ---
    await LeanbotCharacteristic.startNotifications();
    await WebRxCharacteristic.startNotifications();

    // --- 5. Cập nhật UI ---
    logstatusWebName(device.name);
    UI("buttonText").innerText = "Rescan";

    return true;

  } catch (error) {
    console.error("❌ GATT connection failed:", error);
    logstatus("ERROR");
    return false;
  }
}

async function reconnectBLE() {
  if (!Device) return;

  if (Device.gatt.connected) return;

  logstatus("Reconnecting to " + Device.name + "...");

  const success = await connectDevice(Device);
  if (success) resetUIReconnectBtn();
}

let string = "";
function handleUploadRxChangedValue(event) {
  const data = event.target.value;
  const dataArray = new Uint8Array(data.buffer);
  const textDecoder = new TextDecoder('utf-8');
  const valueString = textDecoder.decode(dataArray);

  // Log Debug Information
  if (!sendStartTime) sendStartTime = performance.now(); // fallback if RX happens first
  const relTime = (performance.now() - sendStartTime).toFixed(2);
  console.log(`[${relTime}] Web receive "${valueString.replace(/[\r\n]+/g, "\\n")}"`);

  string += valueString;
  const lines = string.split(/[\r\n]+/);
  string = lines.pop() || "";

  lines.forEach(line => {
    if (line) {
      handleSerialLine(line);
    }
  });
}

function hexLineToBytes(block) {
  const bytes = [];
  for (let i = 0; i < block.length; i += 2) {
    const byte = parseInt(block.substr(i, 2), 16);
    if (!isNaN(byte)) bytes.push(byte);
  }

  return new Uint8Array(bytes);
}


let sendCount = 0;
let sendStartTime = null; // timestamp of the very first send

async function sendHEXFile(data) {
  if (!WebTxCharacteristic) {
    console.log("[ERROR] GATT Characteristic not found.");
    return;
  }

  const bytes = hexLineToBytes(data);

  if (sendCount === 0) {
    sendStartTime = performance.now(); // set reference time
    console.log("[DEBUG] === HEX file transmission started ===");
  }

  const t0 = sendCount === 0 ? sendStartTime : performance.now();
  const relStart = (t0 - sendStartTime).toFixed(2);

  sendCount++;

  console.log(`[${relStart}] Write #${sendCount} begin`);

  await WebTxCharacteristic.writeValueWithoutResponse(bytes);

  const t1 = performance.now();
  const relEnd = (t1 - sendStartTime).toFixed(2);
  const duration = (t1 - t0).toFixed(2);

  console.log(`[${relEnd}] Write #${sendCount} done`);
}

function logstatusWebName(text){
  logstatus(text + " - Uploader");
  console.log("Connected to", text);
}

function handleSerialLine(line) {
  UI("UploaderRecvLog").textContent += line + "\n";
  UI("UploaderRecvLog").scrollTop = UI("UploaderRecvLog").scrollHeight; 
}

let device, server, service, characteristic;
let selectedFile = null;

// --- Display full file content ---
function previewFile(file) {
  // Display file name
  UI("fileName").textContent = selectedFile.name;
  console.log("Selected file:", file.name);

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = new TextDecoder().decode(e.target.result);
    // Show full content (no truncation)
    // UI("UploaderStatus").textContent = text;
  };
  reader.readAsArrayBuffer(file);
}

// --- Handle file input selection ---
UI("fileInput").addEventListener("change", (e) => {
  console.log("File input changed");
  selectedFile = e.target.files[0];
  if (selectedFile) previewFile(selectedFile);
});

// --- Drag & Drop ---
const dropZone = UI("dropZone");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.name.toLowerCase().endsWith(".hex")) {
      selectedFile = file;
      previewFile(selectedFile);
      UI("fileName").textContent = "Selected file: " + file.name;
    } else {
      alert("Please drop a valid HEX File (.hex)");
    }
  }
});

function send() {
  const MsgSend = UI("input");
  isFromWeb = true;
  logBuffer += "\n";
  showTerminalMessage("    You -> " + MsgSend.value + "\n");
  logBuffer += "\n";

  const newline = checkboxNewline.checked ? "\n" : "";
  LeanbotCharacteristic.writeValue(str2ab(MsgSend.value + newline));

  MsgSend.value = "";
}

// ==== Giải mã 1 dòng Intel HEX ====
function parseHexLine(line) {
  if (!line.startsWith(":")) return null;

  const hex = line.slice(1); // bỏ dấu ':'
  const length = parseInt(hex.substr(0, 2), 16);
  const address = parseInt(hex.substr(2, 4), 16);
  const recordType = hex.substr(6, 2);
  const data = hex.substr(8, length * 2);
  const checksum = parseInt(hex.substr(8 + length * 2, 2), 16);

  return { length, address, recordType, data, checksum, hex };
}

// ==== Kiểm tra checksum ====
function verifyChecksum(parsed) {
  const { hex, length, checksum } = parsed;
  const allBytes = [];

  for (let i = 0; i < 4 + length; i++) {
    allBytes.push(parseInt(hex.substr(i * 2, 2), 16));
  }

  const sum = allBytes.reduce((a, b) => a + b, 0);
  const calcChecksum = ((~sum + 1) & 0xFF);

  return calcChecksum === checksum;
}

// ==== HÀM GỬI FILE HEX TỔNG QUÁT ====
async function uploadHexFromText(hexText) {
  if (!WebTxCharacteristic) {
    alert("Device not connected!");
    console.log("Device not connected!");
    return;
  }

  sendCount = 0;        // Reset bộ đếm
  sendStartTime = null; // Reset thời gian
  UI("UploaderSendLog").textContent = "";
  UI("UploaderRecvLog").textContent = "";

  // ---- 1. Gửi START HEADER ----
  const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
  await WebTxCharacteristic.writeValueWithoutResponse(startHeader);
  console.log("Web sent START header:", Array.from(startHeader).map(b => "0x" + b.toString(16).padStart(2, "0")).join(" "));

  // ---- 2. Chuẩn bị dữ liệu ----
  const LINES_PER_BLOCK = 8;
  const lines = hexText.split(/\r?\n/).filter(line => line.trim().length > 0);
  let sequence = 0;

  for (let i = 0; i < lines.length;) {
    const rawLine = lines[i].trim();
    const parsed = parseHexLine(rawLine);
    if (!parsed) { i++; continue; }
    if (!verifyChecksum(parsed)) { console.warn(`Checksum mismatch at line ${i}`); i++; continue; }

    // Dòng đầu giữ nguyên length + address + data
    let baseLen = parsed.length;
    let currentAddr = parsed.address;
    let block = parsed.hex.substr(0, 6) + parsed.data; // giữ lại length + address + data
    let rawPreview = lines[i] + "\n";
    let lineCount = 1;

    // ---- Ghép thêm tối đa 7 dòng tiếp theo ----
    for (let j = i + 1; j < lines.length && lineCount < LINES_PER_BLOCK; j++) {
      const nextLine = lines[j].trim();
      const nParsed = parseHexLine(nextLine);

      if (!nParsed) break;
      if (!verifyChecksum(nParsed)) { 
        console.warn(`Checksum mismatch at line ${j}`);
        j++;
        continue;
      }

      const expectedAddr = currentAddr + baseLen;
      const nLen = nParsed.length;
      const nAddr = nParsed.address;

      // Nếu length khác hoặc address không liền kề → dừng ghép
      if (nLen !== baseLen || nAddr !== expectedAddr) break;

      // Nối phần data, không gửi lại length + address
      block += nParsed.data;
      rawPreview += lines[j] + "\n";

      currentAddr = nAddr;
      lineCount++;
      i = j; // dịch i theo j
    }

    // Cập nhật i sang dòng tiếp theo
    i++;

    // ---- Hiển thị log lên UI ----
    UI("UploaderSendLog").textContent += rawPreview;
    UI("UploaderSendLog").scrollTop = UI("UploaderSendLog").scrollHeight;

    // ---- 3. Gửi block qua BLE ----
    if (block.length > 0) {
      const header = sequence.toString(16).padStart(2, "0").toUpperCase(); // Sequence number
      const payload = header + block;
      await sendHEXFile(payload);
      sequence++;
    }
  }

  console.log("Upload completed!");
}

// ==== NÚT Send to LbESP32 ====
UI("uploadBtn").addEventListener("click", async () => {
  console.log("Upload button clicked");
  if (!selectedFile) {
    alert("No file selected!");
    return;
  }

  const text = await selectedFile.text();
  await uploadHexFromText(text);
});

// ==== NÚT Upload Standard ====
UI("uploadStandardBtn").addEventListener("click", async () => {
  try {
    const res = await fetch("./firmware/standard.hex");
    const text = await res.text();
    console.log("Loaded standard.hex");
    await uploadHexFromText(text);
  } catch (err) {
    console.error("Error loading standard.hex:", err);
  }
});

// ==== NÚT Upload Advance ====
UI("uploadAdvanceBtn").addEventListener("click", async () => {
  try {
    const res = await fetch("./firmware/advance.hex");
    const text = await res.text();
    console.log("Loaded advance.hex");
    await uploadHexFromText(text);
  } catch (err) {
    console.error("Error loading advance.hex:", err);
  }
});