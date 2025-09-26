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
const button = document.getElementById("toggleButton");
function toggleFunction() {

    if (button.innerText == "Scan") {
        requestBluetoothDevice();
    } else {
        document.getElementById("buttonText").innerText = "Scan";
        disconnect();
        requestBluetoothDevice();
    }
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
    // gattCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue)
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
function send(data)
{
    console.log("You -> " + data + "\n");
    gattCharacteristic.writeValue(str2ab(data+"\n"));
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
function  logstatus(text){
const navbarTitle = document.getElementById('navbarTitle');
navbarTitle.textContent = text;
}

// let string = "";
// Hàm này sẽ được gọi khi có dữ liệu mới từ Bluetooth
// // Nó sẽ xử lý dữ liệu và gọi hàm handleSerialLine cho mỗi dòng dữ liệu
// function handleChangedValue(event) {
//     const data = event.target.value;
//     const dataArray = new Uint8Array(data.buffer);
//     const textDecoder = new TextDecoder('utf-8');
//     const valueString = textDecoder.decode(dataArray);

//     string += valueString;
//     const lines = string.split(/[\r\n]+/);
//     string = lines.pop() || "";
//     lines.forEach(line => {
//         if (line) { 
//             handleSerialLine(line);
//         }
//     });
// }

// let checkLineTracking = false;

// function handleSerialLine(line) {
//     console.log("line: " + line);
//     if (line === "Run Line Tracking") {
//         document.getElementById("lineTracking").style.backgroundColor = "#4CAF50"; // Màu xanh lá cây
//         checkLineTracking = true;
//     }
// }

function handleHover(action) {
    // Thực hiện hành động tương ứng với hover (ví dụ: gọi hàm Forward(), Backward(), ...)
    switch (action) {
        case 'Forward':
            Forward();
            break;
        case 'Backward':
            Backward();
            break;
        case 'Right':
            Right();
            break;
        case 'Left':
            Left();
            break;
        case 'Stop':
            Stop();
            break;
        case 'BackLeft':
            BackLeft();
            break;
        case 'BackRight':
            BackRight();
            break;
        case 'ForwardLeft':
            ForwardLeft();
            break;
        case 'ForwardRight':
            ForwardRight();
            break;
        // ... Các case khác ...
        default:
            break;
    }
}
function handleMouseOut() {
    // Xử lý khi chuột rời khỏi button
    Stop();
}
// Function hướng 
function CloseDoor(){
    send ("C");
    console.log("Close Door");
}

function OpenDoor(){
    send ("O");
    console.log("Open Door");
}

function Feild1(){
    send("M");
}

function Feild2(){
    send("N");
}

function Feild3(){
    send("P");
}

function Feild4(){
    send("Q");
}

function Forward(){
    send("F");
}
function Backward(){
    send("B");
}
function Left(){
    send("L");
}
function Right(){
    send("R");
}
function Stop(){
    send("S");
}
function ForwardLeft(){
    send("G");
}
function ForwardRight(){
    send("I");
}
function BackLeft(){
    send("H");
}
function BackRight(){
    send("J");
}
function ledOff(){
    send("w");
}
function ledOn(){
    send("W");
}
function gripperClose(){
    send("X");
}
function gripperOpen(){
    send("x");
}
function hornOff(){
    send("v");
}
function hornOn(){
    send("V");
}
function LineTracking(){
    send("T.");
}

function LineCalibration(){
    send("C");
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
    var speedSlider = document.getElementById('speed-slider');
    var speedValue = document.getElementById('speed-value');

    // Thiết lập sự kiện khi thanh kéo thay đổi
    speedSlider.addEventListener('input', function() {
        var speed = speedSlider.value;
        speedValue.innerText = speed;
        // Thực hiện các công việc khác tương ứng với giá trị speed
        if (speed == 10) send("q");
        else send(speed);
});
function listen() {
    annyang.start({ continuous: true });
    document.getElementById('ledOnText').innerText = "Light on";
    document.getElementById('ledOffText').innerText = "Light off";
    document.getElementById('MuteText').innerText = "Sound off";
    document.getElementById('UnmuteText').innerText = "Sound on";
    document.getElementById('OpenText').innerText = "Open";
    document.getElementById('CloseText').innerText = "Close";
    document.getElementById('LineCalibrationText').innerHTML = "Calibrate";
    document.getElementById('LineTrackingText').innerHTML = "Tracking";
}
function stopListen() {
    annyang.abort();
    document.getElementById('ledOnText').innerText = "";
    document.getElementById('ledOffText').innerText = "";
    document.getElementById('MuteText').innerText = "";
    document.getElementById('UnmuteText').innerText = "";
    document.getElementById('OpenText').innerText = "";
    document.getElementById('CloseText').innerText = "";
    document.getElementById('spokenCommand').innerHTML = "";
    document.getElementById('LineCalibrationText').innerHTML = "";
    document.getElementById('LineTrackingText').innerHTML = "";
}

function moveForward(distance) {
    console.log(`Forward ${distance} cm`);
    send("Forward " + distance);
}

function moveBackward(distance) {
    console.log(`Backward ${distance} cm`);
    send("Backward " + distance);    
}

function moveturnLeft(angle) {
    console.log(`Turn left ${angle} degree`);
    send("Left " + angle);
}

function moveturnRight(angle) {
    console.log(`Turn right ${angle} degree`);
    send("Right " + angle);
}

annyang.addCommands({
    '*text': function(text) {
      const lowercaseText = text.toLowerCase();                                                 // Convert to lowercase for comparison
      console.log('User said:', lowercaseText);
      
      // Loop through the commands and check if the string starts with any of the commands
      for (const command in commands) {
        if (lowercaseText.startsWith(command)) {
          console.log(`Matched command: "${command}" -> Calling corresponding function`);
          commands[command]();                                                                  // Call the corresponding function
          break;                                                                                // Exit the loop after finding a matching command
        }
      }
    }
});

const commands = {
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

annyang.addCallback('result', function(phrases) {
    document.getElementById('spokenCommand').innerHTML = 'You said: ' + phrases[0];
});

let isListening = false;

function toggleListen() {
  if (isListening) {
    stopListen();
  } else {
    listen();
  }

  isListening = !isListening;
  updateMicImage();
}

function updateMicImage() {
    const micImage = document.getElementById("micImage");
    micImage.src = isListening ? "../image/micron.png" : "../image/micoff.png";
    micImage.alt = isListening ? "Mic On" : "Mic Off";
}

// Custom button functionality
document.addEventListener("DOMContentLoaded", () => {
    for (let i = 1; i <= 4; i++) {
        let btn = document.getElementById("customBtn" + i);
        let saved = JSON.parse(localStorage.getItem("customBtn" + i));

        if (saved) {
            btn.textContent = saved.name;
            btn.setAttribute("data-value", saved.value);
        } else {
            btn.setAttribute("data-value", ""); // no value by default
        }

        setupCustomButton(btn, i);
    }
});

function setupCustomButton(btn, index) {
    let pressTimer;

    // Short click: only send if the button has a value
    btn.addEventListener("click", () => {
        let value = btn.getAttribute("data-value");
        if (value && value.trim() !== "") {
            send(value);
        } else {
            alert("⚠️ This button has no assigned value. Hold for 2 seconds to configure.");
        }
    });

    // Start hold (PC: mousedown, Mobile: touchstart)
    function startPress() {
        pressTimer = setTimeout(() => {
            let newName = prompt("Enter new button name:", btn.textContent || "");
            if (newName !== null && newName.trim() !== "") {
                btn.textContent = newName.trim();
            }

            let newValue = prompt("Enter value to send:", btn.getAttribute("data-value") || "");
            if (newValue !== null && newValue.trim() !== "") {
                btn.setAttribute("data-value", newValue.trim());
            }

            // Save to localStorage
            localStorage.setItem("customBtn" + index, JSON.stringify({
                name: btn.textContent,
                value: btn.getAttribute("data-value")
            }));
        }, 2000); // 2s hold
    }

    // Cancel hold (PC: mouseup, Mobile: touchend/cancel)
    function cancelPress() {
        clearTimeout(pressTimer);
    }

    // PC
    btn.addEventListener("mousedown", startPress);
    btn.addEventListener("mouseup", cancelPress);
    btn.addEventListener("mouseleave", cancelPress);

    // Mobile
    btn.addEventListener("touchstart", startPress);
    btn.addEventListener("touchend", cancelPress);
    btn.addEventListener("touchcancel", cancelPress);
}
