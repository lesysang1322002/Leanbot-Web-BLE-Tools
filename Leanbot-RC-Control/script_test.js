// ================== BLE Config ==================
const bleService        = '0000ffe0-0000-1000-8000-00805f9b34fb';
const bleCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';

let dev, gattCharacteristic;

// ================== DOM Helper ==================
const UI = id => document.getElementById(id);

// ================== BLE ==================
function isWebBluetoothEnabled() {
    if (!navigator.bluetooth) {
        console.error('Web Bluetooth API not supported');
        return false;
    }
    return true;
}

function toggleFunction() {
    if (UI("buttonText").innerText === "Scan") {
        requestBluetoothDevice();
    } else {
        UI("buttonText").innerText = "Scan";
        disconnect();
        requestBluetoothDevice();
    }
}

function requestBluetoothDevice() {
    if (!isWebBluetoothEnabled()) return;

    logstatus('Finding...');
    navigator.bluetooth.requestDevice({ filters: [{ services: [bleService] }] })
        .then(device => {
            dev = device;
            logstatus("Connect to " + dev.name);
            return device.gatt.connect();
        })
        .then(server => server.getPrimaryService(bleService))
        .then(service => service.getCharacteristic(bleCharacteristic))
        .then(characteristic => {
            gattCharacteristic = characteristic;
            logstatus(dev.name);
            UI("buttonText").innerText = "Rescan";
            return gattCharacteristic.startNotifications();
        })
        .catch(err => {
            if (err.name === 'NotFoundError') {
                logstatus("Scan to connect");
                console.warn("Người dùng đã hủy kết nối");
            } else {
                logstatus("ERROR");
                console.error("Kết nối thất bại:", err);
            }
        });
}

function disconnect() {
    if (dev?.gatt.connected) {
        dev.gatt.disconnect();
        logstatus("Scan to connect");
        console.log("Đã ngắt kết nối với:", dev.name);
    }
}

function send(data) {
    console.log("You ->", data);
    gattCharacteristic?.writeValue(new TextEncoder().encode(data + "\n"));
}

function logstatus(text) {
    UI('navbarTitle').textContent = text;
}

// ================== Robot Commands ==================
const commandsMap = {
    Forward: "F", Backward: "B", Left: "L", Right: "R", Stop: "S",
    ForwardLeft: "G", ForwardRight: "I", BackLeft: "H", BackRight: "J",
    CloseDoor: "C", OpenDoor: "O",
    Feild1: "M", Feild2: "N", Feild3: "P", Feild4: "Q",
    ledOn: "W", ledOff: "w",
    gripperClose: "X", gripperOpen: "x",
    hornOn: "V", hornOff: "v",
    LineTracking: "T.", LineCalibration: "C"
};

// Tạo hàm điều khiển tự động từ commandsMap
Object.entries(commandsMap).forEach(([fn, code]) => {
    window[fn] = () => send(code);
});

// ================== Hover & Mouse ==================
function handleHover(action) {
    if (commandsMap[action]) send(commandsMap[action]);
}

function handleMouseOut() {
    Stop();
}

// ================== Info popup ==================
document.addEventListener('DOMContentLoaded', () => {
    const infoButton = UI('infoButton');
    const infoContent = UI('infoContent');

    infoButton.addEventListener('click', e => {
        e.stopPropagation();
        infoContent.style.display = infoContent.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => infoContent.style.display = 'none');
});

// ================== Speed Control ==================
const speedSlider = UI('speed-slider');
const speedValue  = UI('speed-value');

speedSlider.addEventListener('input', () => {
    const speed = speedSlider.value;
    speedValue.innerText = speed;
    send(speed == 10 ? "q" : speed);
});

// ================== Voice Control ==================
function setVoiceLabels(state) {
    UI('ledOnText').innerText          = state ? "Light on"  : "";
    UI('ledOffText').innerText         = state ? "Light off" : "";
    UI('MuteText').innerText           = state ? "Sound off" : "";
    UI('UnmuteText').innerText         = state ? "Sound on"  : "";
    UI('OpenText').innerText           = state ? "Open"      : "";
    UI('CloseText').innerText          = state ? "Close"     : "";
    UI('LineCalibrationText').innerText= state ? "Calibrate" : "";
    UI('LineTrackingText').innerText   = state ? "Tracking"  : "";
}

function listen() {
    annyang.start({ continuous: true });
    setVoiceLabels(true);
}

function stopListen() {
    annyang.abort();
    setVoiceLabels(false);
    UI('spokenCommand').innerText = "";
}

annyang.addCommands({
    '*text': text => {
        const lower = text.toLowerCase();
        console.log('User said:', lower);
        for (const cmd in voiceCommands) {
            if (lower.startsWith(cmd)) {
                console.log(`Matched: "${cmd}"`);
                voiceCommands[cmd]();
                break;
            }
        }
    }
});

const voiceCommands = {
    'light on': ledOn,
    'light off': ledOff,
    'open': gripperOpen,
    'close': gripperClose,
    'turn left': Left,
    'turn right': Right,
    'forward': Forward,
    'backward': Backward,
    'sound on': hornOn,
    'sound off': hornOff,
    'stop': Stop,
    'calibrate': LineCalibration,
    'tracking': LineTracking,
};

annyang.addCallback('result', phrases => {
    UI('spokenCommand').innerText = 'You said: ' + phrases[0];
});

let isListening = false;
function toggleListen() {
    isListening ? stopListen() : listen();
    isListening = !isListening;
    updateMicImage();
}

function updateMicImage() {
    const micImage = UI("micImage");
    micImage.src = isListening ? "../image/micron.png" : "../image/micoff.png";
    micImage.alt = isListening ? "Mic On" : "Mic Off";
}
