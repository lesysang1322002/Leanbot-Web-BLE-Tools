let LeanbotCharacteristic, WebTxCharacteristic, WebRxCharacteristic;
let dev;
let timeoutCheckMessage;

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
          dev = device;
          logstatus("Connect to " + dev.name);
          console.log('Connecting to', dev);
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
          logstatusWebName(dev.name);
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

function handleChangedValue(event) {
  
}

async function sendBLE(data) {
  if (!WebTxCharacteristic) {
      console.log("GATT Characteristic not found.");
      return;
  }
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

function checkMessageWithin5Seconds() {
    // Thiết lập hàm setTimeout để kết thúc sau 5 giây
    timeoutCheckMessage = setTimeout(function() {
    console.log("5 seconds timeout, message incorrect.");
    // Hiển thị info box
    UI('infopopup').style.display = "block";
    document.addEventListener("click", function(event) {
        if (! infoBox.contains(event.target)) {
            infoBox.style.display = "none";
        }
    });
    }, 5000);
}

function logstatus(text){
    UI('navbarTitle').textContent = text;
}

function disconnect()
{
    logstatus("SCAN to connect");
    console.log("Disconnected from: " + dev.name);
    return dev.gatt.disconnect();
}

function onDisconnected(event) {
    const device = event.target;
    logstatus("SCAN to connect");
    resetVariable();
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
    resetVariable();
}

function UI(elmentID) {
    return document.getElementById(elmentID);
}

clearTimeout(timeoutCheckMessage);

function logstatusWebName(text){
    logstatus(text + " - Uploader");
}

function resetVariable(){
}

function handleSerialLine(line) {
  console.log("Device -> " + line);
}

let device, server, service, characteristic;
let selectedFile = null;

// --- Display full file content ---
function previewFile(file) {
  document.getElementById("fileName").textContent = selectedFile.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = new TextDecoder().decode(e.target.result);
    // Show full content (no truncation)
    document.getElementById("fileContent").textContent = text;
  };
  reader.readAsArrayBuffer(file);
}

// --- Handle file input selection ---
document.getElementById("fileInput").addEventListener("change", (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile) previewFile(selectedFile);
});

// --- Drag & Drop ---
const dropZone = document.getElementById("dropZone");

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

  await sendBLE("START SEND HEX LINES"); // Gửi lệnh bắt đầu
  await new Promise(resolve => setTimeout(resolve, 1000)); // Đợi một chút để thiết bị chuẩn bị
  

  const text = await selectedFile.text();
  const lines = text.split(/\r?\n/);

  let totalStart = performance.now();  // bắt đầu tính tổng thời gian
  let totalLines = 0;

  for (let line of lines) {
    if (line.trim().length > 0) {
      let lineStart = performance.now();
      await sendBLE(line);
      await new Promise(resolve => setTimeout(resolve, 5)); // Độ trễ nhỏ giữa các dòng
      let lineEnd = performance.now();
      let lineTime = lineEnd - lineStart;
      console.log(`Time line: ${lineTime.toFixed(2)} ms`);
      totalLines++;
    }
  }

  let totalEnd = performance.now();
  let totalTime = totalEnd - totalStart;
  let avgLineTime = totalTime / totalLines;

  let report = `Lines sent: ${totalLines}\nTotal time: ${totalTime.toFixed(2)} ms\nAverage per line: ${avgLineTime.toFixed(2)} ms`;

  alert("Send complete! LbESP32 will process the HEX file.\n\n" + report);
  console.log(report);
});

