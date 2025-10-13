let Device, LeanbotCharacteristic, WebTxCharacteristic, WebRxCharacteristic;

let SERVICE_UUID        = '0000ffe0-0000-1000-8000-00805f9b34fb';
let LEANBOT_UUID        = '0000ffe1-0000-1000-8000-00805f9b34fb';
let WEB_TX_UUID         = '0000ffe2-0000-1000-8000-00805f9b34fb'; 
let WEB_RX_UUID         = '0000ffe3-0000-1000-8000-00805f9b34fb'; 

function isWebBluetoothEnabled() {
  if (!navigator.bluetooth) {
      console.log('Web Bluetooth API is not available in this browser!');
      return false;
  }
  return true;
}

function requestBluetoothDevice() {
  if (isWebBluetoothEnabled()){
      logstatus('Finding...');
      navigator.bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
      })         
      .then(device => {
          device.addEventListener('gattserverdisconnected', onDisconnected);
          Device = device;
          logstatus("Connect to " + Device.name);
          console.log('Connecting to', Device);
          return device.gatt.connect();
      })
      .then(server => {
          console.log('Getting GATT Service...');
          logstatus('Getting Service...');
          return server.getPrimaryService(SERVICE_UUID);
      })
      .then(service => {
          console.log('Getting GATT Characteristics...');
          logstatus('Getting Characteristics...');
          return Promise.all([
              service.getCharacteristic(LEANBOT_UUID),
              service.getCharacteristic(WEB_TX_UUID),       
              service.getCharacteristic(WEB_RX_UUID)        
          ]);
      })
      .then(characteristics => {
          logstatusWebName(Device.name);
          UI("buttonText").innerText = "Rescan";

          // Serial Monitor characteristic
          LeanbotCharacteristic = characteristics[0];
          LeanbotCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue);

          // // TX (Write)
          WebTxCharacteristic = characteristics[1];

          // // RX (Notify)
          WebRxCharacteristic = characteristics[2];
          WebRxCharacteristic.addEventListener('characteristicvaluechanged', handleUploadRxChangedValue);

          return Promise.all([
              LeanbotCharacteristic.startNotifications(),
              WebRxCharacteristic.startNotifications()
          ]);
      })
      .catch(error => {
          if (error instanceof DOMException && error.name === 'NotFoundError' && error.message === 'User cancelled the requestDevice() chooser.') {
              console.log("User has canceled the device connection request.");
              logstatus("SCAN to connect");
          } else {
              console.log("Unable to connect to device: " + error);
              logstatus("ERROR");
          }
      });
  }
}

let string = "";
function handleUploadRxChangedValue(event) {
    const data = event.target.value;
    const dataArray = new Uint8Array(data.buffer);
    const textDecoder = new TextDecoder('utf-8');
    const valueString = textDecoder.decode(dataArray);

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
  // Tách block thành từng dòng, loại bỏ dòng trống và khoảng trắng
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const bytes = [];

  for (const line of lines) {
    // Mỗi dòng Intel HEX bắt đầu bằng dấu ':', loại bỏ nếu có
    let hex = line.startsWith(":") ? line.slice(1) : line;

    // Duyệt từng cặp ký tự hex trong dòng
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substr(i, 2), 16);
      if (!isNaN(byte)) bytes.push(byte);
    }
  }

  // Trả về mảng Uint8Array gồm tất cả bytes của các dòng trong block
  return new Uint8Array(bytes);
}


async function sendHEXFile(data) {
  if (!WebTxCharacteristic) {
      console.log("GATT Characteristic not found.");
      return;
  }

  UI("UploaderSendLog").textContent += data ; // Hiển thị dòng hiện tại
  UI("UploaderSendLog").scrollTop = UI("UploaderSendLog").scrollHeight;

  // data += '\n';  // Append newline character to data
  console.log("You -> " + data);

  const bytes = hexLineToBytes(data);
  await WebTxCharacteristic.writeValueWithoutResponse(bytes);
  // let start = 0;
  // const dataLength = data.length;
  // while (start < dataLength) {
  //   let subStr = data.substring(start, start + 45); // Gửi từng phần 24 bytes
  //   try {
  //       let ByteStart = performance.now();
  //       await WebTxCharacteristic.writeValueWithoutResponse(str2ab(subStr));
  //       let ByteEnd = performance.now();
  //       let ByteTime = ByteEnd - ByteStart;
  //       console.log(`Time ${subStr.length} bytes: ${ByteTime.toFixed(2)} ms`);
  //   } catch (error) {
  //       console.error("Error writing to characteristic:", error);
  //       break;
  //   }
  //   start += 45;
  // }
}

function logstatus(text){
  UI('navbarTitle').textContent = text;
}

function disconnect()
{
  logstatus("SCAN to connect");
  console.log("Disconnected from: " + Device.name);
  return Device.gatt.disconnect();
}

function onDisconnected(event) {
  const device = event.target;
  logstatus("SCAN to connect");
  UI('buttonText').innerText = "Scan";
  console.log(`Device ${device.name} is disconnected.`);
}

function str2ab(str)
{
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  for (var i = 0, l = str.length; i < l; i++) {
      bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function toggleFunction() {
  if (UI('toggleButton').innerText == "Scan") {
      requestBluetoothDevice();
      return;
  } 
  disconnect();
  requestBluetoothDevice();
}

function UI(elmentID) {
  return document.getElementById(elmentID);
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
    // document.getElementById("UploaderStatus").textContent = text;
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
      document.getElementById("fileName").textContent = "Selected file: " + file.name;
    } else {
      alert("Please drop a valid HEX File (.hex)");
    }
  }
});

document.getElementById("uploadBtn").addEventListener("click", async () => {
  console.log("Upload button clicked");
  if (!selectedFile) {
    alert("No file selected!");
    return;
  }

  if (!WebTxCharacteristic) {
    alert("Device not connected!");
    return;
  }

  UI("UploaderSendLog").textContent = ""; // Clear previous log
  UI("UploaderRecvLog").textContent = ""; // Clear previous log

  // await WebTxCharacteristic.writeValueWithoutResponse(str2ab("START SEND HEX LINES" + "\n")); // Gửi lệnh vào chế độ lập trình
  // await new Promise(resolve => setTimeout(resolve, 1000)); // Đợi một chút để thiết bị chuẩn bị
  
  // Số dòng bạn muốn ghép mỗi lần gửi (ví dụ: 2, 4, 8...)
  const LINES_PER_BLOCK = 4;

  // Đọc nội dung file
  const text = await selectedFile.text();
  const lines = text.split(/\r?\n/);

  // Duyệt qua file theo từng block (mỗi block = LINES_PER_BLOCK dòng)
  for (let i = 0; i < lines.length; i += LINES_PER_BLOCK) {
    let block = "";

    // Ghép các dòng trong block
    for (let j = 0; j < LINES_PER_BLOCK; j++) {
      const lineIndex = i + j;
      if (lineIndex < lines.length) {
        const line = lines[lineIndex].trim();
        if (line.length > 0) {
          block += line + "\n"; // giữ ký tự xuống dòng giữa các line
        }
      }
    }

    // Nếu block có nội dung thì gửi đi
    if (block.length > 0) {
      await sendHEXFile(block);  // Gửi 1 block (gồm 4, 8,... dòng)
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