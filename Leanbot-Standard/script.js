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
    device.addEventListener('gattserverdisconnected', onDisconnected);
    dev=device;
    logstatus("Connect to " + dev.name);
    console.log('Connecting to', dev);
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
        checkMessageWithin5Seconds();
        document.getElementById("buttonText").innerText = "Rescan";
        gattCharacteristic = characteristic
        gattCharacteristic.addEventListener('characteristicvaluechanged', handleChangedValue)
        return gattCharacteristic.startNotifications()
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
function disconnect()
{
    logstatus("SCAN to connect");
    console.log("Disconnected from: " + dev.name);
    return dev.gatt.disconnect();
}
function onDisconnected(event) {
    const device = event.target;
    resetPageColor();
    logstatus("SCAN to connect");
    document.getElementById("buttonText").innerText = "Scan";
    console.log(`Device ${device.name} is disconnected.`);
}

async function send(data) {
    if (gattCharacteristic) {
        console.log("You -> " + data);
        let start = 0;
        let dataLength = data.length;
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
        try {
            await gattCharacteristic.writeValue(str2ab('\n'));
        } catch (error) {
            console.error("Error writing newline to characteristic:", error);
        }
    } else {
        console.log("GATT Characteristic not found.");
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
function  logstatus(text){
    const navbarTitle = document.getElementById('navbarTitle');
    navbarTitle.textContent = text;
}

let checkmessage=false;

const button = document.getElementById("toggleButton");

let gridItems = document.querySelectorAll('.grid-item');
let buttonsTest = document.querySelectorAll('.buttonTest');
let elements = document.querySelectorAll("#text10cm, #text30cm");

function toggleFunction() {
    if (button.innerText == "Scan") {
        requestBluetoothDevice();
    } else {
        tab1.style.display = "none";
        disconnect();
        requestBluetoothDevice();
        resetPageColor();
    }
}
function resetPageColor(){
    checkmessage=false;
    checkpopup = false;
    navbarTitle.style.color = "orange";
    document.getElementById("buttonText").innerText = "Scan";
    distanceValue.style.color = "#CCCCCC";
    textangle.style.color = "#CCCCCC";
    textangleLeft.style.color = "#CCCCCC";
    textangleRight.style.color = "#CCCCCC";
    testIRLineCalibration.style.color = "#CCCCCC";
    buttonsTest.forEach(item => {
    item.style.color = "#CCCCCC";
    });
    gridItems.forEach(item => {
        item.style.color = "#CCCCCC";
    });
    distanceValue.textContent="HC-SR04 Ultrasonic distance";
    distanceValue.style.fontSize = "13px";
    clearTimeout(Timeout10cm);
    clearTimeout(Timeout30cm);
    for(let i=0;i<12;i++){
        clearTimeout(Timeout1[i]);
        clearTimeout(Timeout0[i]);
        Lastcommand1[i] = true;
        Lastcommand0[i] = true;
        check0[i] = false;
        check1[i] = false;
    }
    angleLValue.textContent = '';
    angleRValue.textContent = '';
    gridItems.forEach(item => {
        item.style.border = "3px solid #CCCCCC";
    });
    buttonsTest.forEach(item => {
        item.style.border = "3px solid #CCCCCC";
    });
    elements.forEach(item => {
        item.style.color = "#CCCCCC";
    });
    slider.value=0;
    checksum= Array(12).fill(0);
    check0= Array(12).fill(0);
    check1= Array(12).fill(0);
    check10cm=false;
    check30cm=false;
    slidercontainer.style.border = "3px solid #CCCCCC ";
    element10cm.style.color = "#CCCCCC";
    element10cm.style.color = "#CCCCCC";
    resetBackground();
    checkClickDone = false;
    clearTimeout(timeoutCheckMessage);

    const resetElements = ["TB1A", "TB1B", "TB2A", "TB2B"];
    resetElements.forEach((id, index) => {
        let paragraph = document.getElementById(id).querySelector('p');
        paragraph.innerHTML = `${id}<br>0`; // Sử dụng <br> để xuống dòng
        CountTouch[index] = 0; // Đặt lại CountTouch cho các phần tử này
        checkCoutTouch[index] = true; // Đặt lại checkCoutTouch
    });
    threshold = Array(8).fill(map(100, 0, 768, 0, 255));
    checkTestObjectDemo = false;
    textGripperCalibration.style.color = "#CCCCCC";
    checkCalibrationGripper = false;
}

if(!checkmessage){
    distanceValue.style.color = "#CCCCCC";
    textangle.style.color = "#CCCCCC";
    textangleLeft.style.color = "#CCCCCC";
    textangleRight.style.color = "#CCCCCC";
    buttonsTest.forEach(item => {
        item.style.color = "#CCCCCC";
    });
    gridItems.forEach(item => {
        item.style.color = "#CCCCCC";
    });
    textGripperCalibration.style.color = "#CCCCCC";
}

let ir2L,ir0L,ir1R,ir3R,ir4L,ir6L,ir5R,ir7R,TB1A,TB1B,TB2A,TB2B,distance="",i,angleL,angleR;

const angleLValue = document.getElementById('textangleL');
const angleRValue = document.getElementById('textangleR');
const slidercontainer = document.getElementById('ctn-slider');
const slider = document.getElementById('distanceSlider');
const sliderbackground = document.getElementById('slider');
let element10cm = document.getElementById("text10cm");
let element30cm = document.getElementById("text30cm");

// Kiểm tra giá trị distance và thay đổi nội dung tương ứng
let check10cm=false,check30cm=false;
let Lastcommand10cm=true;
let Lastcommand30cm=true;
let Timeout10cm,Timeout30cm;
let checkArray = [];
let check0 = [];
let check1 = [];
let Timeout1 = [];
let Lastcommand1 =[];
let Timeout0 = [];
let Lastcommand0 =[];
for(let i = 0 ; i < 12; i++){
    Lastcommand1[i] = true;
    Lastcommand0[i] = true;
    check0[i] = false;
    check1[i] = false;
}
let checksum = []; 
let string="";
let stringfill;
let lineState="";
let stringcheck="";
let distanceInt;

let CountTouch = Array(4).fill(0);
let checkCoutTouch = Array(4).fill(true);
let arrString;

// Các id của IR và Touch trong Grid
const elementIds = [
    "TB1A", "TB1B", "TB2A", "TB2B", 
    "ir6L", "ir4L", "ir2L", "ir0L", 
    "ir1R", "ir3R", "ir5R", "ir7R"
];


// Initial Gripper Calibration
let old00L, old90L, old00R, old90R;
let Lvalue = document.getElementById('angleLvalueCali');
let Rvalue = document.getElementById('angleRvalueCali');
let Text_Area = document.getElementById('textareaCali');
let angleLvalue, angleRvalue;
let textButtonGripperCalibration = document.getElementById('textGripperCalibration');
let checkCalibrationGripper = false;
// End Initial Gripper Calibration

function handleChangedValue(event) {
    let data = event.target.value;
    let dataArray = new Uint8Array(data.buffer);
    let textDecoder = new TextDecoder('utf-8');
    let valueString = textDecoder.decode(dataArray);
    let n = valueString.length;
    if(valueString[n-1] == '\n'){
        string += valueString;
        arrString = string.split(/[ \t\r\n]+/);
        //Calibration Gripper
        let stringcheck = string[0] + string[1] + string[2] + string[3] + string[4];
        if(checkCalibrationGripper){
            if (stringcheck === "GetCa") {
                console.log("StringCalibration: " + string);
                handleAction(',Step1');
                let commaIndices = [];
                for (let i = 0; i < string.length; i++) {
                    if (string[i] === ',') {
                        commaIndices.push(i);
                    }
                }
                let leftBracketIndex = string.indexOf('(');
                let rightBracketIndex = string.indexOf(')');
                old00L = string.substring(leftBracketIndex + 1, commaIndices[0]);
                old90L = string.substring(commaIndices[0] + 2, commaIndices[1]);
                old00R = string.substring(commaIndices[1] + 2, commaIndices[2]);
                old90R = string.substring(commaIndices[2] + 2, rightBracketIndex);
                console.log("Gripper: " + old00L + "," + old90L + "," + old00R + "," + old90R);
            }
            if(arrString[0] === "degL" && arrString[3] === "degR"){
                angleLvalue = arrString[2];
                angleRvalue = arrString[5];

                if(angleLvalue !== Lvalue.value || angleRvalue !== Rvalue.value){
                    alert('WRONG MESSAGE!');
                }
            }
            else if(arrString[0] === 'TB1A'){
                Text_Area.value = `TB1A + TB1B touched. Calibration settings saved. Calibration Done. Please Rescan Leanbot`;
                Backbutton.style.display = "none";
                Cancelbutton.style.display = "none";
            }
            else if(string[0] === 'O'){
                Step1();
            }
            else if(string[0] === 'C'){
                Step2();
            }
            else if(stringcheck === 'SetCa'){
                Step3();
                console.log("Step3:" + string);
            }
            else if(arrString[0] === 'Touch'){
                Step4();
                console.log("Step4:" + string);
            }
        }
        // End Calibration Gripper
        else{
            if (arrString[0] == "TB" && arrString[3] == "IR" &&  !checkmessage) {
                console.log("Message correct.");
                send(".RemoteControl");
                checkmessage = true;
                clearTimeout(timeoutCheckMessage);// Hủy kết thúc sau 5 giây
                distanceValue.style.color  = "black";
                textangle.style.color      = "black";
                textangleLeft.style.color  = "black";
                textangleRight.style.color = "black";
                testIRLineCalibration.style.color = "black";
                buttonsTest.forEach(item => {
                    item.style.color = "black";
                });
                gridItems.forEach(item => {
                    item.style.removeProperty("color");
                });
                textGripperCalibration.style.color = "black";
            }

            let s = string.length;
            stringfill = string.substring(0,s-2);
            // console.log("Stringfill: " + stringfill);
            UpdateBorderButtonDemo();

            if(arrString[0] == "TB" && checkmessage){

                TB1A = parseInt(string[3]);                          checkArray[0]=TB1A;
                TB1B = parseInt(string[4]);                          checkArray[1]=TB1B;
                TB2A = parseInt(string[5]);                          checkArray[2]=TB2A;
                TB2B = parseInt(string[6]);                          checkArray[3]=TB2B;
                ir6L = compareThreshold(0);     checkArray[4]=ir6L;
                ir4L = compareThreshold(1);     checkArray[5]=ir4L;
                ir2L = compareThreshold(2);     checkArray[6]=ir2L;
                ir0L = compareThreshold(3);     checkArray[7]=ir0L;
                ir1R = compareThreshold(4);     checkArray[8]=ir1R;
                ir3R = compareThreshold(5);     checkArray[9]=ir3R;
                ir5R = compareThreshold(6);     checkArray[10]=ir5R;
                ir7R = compareThreshold(7);     checkArray[11]=ir7R;

                
                lineState = ir2L.toString() + ir0L.toString() + ir1R.toString() + ir3R.toString();

                if(lineState === '1111' || lineState === '0000'){
                    testFollowline.style.color = "#CCCCCC";
                }
                else{
                    testFollowline.style.color = "green";
                    if(checkAlertFollowLine){
                        AlertFollowLine.style.display = 'none';
                        checkClickDone = false;
                        runTest(
                            "Followline",
                            [
                            ".LineFollow",
                            toStr(threshold[2], 3),
                            toStr(threshold[3], 3),
                            toStr(threshold[4], 3),
                            toStr(threshold[5], 3),
                            ].join(' ')
                        );
                        checkAlertFollowLine = false;
                    }
                }
                
                for (let i = 0; i < 4; i++) {
                    let element = document.getElementById(elementIds[i]);
                    let paragraph = element.querySelector('p'); // Tìm phần tử <p> bên trong div
                
                    if (checkArray[i] === 1 && checkCoutTouch[i]) {
                        checkCoutTouch[i] = false;
                        CountTouch[i]++;
                        paragraph.innerHTML = elementIds[i] + "<br>" + CountTouch[i];
                    }
                    else if(checkArray[i] === 0){
                        checkCoutTouch[i] = true;
                    }
                    if(CountTouch[i] === 1){
                        element.style.border = "3px solid orange";
                    }
                    else if(CountTouch[i] === 3){
                        element.style.border = "3px solid green";
                        checksum[i] = 1;
                    }
                }

                for (let i = 4; i < 12; i++) {
                    let element = document.getElementById(elementIds[i]);
                    let paragraph = element.querySelector('p'); // Tìm phần tử <p> bên trong div

                    paragraph.innerHTML = elementIds[i] + "<br>" + arrString[i + 1];
                }
                // Comment chuyển màu viền của Touch
                for (let i = 4; i < elementIds.length; i++) {
                    let element = document.getElementById(elementIds[i]);
                    
                    handleBorderChange(i, element, check1, Lastcommand1, Timeout1, 1);
                    handleBorderChange(i, element, check0, Lastcommand0, Timeout0, 0);
                
                    if (check0[i] && check1[i]) {
                        checksum[i] = 1;
                        element.style.border = "3px solid green";
                    }
                }  

                distance = arrString[14];
                distanceInt = parseInt(distance); // Chuyển đổi thành số nguyên

                if(distanceInt > 50){
                    testObjectfollow.style.color = "#CCCCCC";
                }
                else{
                    if(checkTestObjectDemo){
                        alertBox.style.display = 'none';
                        checkClickDone = false;
                        runTest("Objectfollow",".Objectfollow");
                        checkTestObjectDemo = false;
                    }
                    testObjectfollow.style.color = "green";
                }

                angleL = arrString[18];
                angleR = arrString[19];
                angleLValue.textContent = `${angleL}°`;
                angleRValue.textContent = `${angleR}°`;

                Updateallbackground(); 

                if(!check10cm){
                    if(distance == '10'){
                        element10cm.style.color = "orange";
                    if(Lastcommand10cm){
                    Timeout10cm = setTimeout(() => {
                        element10cm.style.color = "green";
                        check10cm=true;
                    }, 3000);
                    }
                    Lastcommand10cm = false;
                    }
                    else{
                        element10cm.style.color = "#CCCCCC";
                        clearTimeout(Timeout10cm);
                        Lastcommand10cm=true;   
                    }
                }
            
                if(!check30cm){
                    if(distance == '30'){
                        element30cm.style.color = "orange";
                    if(Lastcommand30cm){
                    Timeout30cm = setTimeout(() => {
                        element30cm.style.color = "green";
                        check30cm=true;
                    }, 3000);
                    }
                    Lastcommand30cm=false;
                    }
                    else{
                        element30cm.style.color = "#CCCCCC";
                        clearTimeout(Timeout30cm);
                        Lastcommand30cm=true;   
                    }
                }
                if(check10cm && check30cm){
                    distanceValue.style.color = "green";
                    slidercontainer.style.border = "3px solid green ";
                }
                if (distance === "1000") {
                    distanceValue.textContent="HC-SR04 Ultrasonic distance";
                    distanceValue.style.fontSize = "13px";
                } else {
                    distanceValue.textContent = `${distance} cm`;
                    distanceValue.style.fontSize = "20px";
                }
                slider.value = distance;
            }
        }
        string="";
    }
    else{
        string+=valueString;
    }
    // console.log(checkButtonGreen + checksum + check10cm + check30cm);
    if(areAllElementsEqualToOne(checkButtonGreen) && areAllElementsEqualToOne(checksum) && check10cm && check30cm){
        navbarTitle.style.color = "green";
    }
}


let threshold = Array(8).fill(map(100, 0, 768, 0, 255));

function map(value, in_min, in_max, out_min, out_max) {
    return parseInt((value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
}

function compareThreshold(index) {
    let irValue = parseInt(arrString[index + 5]);
    threshold[index] = parseFloat((Math.min(threshold[index], irValue * 1.8))).toFixed(1);
    // console.log("Threshold " + index + ": " + threshold[index]);
    return irValue > threshold[index] ? 1 : 0;
}

function handleBorderChange(i, element, check, lastCommand, timeout, value) {
    if (!check[i]){
        if(checkArray[i] === value) {
        element.style.border = "3px solid orange";
        if (lastCommand[i]) {
            timeout[i] = setTimeout(() => {
                element.style.border = "3px solid #CCCCCC";
                check[i] = true;
            }, 2000);
        }
        lastCommand[i] = false;
        } else {
            clearTimeout(timeout[i]);
            lastCommand[i] = true;
        }
    }
}

let timeoutCheckMessage;

function checkMessageWithin5Seconds() {
    // Thiết lập hàm setTimeout để kết thúc sau 5 giây
    timeoutCheckMessage = setTimeout(function() {
        console.log("5 seconds timeout, message incorrect.");
        let infoBox = document.getElementById("infopopup");
        // Hiển thị info box
        infoBox.style.display = "block";
        document.addEventListener("click", function(event) {
            if (!infoBox.contains(event.target)) {
                infoBox.style.display = "none";
            }
        });
    }, 5000);
}

function updateBackground(id, value) {
    const element = document.getElementById(id);
    if (value === 0) {
        element.classList.remove('black');
        element.classList.add('white');
    } else {
        if(id == "TB1A" || id == "TB1B" || id == "TB2A" || id == "TB2B" ){
            element.classList.remove('white');
            element.classList.add('red');
        }
        else{
        element.classList.remove('white');
        element.classList.add('black');
        }
    }
}

function handleTimeoutCheck(check, array, lastCommand, timeout) {
    for (let i = 0; i < 12; i++) {
        if (!check[i]) {
            if (array[i] === '1') {
                if (lastCommand[i]) {
                    timeout[i] = setTimeout(() => {
                        check[i] = true;
                    }, 3000);
                }
                lastCommand[i] = false;
            } else {
                clearTimeout(timeout[i]);
                lastCommand[i] = true;
            }
        }
    }
}

function Updateallbackground(){
    updateBackground('ir2L', ir2L);
    updateBackground('ir0L', ir0L);
    updateBackground('ir1R', ir1R);
    updateBackground('ir3R', ir3R);
    updateBackground('ir4L', ir4L);
    updateBackground('ir6L', ir6L);
    updateBackground('ir5R', ir5R);
    updateBackground('ir7R', ir7R);
    updateBackground('TB1A', TB1A);
    updateBackground('TB1B', TB1B);
    updateBackground('TB2A', TB2A);
    updateBackground('TB2B', TB2B);
}

let checkButtonGreen = [0, 0, 0, 0, 0, 0, 0];

function UpdateBorderButtonDemo(){

    if(stringfill == 'Gripper'){
        element = document.getElementById("testGripper");
        element.style.border = "3px solid green";
        checkButtonGreen[0] = 1;
        checkClickDone = false;
    }
    if(stringfill == 'Motion'){
        element = document.getElementById("testMotor");
        element.style.border = "3px solid green";
        checkButtonGreen[1] = 1;
        checkClickDone = false;
    }
    if(stringfill == 'RGBLeds'){
        element = document.getElementById("testLed");
        element.style.border = "3px solid green";
        checkButtonGreen[2] = 1;
        checkClickDone = false;
    }
    if(arrString[0] == 'Buzzer'){
        element = document.getElementById("testBuzzer");
        element.style.border = "3px solid green"; 
        checkButtonGreen[3] = 1;
        checkClickDone = false;
    }
    if(stringfill == 'StraightMotion'){
        element = document.getElementById("testStraightMotion");
        element.style.border = "3px solid green"; 
        checkButtonGreen[4] = 1;
        checkClickDone = false;
    }
    if(arrString[0] == 'LineFollow'){
        element = document.getElementById("testFollowline");
        element.style.border = "3px solid green"; 
        checkButtonGreen[5] = 1;
        checkClickDone = false;
    }
    if(stringfill == 'Objectfollow'){
        element = document.getElementById("testObjectfollow");
        element.style.border = "3px solid green"; 
        checkButtonGreen[6] = 1;
        checkClickDone = false;
    }
}

function areAllElementsEqualToOne(arr) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== 1) {
        return false;
      }
    }
    return true;
  }

function resetBackground() {
    updateBackground('ir2L', 0);
    updateBackground('ir0L', 0);
    updateBackground('ir1R', 0);
    updateBackground('ir3R', 0);
    updateBackground('ir4L', 0);
    updateBackground('ir6L', 0);
    updateBackground('ir5R', 0);
    updateBackground('ir7R', 0);
    updateBackground('TB1A', 0);
    updateBackground('TB1B', 0);
    updateBackground('TB2A', 0);
    updateBackground('TB2B', 0);
}

let checkClickDone = false;
    // Thực hiện send và đổi màu viền khi click
function runTest(component, command){
    if(checkmessage && !checkClickDone){
        console.log("Command: " + command);
        send(command);
        element = document.getElementById("test" + component);
        element.style.border = "3px solid orange";
        checkClickDone = true;
        // resetBackground();
    }
}

let angleValues = ["0", "-30" , "120" , "90", "45"];

function sendAngle(nextAngleL, nextAngleR){ 
    if(!checkClickDone){
    send([".GripperLR", toStr(nextAngleL, 3), toStr(nextAngleR, 3)].join(' '));
    }
}

function buttonGripperLeft(){
    let currentIndexL = angleValues.indexOf(angleL);
    let nextIndexL = (currentIndexL + 1) % angleValues.length;
    sendAngle(angleValues[nextIndexL], angleR);
}

function buttonGripperRight(){
    let currentIndexR = angleValues.indexOf(angleR);
    let nextIndexR = (currentIndexR + 1) % angleValues.length;
    sendAngle(angleL, angleValues[nextIndexR]);
}

// Calibration  Gripper
function GripperCalibration() {
    if(checkmessage){
        if (tab1.style.display === "none" || tab1.style.display === "") {
            tab1.style.display = "block";  // Show the element if it's hidden
            resetPageColor();
            document.getElementById("buttonText").innerText = "Rescan";
            send(',GripperCalibration');
            checkCalibrationGripper = true;
            checkClickDone = true;
        } else {
            tab1.style.display = "none";   // Hide the element if it's visible
        }
    }
}


document.addEventListener('DOMContentLoaded', function() {
    const buttonSets = [
      { decrement: '.L0decrement', increment: '.L0increment', input: '.angleLvalueCali', step: 1 },
      { decrement: '.R0decrement', increment: '.R0increment', input: '.angleRvalueCali', step: 1 },
      { decrement: '.L90decrement', increment: '.L90increment', input: '.angleLvalueCali', step: 1 },
      { decrement: '.R90decrement', increment: '.R90increment', input: '.angleRvalueCali', step: 1 },
      { decrement: '.L0_5decrement', increment: '.L0_5increment', input: '.angleLvalueCali', step: 5 },
      { decrement: '.R0_5decrement', increment: '.R0_5increment', input: '.angleRvalueCali', step: 5 },
      { decrement: '.L90_5decrement', increment: '.L90_5increment', input: '.angleLvalueCali', step: 5 },
      { decrement: '.R90_5decrement', increment: '.R90_5increment', input: '.angleRvalueCali', step: 5 },
    ];
  
    buttonSets.forEach(({ decrement, increment, input, step}) => {
      const decrementBtn = document.querySelector(decrement);
      const incrementBtn = document.querySelector(increment);
      const quantityInput = document.querySelector(input);
      let intervalId;
  
      decrementBtn.addEventListener('pointerdown', startDecrement);
      decrementBtn.addEventListener('click', decrementValue);
      decrementBtn.addEventListener('pointerleave', stopDecrement);
      decrementBtn.addEventListener('pointerup', stopDecrement);
  
      incrementBtn.addEventListener('pointerdown', startIncrement);
      incrementBtn.addEventListener('click', incrementValue);
      incrementBtn.addEventListener('pointerleave', stopIncrement);
      incrementBtn.addEventListener('pointerup', stopIncrement);
      
  
      function startDecrement(event) {
        intervalId = setInterval(() => decrementValue(event), 400);
      }
  
      function stopDecrement() {
        clearInterval(intervalId);
      }
  
      function startIncrement(event) {
        intervalId = setInterval(() => incrementValue(event), 400);
      }
  
      function stopIncrement() {
        clearInterval(intervalId);
      }
      
      function decrementValue(event) {
        let currentValue = parseInt(quantityInput.value);
        quantityInput.value = currentValue - step;
        sendLR();
      }
  
      function incrementValue(event) {
        let currentValue = parseInt(quantityInput.value);
        quantityInput.value = currentValue + step;
        sendLR();
      }
    });
});

function handleAction(action) {
    send(action);
}

function sendLR(){
    send (',LR' + ' ' + Lvalue.value + ' ' + Rvalue.value);
}

let Step = 0;

function Next() {
    console.log("Step: " + Step);
    if(Step == 1){
        handleAction(',Step2');
    }
    else if(Step == 2){
        handleAction(',Step3');
    }
    else if(Step == 3){
        handleAction(',Step4');
    }
}

function Step1(){
    Step = 1;
    document.getElementById("Next").innerText = "Next";
    Text_Area.value = "Step 1/4: Adjust both gripper arms to proper 0° position (pointing down)";
    Rvalue.value = old00R;
    Lvalue.value = old00L;
    sendLR();
    toggleDisplayForElements(["R0increment", "R0decrement", "L0increment", "L0decrement",
                            "R0_5increment", "R0_5decrement", "L0_5increment", "L0_5decrement"], "block");
    toggleDisplayForElements(["R90increment", "R90decrement", "L90increment", "L90decrement",
                            "R90_5increment", "R90_5decrement", "L90_5increment", "L90_5decrement"], "none");
    toggleDisplayForElements(["Next"], "block");
}

function Step2(){
    Step = 2;
    document.getElementById("Next").innerText = "Next";
    Text_Area.value = "Step 2/4: Adjust both gripper arms to proper 90° position (pointing horizontally)";
    toggleDisplayForElements(["R90increment", "R90decrement", "L90increment", "L90decrement",
                               "R90_5increment", "R90_5decrement", "L90_5increment", "L90_5decrement" ], "block");
    toggleDisplayForElements(["R0increment", "R0decrement", "L0increment", "L0decrement", 
                              "R0_5increment", "R0_5decrement", "L0_5increment", "L0_5decrement"], "none");
    Rvalue.value = old90R;
    Lvalue.value = old90L;
    sendLR();
}

function Step3(){
    Step = 3;
    document.getElementById("Next").innerText = "Save";
    Text_Area.value = "Step 3/4: Observe gripper open and close correctly";
    toggleDisplayForElements(["R90increment", "R90decrement", "L90increment", "L90decrement",
                              "R90_5increment", "R90_5decrement", "L90_5increment", "L90_5decrement" ], "none");
}

function Step4(){
    Step = 4;
    Text_Area.value = "Step 4/4: Touch TB1A + TB1B to permanently save calibration settings";
    document.getElementById("Next").innerText = "Done";
    toggleDisplayForElements(["Next"], "none");
}

function toggleDisplayForElements(elementIds, displayValue) {
    elementIds.forEach(function(id) {
        let element = document.getElementById(id);
        if (element) {
            element.style.display = displayValue;
        }
    });
}

function Back() {
    if(Step == 3){
        handleAction(',Step2');
    }
    else if(Step == 2){
        handleAction(',Step1');
    }
    else if(Step == 4){
        handleAction(',Step3');
    }
}

function Cancel(){
    tab1.style.display = "none";
    checkCalibrationGripper = false;
    checkClickDone = false;
}

let MarioRTTTL = "mario:d=4,o=5,b=100:16e6,16e6,32p,8e6,16c6,8e6,8g6,8p,8g,8p,8c6,16p,8g,16p,8e,16p,8a,8b,16a#,8a,16g.,16e6,16g6,8a5,16f6,8g6,8e6,16c6,16d6,8b,16p,8c6,16p,8g,16p,8e,16p,8a,8b,16a#,8a,16g.,16e6,16g6,8a5,16f6,8g6,8e6,16c6,16d6,8b,8p,16g6,16f#6,16f6,16d#6,16p,16e6,16p,16g#,16a,16c6,16p,16a,16c6,16d6,8p,16g6,16f#6,16f6,16d#6,16p,16e6,16p,16c7,16p,16c7,16c7,p,16g6,16f#6,16f6,16d#6,16p,16e6,16p,16g#,16a,16c6,16p,16a,16c6,16d6,8p,16d#6,8p,16d6,8p,16c6";
function TestBuzzer(){
    runTest("Buzzer", ".Buzzer " + MarioRTTTL);
}

function TestGripper(){
    runTest("Gripper", ".Gripper");
}

function TestLed(){
    runTest("Led", ".RGBLeds");
}

function TestMotor(){
    runTest("Motor", ".Motion");
}

let AlertFollowLine = document.getElementById('customAlertFollowLine');
let checkAlertFollowLine = false;

function TestLineFollow(){
    if(checkmessage){
        if(lineState !== '1111' && lineState !== '0000'){
            runTest(
                "Followline",
                [
                  ".LineFollow",
                  toStr(threshold[2], 3),
                  toStr(threshold[3], 3),
                  toStr(threshold[4], 3),
                  toStr(threshold[5], 3),
                ].join(' ')
            );     
        }
        else{
            AlertFollowLine.style.display = 'block';
            checkClickDone = true;
            checkAlertFollowLine = true;
        }
    }
}

function TestStraightMotion(){
    runTest("StraightMotion",".StraightMotion");
}

let checkTestObjectDemo = false;
let alertBox = document.getElementById('customAlert');

function TestObjectfollow(){

    if(checkmessage){
        if(distanceInt <= 50){
            // Chạy khi khoảng cách đúng
            runTest("Objectfollow",".Objectfollow");
            
            // Ẩn thông báo nếu đang hiển thị
           
        }
        else{
            // Hiển thị thông báo khi khoảng cách không đạt yêu cầu
            alertBox.style.display = 'block';
            checkTestObjectDemo = true;
            checkClickDone = true;
        }
    }
}


function TestIRLineCalibration(){
    if(checkmessage){
    send(".IRLine");
    }
}

function toStr(value, length) {
    // Chuyển đổi giá trị thành số nguyên
    const intValue = parseInt(value);
    
    // Chuyển đổi số nguyên thành chuỗi và thêm số 0 ở phía trước nếu độ dài của chuỗi nhỏ hơn `length`
    return String(intValue).padStart(length, '0');
}

function closeCustomAlert() {
    document.getElementById('customAlert').style.display = 'none';
    checkClickDone = false;
    checkTestObjectDemo = false;
}

function closeCustomAlertFollowLine() {
    document.getElementById('customAlertFollowLine').style.display = 'none';
    checkClickDone = false;
    checkAlertFollowLine = false;
}

function closeAlertErrorCode(){
    document.getElementById('infopopup').style.display = 'none';
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