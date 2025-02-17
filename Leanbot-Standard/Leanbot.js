let gattCharacteristic;
let timeoutCheckMessage;

function isWebBluetoothEnabled() {
    if (! navigator.bluetooth) {
        console.log('Web Bluetooth API is not available in this browser!');
        return false;
    }
    return true;
}

function requestBluetoothDevice() {
    if (isWebBluetoothEnabled()){
        logstatus('Finding...');
        navigator.bluetooth.requestDevice({
        filters: [{ services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }] 
    })         
    .then(device => {
        device.addEventListener('gattserverdisconnected', onDisconnected);
        dev=device;
        logstatus("Connect to " + dev.name);
        console.log('Connecting to', dev);
        return device.gatt.connect();
    })
    .then(server => {
        console.log('Getting GATT Service...');
        logstatus('Getting Service...');
        return server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    })
    .then(service => {
        console.log('Getting GATT Characteristic...');
        logstatus('Geting Characteristic...');
        return service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
    })
    .then(characteristic => {
        logstatusWebName(dev.name);
        checkMessageWithin5Seconds();
        UI("buttonText").innerText = "Rescan";
        gattCharacteristic = characteristic;
        gattCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue);   
        return gattCharacteristic.startNotifications();
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
}}

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

async function send(data) {
    if (!gattCharacteristic) {
        console.log("GATT Characteristic not found.");
        return;
    }
    data += '\n';  // Append newline character to data
    console.log("You -> " + data);
    let start = 0;
    const dataLength = data.length;
    while (start < dataLength) {
        let subStr = data.substring(start, start + 16);
        try {
            await gattCharacteristic.writeValue(str2ab(subStr));
        } catch (error) {
            console.error("Error writing to characteristic:", error);
            break;
        }
        start += 16;
    }
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

let string = "";
function handleChangedValue(event) {
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