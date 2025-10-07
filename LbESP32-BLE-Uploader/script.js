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

async function sendHEXFile(data) {
  if (!WebTxCharacteristic) {
      console.log("GATT Characteristic not found.");
      return;
  }

  UI("UploaderStatus").textContent = "Web -> " + data ; // Hiển thị dòng hiện tại

  data += '\n';  // Append newline character to data
  console.log("You -> " + data);
  let start = 0;
  const dataLength = data.length;
  while (start < dataLength) {
    let subStr = data.substring(start, start + 20);
    try {
        let ByteStart = performance.now();
        await WebTxCharacteristic.writeValueWithoutResponse(str2ab(subStr));
        let ByteEnd = performance.now();
        let ByteTime = ByteEnd - ByteStart;
        console.log(`Time ${subStr.length} bytes: ${ByteTime.toFixed(2)} ms`);
    } catch (error) {
        console.error("Error writing to characteristic:", error);
        break;
    }
    start += 20;
  }
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
  console.log("Device -> " + line);
  UI("UploaderStatus").textContent = "Device -> " + line;
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

  await sendHEXFile("START SEND HEX LINES"); // Gửi lệnh bắt đầu
  await new Promise(resolve => setTimeout(resolve, 1000)); // Đợi một chút để thiết bị chuẩn bị
  

  const text = await selectedFile.text();
  const lines = text.split(/\r?\n/);

  let totalStart = performance.now();  // bắt đầu tính tổng thời gian
  let totalLines = 0;

  for (let line of lines) {
    if (line.trim().length > 0) {
      await sendHEXFile(line);
      totalLines++;
    }
  }

  let totalEnd = performance.now();
  let totalTime = totalEnd - totalStart;
  let avgLineTime = totalTime / totalLines;

  let report = `Lines sent: ${totalLines}\nTotal time: ${totalTime.toFixed(2)} ms\nAverage per line: ${avgLineTime.toFixed(2)} ms`;

  // alert("Send complete! LbESP32 will process the HEX file.\n\n" + report);
  UI("UploaderStatus").textContent = "Send complete!";
  console.log(report);
});

function send() {
  const MsgSend = UI("input");
  isFromWeb = true;
  logBuffer += "\n";
  showTerminalMessage("    You -> " + MsgSend.value + "\n");
  logBuffer += "\n";

  const newline = checkboxNewline.checked ? "\n" : "";
  LeanbotCharacteristic?.writeValue(str2ab(MsgSend.value + newline));

  MsgSend.value = "";
}