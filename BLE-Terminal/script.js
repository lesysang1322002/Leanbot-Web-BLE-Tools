var deviceName = 'JDY-33-BLE';
var bleService = '0000ffe0-0000-1000-8000-00805f9b34fb';
var bleCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';
var gattCharacteristic;
var bluetoothDeviceDetected;
function isWebBluetoothEnabled() {
    if (!navigator.bluetooth) {
    console.log('Web Bluetooth API is not available in this browser!');
    // log('Web Bluetooth API is not available in this browser!');
    return false
    }

    return true
}
function requestBluetoothDevice() {
    if(isWebBluetoothEnabled){
logstatus('Finding...');
navigator.bluetooth.requestDevice({
    filters: [{
        services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }] 
    })         
.then(device => {
    dev=device;
    logstatus("Connect to " + dev.name);
    console.log('Đang kết nối với', dev);
    return device.gatt.connect();
})
.then(server => {
        console.log('Getting GATT Service...');
        logstatus('Getting Service...');
        return server.getPrimaryService(bleService);
    })
    .then(service => {
        console.log('Getting GATT Characteristic...');
        logstatus('Geting Characteristic...');
        return service.getCharacteristic(bleCharacteristic);
    })
    .then(characteristic => {
        logstatus(dev.name);
        document.getElementById("buttonText").innerText = "Rescan";
    gattCharacteristic = characteristic
    gattCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue)
    return gattCharacteristic.startNotifications()
})
.catch(error => {
    if (error instanceof DOMException && error.name === 'NotFoundError' && error.message === 'User cancelled the requestDevice() chooser.') {
    console.log("Người dùng đã hủy yêu cầu kết nối thiết bị.");
    logstatus("Scan to connect");
    } else {
    console.log("Không thể kết nối với thiết bị: " + error);
    logstatus("ERROR");
    }
    });
}}

function disconnect()
{
    logstatus("Scan to connect");
    console.log("Đã ngắt kết nối với: " + dev.name);
    return dev.gatt.disconnect();
}

function send()
{   const checkNewline = document.getElementById("CheckNL");
    var data = document.getElementById("input").value;
    showTerminalMessage("    You -> " + data + "\n");
    if(checkNewline.checked){
        gattCharacteristic.writeValue(str2ab(data+"\n"));
        console.log("Checked newline");
    }
    else{
        gattCharacteristic.writeValue(str2ab(data)); 
        console.log("Not isShowTimestamp newline");
    }
    document.getElementById("input").value = "";
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

function scrollToBottom() {
    var textarea = document.getElementById("textareaNotification");
    textarea.scrollTop = textarea.scrollHeight;
}

let checkAutoscroll = true;
const checkbox = document.getElementById("Checkauto");
checkbox.checked = true;

function Checkautoscroll() {
    if (checkbox.checked) {
        checkAutoscroll = true;
    } else {
        checkAutoscroll = false;
    }
}

let isShowTimestamp = false;

function Checkshowtime() {
    const checkbox = document.getElementById("Checkbox");
    if (checkbox.checked) {
        isShowTimestamp = true;
    } else {
        isShowTimestamp = false;
    }
}

function handleChangedValue(event) {
    let data = event.target.value;
    console.log('Received data:', data);
    let dataArray = new Uint8Array(data.buffer);
    // Sử dụng TextDecoder để chuyển đổi Uint8Array thành chuỗi
    let textDecoder = new TextDecoder('utf-8');
    let valueString = textDecoder.decode(dataArray);
    valueString = valueString.replace(/(\r)/gm, '');

    console.log("Nano > " + valueString);
    showTerminalMessage(valueString);
    if (checkAutoscroll) scrollToBottom();
}

// ----------

let nextIsNewline = true;
let lastTimestamp = null;

function showTerminalMessage(text) {
    const textarea = document.getElementById("textareaNotification");

    // Goal: Replace the Leanbot initialization message sequence
    // "\nAT+NAME\nLB999999\n" with "\n>>> Leanbot ready >>>\n"
    if (text == "AT+NAME\n") return;

    if (text == "LB999999\n") {
        // Add "\n" before last line (works with TimestampPrefix too)
        let lines = textarea.value.split('\n');
        lines[lines.length - 1] = "\n" + lines[lines.length - 1];
        textarea.value = lines.join('\n');

        textarea.value += ">>> Leanbot ready >>>\n";
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
    if (lastTimestamp) {
        gap = (now - lastTimestamp) / 1000;
    }
    lastTimestamp = now;

    if (isShowTimestamp) {
        const hours        = String(now.getHours()).padStart(2, '0');
        const minutes      = String(now.getMinutes()).padStart(2, '0');
        const seconds      = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        const gapStr = `(+${gap.toFixed(3)})`;
        const prefix = `${hours}:${minutes}:${seconds}.${milliseconds} ${gapStr} -> `;
        text = text.replace(/\n/g, '\n' + prefix);
    }

    textarea.value += text;
}

// function getTimestampPrefix() {
//     let now = new Date();
//     const hours        = String(now.getHours()).padStart(2, '0');
//     const minutes      = String(now.getMinutes()).padStart(2, '0');
//     const seconds      = String(now.getSeconds()).padStart(2, '0');
//     const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

//     let gap = 0;
//     if (lastTimestamp) {
//         gap = (now - lastTimestamp) / 1000;
//     }
//     lastTimestamp = now;

//     const gapStr = `(+${gap.toFixed(3)})`;
//     return `${hours}:${minutes}:${seconds}.${milliseconds} ${gapStr} -> `;
// }

const button = document.getElementById("toggleButton");
function toggleFunction() {

    if (button.innerText == "Scan") {
        requestBluetoothDevice();
    } else {
        document.getElementById("buttonText").innerText = "Scan";
        disconnect();
        requestBluetoothDevice();
        nextIsNewline=true;
    }
}
function  logstatus(text){
    const navbarTitle = document.getElementById('navbarTitle');
    navbarTitle.textContent = text;
}

function clearTextarea() {
document.getElementById('textareaNotification').value = '';
}

function copyToClipboard() {
    var textarea = document.getElementById('textareaNotification');
    textarea.select();
    document.execCommand('copy');
}

document.addEventListener('DOMContentLoaded', function () {
  var infoButton = document.getElementById('infoButton');
  var infoContent = document.getElementById('infoContent');

  infoButton.addEventListener('click', function (event) {
      event.stopPropagation(); // Ngăn chặn sự kiện click lan sang các phần tử cha
      if (infoContent.style.display === 'block') {
          infoContent.style.display = 'none';
      } else {
          infoContent.style.display = 'block';
      }
  });

  document.addEventListener('click', function () {
      infoContent.style.display = 'none';
  });
});