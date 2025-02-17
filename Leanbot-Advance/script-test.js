var bleService = '0000ffe0-0000-1000-8000-00805f9b34fb';
var bleCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';
var gattCharacteristic;
var bluetoothDeviceDetected;

let Text_Area = document.getElementById("textareaNotification");
let Text_RGBLeds = document.getElementById("textAreaRGB");
let Text_Steppers = document.getElementById("textAreaStepper");

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
        logstatus(dev.name + " - Advance Modules");
        checkMessageWithin5Seconds();
        document.getElementById("buttonText").innerText = "Rescan";
        checkconnected = true;
        gattCharacteristic = characteristic
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

function disconnect()
{
    logstatus("SCAN to connect");
    console.log("Disconnected from: " + dev.name);
    return dev.gatt.disconnect();
}

function onDisconnected(event) {
    const device = event.target;
    logstatus("SCAN to connect");
    ResetVariables();
    document.getElementById("buttonText").innerText = "Scan";
    console.log(`Device ${device.name} is disconnected.`);
}

function send(data){
    console.log("You -> " + data + "\n");
    gattCharacteristic.writeValue(str2ab(data+"\n"));
}

function str2ab(str){
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

let checkconnected = false;

const button = document.getElementById("toggleButton");

function toggleFunction() {
    if (button.innerText == "Scan") {
        requestBluetoothDevice();
    } else {
        disconnect();
        requestBluetoothDevice();
        Rescan();
    }
}

function Rescan(){
    ResetVariables();
}

function ResetVariables(){
    checkconnected = false;
    clearTimeout(timeoutId);
    checkFirstValue = true;
    checkmessageMPU6050 = false;
    checkmessageAPDS9960 = false;
    clearTimeout(timeoutCheckMessage);
    textAreaAPDS.value = "";
    textAreaMPU.value = "";
    textAreaMAX.value = "";
    TextAreaGesture.value = "";
    TextAreaMean.value = "";

    TextAreaProximity.value = "";
    TextAreaTemperature.value = "";

    TextAreaMinMean.value = "";
    TextAreaMaxMean.value = "";
    R.textContent = "";
    G.textContent = "";
    B.textContent = "";
    C.textContent = "";
    Ax.textContent = "";
    Ay.textContent = "";
    Az.textContent = "";
    Gx.textContent = "";
    Gy.textContent = "";
    Gz.textContent = "";
    Qx.textContent = "";
    Qy.textContent = "";
    Qz.textContent = "";
    Qw.textContent = "";
    coutUP = 0;
    countDOWN = 0;
    countLEFT = 0;
    countRIGHT = 0;
    smoothVolume = 0;
    minVolume = 0;
    RGBmax = 0;
    Cmax = 0;
}

let string = "";
let textAreaAPDS = document.getElementById("textAreaAPDS");
let textAreaMPU = document.getElementById("textAreaMPU");
let textAreaMAX = document.getElementById("textAreaMAX");
let TextAreaGesture = document.getElementById("textAreaGesture");
let TextAreaMean = document.getElementById("textAreaMean");
let TextAreaVariance = document.getElementById("textAreaVariance");
let TextAreaMinVariance = document.getElementById("textAreaMinVariance");
let TextAreaMaxVariance = document.getElementById("textAreaMaxVariance");
let TextAreaMinMean = document.getElementById("textAreaMinMean");
let TextAreaMaxMean = document.getElementById("textAreaMaxMean");

let TextAreaProximity = document.getElementById("proximityValue");
let TextAreaTemperature = document.getElementById("textAreaTemp");

let R = document.getElementById("R");
let G = document.getElementById("G");
let B = document.getElementById("B");
let C = document.getElementById("C");
let Ax = document.getElementById("Ax");
let Ay = document.getElementById("Ay");
let Az = document.getElementById("Az");
let Gx = document.getElementById("Gx");
let Gy = document.getElementById("Gy");
let Gz = document.getElementById("Gz");
let Qx = document.getElementById("Qx");
let Qy = document.getElementById("Qy");
let Qz = document.getElementById("Qz");
let Qw = document.getElementById("Qw");

let stringcheck = "";
let timeoutId;

let arrMean = [10];
// let arrVariance = [10];

let checkFirstValue = true;
let minMean, maxMean, minVariance, maxVariance;
let timeoutCheckMessage;
let checkmessageMPU6050 = false;
let checkmessageAPDS9960 = false;
// Ensure gauge.js library is loaded
var opts = {
    colorStart: "#6fadcf",
    colorStop: void 0,
    gradientType: 0,
    strokeColor: "#e0e0e0",
    generateGradient: true,
    percentColors: [[0.0, "#a9d70b"], [0.50, "#f9c802"], [1.0, "#ff0000"]],
    pointer: {
      length: 0.58,
      strokeWidth: 0.035,
      iconScale: 1.0
    },
    staticLabels: {
      font: "10px sans-serif",
      labels: [10, 20, 30],
      fractionDigits: 0
    },
    staticZones: [
        { strokeStyle: "#FFA500", min: 0, max: 20 },  // Cam (Orange)
        { strokeStyle: "#FFFF00", min: 20, max: 30 }, // Vàng (Yellow)
        { strokeStyle: "#30B32D", min: 30, max: 40 }  // Xanh Lá (Green)
    ],      
    angle: 0.033,
    lineWidth: 0.30,
    radiusScale: 1.0,
    fontSize: 40,
    highDpiSupport: true
};

// Khởi tạo gauge
var target = document.getElementById('demo'); 
var gauge = new Gauge(target).setOptions(opts);

// Gán trường văn bản hiển thị giá trị
document.getElementById("preview-textfield").className = "preview-textfield";
// gauge.setTextField(document.getElementById("preview-textfield"));

// Thiết lập giá trị của gauge
gauge.maxValue = 40;
gauge.setMinValue(0);
gauge.set(0);

// Thiết lập tốc độ chuyển động
gauge.animationSpeed = 32;

let volume;
let minVolume;
let smoothVolume = 0;
let needCalibration = true;

let gyroXerror = 19.5;
let gyroYerror = 10.0;
let gyroZerror = 1.8;

let maxGxError = 0;
let maxGyError = 0;
let maxGzError = 0;
const progressProx = document.getElementById('progressProx');

let countUP = 0, countDOWN = 0, countLEFT = 0, countRIGHT = 0;
let RGBmax = 0, Cmax = 0;


function handleChangedValue(event) {
    let data = event.target.value;
    let dataArray = new Uint8Array(data.buffer);
    let textDecoder = new TextDecoder('utf-8');
    let valueString = textDecoder.decode(dataArray);
    let n = valueString.length;
    if(valueString[n-1] === '\n'){
        string += valueString;
        // console.log(string);
        let arrString = string.split(/[ \t\r\n]+/);
        let stringvolume = string.substring(string.indexOf(' ') + 1, string.length-1);
    
        if(checkmessageMPU6050 && checkmessageAPDS9960){
            clearTimeout(timeoutCheckMessage);
        }
        if(arrString[0] === 'MAX4466'){
            let arr2Int = parseInt(arrString[2]);
            let Variance = parseInt(arrString[4]);
            if(checkFirstValue){
                minMean = arr2Int;
                maxMean = arr2Int;
                minVariance = Variance;
                maxVariance = Variance;
                checkFirstValue = false;
                minVolume = 10 * Math.log10(Variance);
            }
            if(arr2Int < minMean){
                minMean = arr2Int;
            }
            if(arr2Int > maxMean){
                maxMean = arr2Int;
            }
            if(Variance < minVariance){
                minVariance = Variance;
            }
            if(Variance > maxVariance){
                maxVariance = Variance;
            }

            TextAreaMinVariance.value = minVariance;
            TextAreaMaxVariance.value = maxVariance;

            TextAreaMinMean.value = minMean;
            TextAreaMaxMean.value = maxMean;

            textAreaMAX.value = stringvolume;
            TextAreaMean.value = arrString[2];
            TextAreaVariance.value = arrString[4];
            if(arrString[4] === '0') {
                if(!checkFirstValue) {
                    textAreaMAX.value = "Not plugged in";
                }
                TextAreaMean.value = "";
                TextAreaMinMean.value = "";
                TextAreaMaxMean.value = "";
                checkFirstValue = true;
                // Cập nhật màu cung tròn thành xám
                gauge.options.staticZones = [
                    { strokeStyle: "#808080", min: 0, max: gauge.maxValue } // Cả cung tròn có màu xám
                ];
            }
            else{
                gauge.options.staticZones = [
                    { strokeStyle: "#FFA500", min: 0, max: 20 },  // Cam (Orange)
                    { strokeStyle: "#FFFF00", min: 20, max: 30 }, // Vàng (Yellow)
                    { strokeStyle: "#30B32D", min: 30, max: 40 }  // Xanh Lá (Green)
                ];
            }
            if (Variance > 0) {
                volume = 10 * Math.log10(Variance);
            } else {
                volume = 0;
            }
            smoothVolume += (volume - smoothVolume) / 8;

            if(smoothVolume < minVolume) {
                minVolume = smoothVolume;
            }            
            // console.log("minVolume: " + minVolume.toFixed(1));
            // Hiển thị giá trị đã làm tròn trên giao diện
            document.getElementById("preview-textfield").textContent = smoothVolume.toFixed(1);
            
            // Cập nhật gauge với giá trị không làm tròn để mượt mà hơn
            gauge.set(smoothVolume);            
        }

        if(arrString[0] === 'MPU6050'){
            checkmessageMPU6050 = true;
            textAreaMPU.value = stringvolume;
            if(arrString[2] !== "error" && arrString[2] !== "ok") {

            Ax.textContent = arrString[2];
            Ay.textContent = arrString[3];
            Az.textContent = arrString[4];
            Gx.textContent = arrString[6];
            Gy.textContent = arrString[7];
            Gz.textContent = arrString[8];

            TextAreaTemperature.value = arrString[15] + "°C";

            if(arrString[9] === 'Qwxyz' ) {
            let w, x, y, z;
            let scaleFactor = 16384.0;  

            w = parseFloat(arrString[10]) / scaleFactor;
            x = parseFloat(arrString[11]) / scaleFactor;
            y = parseFloat(arrString[12]) / scaleFactor;
            z = parseFloat(arrString[13]) / scaleFactor;     

            Qw.textContent = w.toFixed(2);
            Qx.textContent = x.toFixed(2);
            Qy.textContent = y.toFixed(2);
            Qz.textContent = z.toFixed(2);        

            var quaternion = new THREE.Quaternion(-x, z, y, w);
            cube.quaternion.copy(quaternion);
            renderer.render(scene, camera);
             }
            }
        }
        
        if(arrString[0] === 'APDS9960'){
            checkmessageAPDS9960 = true;
            if (arrString[1] === 'gesture' || arrString[8] === 'gesture') {
                let gesture = "";
                if(arrString[1] === 'gesture') gesture = arrString[2];
                else gesture = arrString[9];

                const btnUp = document.getElementById('btnUp');
                const btnLeft = document.getElementById('btnLeft');
                const btnRight = document.getElementById('btnRight');
                const btnDown = document.getElementById('btnDown');

                btnUp.style.transition = 'none'; 
                btnLeft.style.transition = 'none';
                btnRight.style.transition = 'none';
                btnDown.style.transition = 'none';
               
                if (gesture === 'UP') {
                    btnUp.style.backgroundColor = 'red'; // Đặt màu đỏ ngay lập tức
                    countUP++;
                
                    let paragraph = btnUp.querySelector('h5');
                    if (paragraph) {
                        paragraph.innerHTML = "UP" + "<br>" + countUP;
                    }
                
                    // Sau 2 giây, bắt đầu mờ dần
                    setTimeout(() => {
                        btnUp.style.transition = 'background-color 5s ease'; // Thêm hiệu ứng mờ dần
                        btnUp.style.backgroundColor = 'transparent'; // Chuyển dần sang trong suốt
                    }, 1000);
                
                    console.log("UP");
                }
                
                else if (gesture === 'LEFT') {
                    btnLeft.style.backgroundColor = 'red';
                    countLEFT++;
                    let paragraph = btnLeft.querySelector('h5');
                    paragraph.innerHTML = "LEFT" + "<br>" + countLEFT;

                    setTimeout(() => {
                        btnLeft.style.transition = 'background-color 5s ease'; // Thêm hiệu ứng mờ dần
                        btnLeft.style.backgroundColor = 'transparent';
                    }, 1000);
                    console.log("LEFT");
                } else if (gesture === 'RIGHT') {
                    btnRight.style.backgroundColor = 'red';
                    countRIGHT++;
                    let paragraph = btnRight.querySelector('h5');
                    paragraph.innerHTML = "RIGHT" + "<br>" + countRIGHT;

                    setTimeout(() => {
                        btnRight.style.transition = 'background-color 5s ease'; // Thêm hiệu ứng mờ dần
                        btnRight.style.backgroundColor = 'transparent';
                    }, 1000);
                    console.log("RIGHT");
                } else if (gesture === 'DOWN') {
                    btnDown.style.backgroundColor = 'red';
                    countDOWN++;
                    let paragraph = btnDown.querySelector('h5');
                    paragraph.innerHTML = "DOWN" + "<br>" + countDOWN;

                    setTimeout(() => {
                        btnDown.style.transition = 'background-color 5s ease'; // Thêm hiệu ứng mờ dần
                        btnDown.style.backgroundColor = 'transparent';
                    }, 1000);
                    console.log("DOWN");
                }
            } 
            else{
            textAreaAPDS.value = stringvolume;
            if(arrString[2] !== "error" && arrString[2] !== "ok"){
            R.textContent = arrString[2];
            G.textContent = arrString[3];
            B.textContent = arrString[4];
            C.textContent = arrString[5];
            progressProx.value = arrString[7];
            document.getElementById("proximityValue").innerText = arrString[7];

            let rValue = parseInt(arrString[2]);
            let gValue = parseInt(arrString[3]);
            let bValue = parseInt(arrString[4]);

            if(rValue > RGBmax) RGBmax = rValue;
            if(gValue > RGBmax) RGBmax = gValue;
            if(bValue > RGBmax) RGBmax = bValue;
            
            let cValue = parseInt(arrString[5]);
            if(cValue > Cmax) Cmax = cValue;
            let cDisplay = mapValue(cValue, 0, Cmax, 0, 255);
            C_Square.style.backgroundColor = `rgb(${cDisplay}, ${cDisplay}, ${cDisplay})`;

            let rDisplay = mapValue(rValue, 0, RGBmax, 0, 255);
            let gDisplay = mapValue(gValue, 0, RGBmax, 0, 255);
            let bDisplay = mapValue(bValue, 0, RGBmax, 0, 255);

            colorSquare.style.backgroundColor = `rgb(${rDisplay}, ${gDisplay}, ${bDisplay})`;
            }
            }
        }
        if(checkmessageMPU6050 && checkmessageAPDS9960){
            clearTimeout(timeoutCheckMessage);
        }
        string = "";
    }
    else{
        string += valueString;     
    }
}

function mapValue(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function handleAction(action) {
    if (checkconnected) {
        send(action);
    }
}

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

function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.content');
    
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    contents.forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    document.getElementById('tab' + tabId.slice(-1)).classList.add('active');
}

var tabs = document.querySelectorAll('.tab');

// Add event listener to each tab
tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
        // Remove active class from all tabs
        tabs.forEach(function(tab) {
            tab.classList.remove('active');
        });

        // Add active class to clicked tab
        this.classList.add('active');
    });
});

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

let scene, camera, renderer, cube;

function parentWidth(elem) {
  return elem.parentElement.clientWidth;
}

function parentHeight(elem) {
  return elem.parentElement.clientHeight;
}

function init3D(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  camera = new THREE.PerspectiveCamera(75, parentWidth(document.getElementById("3Dcube")) / parentHeight(document.getElementById("3Dcube")), 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(parentWidth(document.getElementById("3Dcube")), parentHeight(document.getElementById("3Dcube")));

  document.getElementById('3Dcube').appendChild(renderer.domElement);

  // Tạo hình khối (geometry) và vật liệu
  const geometry = new THREE.BoxGeometry(12/4, 7/4, 18/4);

  var cubeMaterials = [
    new THREE.MeshBasicMaterial({color: 0xff0000}),  // Đỏ
    new THREE.MeshBasicMaterial({color: 0x00ff00}),  // Xanh lá cây
    new THREE.MeshBasicMaterial({color: 0x0000ff}),  // Xanh dương
    new THREE.MeshBasicMaterial({color: 0xffff00}),  // Vàng
    new THREE.MeshBasicMaterial({color: 0xff00ff}),  // Tím
    new THREE.MeshBasicMaterial({color: 0x00ffff})   // Xanh dương nhạt (cyan)
  ];

  const material = new THREE.MeshFaceMaterial(cubeMaterials);

  // Tạo đối tượng cube và thêm vào scene
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  camera.position.set(4, 3, -4); 
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

// Hàm thay đổi kích thước đối tượng 3D khi cửa sổ thay đổi kích thước
function onWindowResize(){
  camera.aspect = parentWidth(document.getElementById("3Dcube")) / parentHeight(document.getElementById("3Dcube"));
  camera.updateProjectionMatrix();
  renderer.setSize(parentWidth(document.getElementById("3Dcube")), parentHeight(document.getElementById("3Dcube")));
}

window.addEventListener('resize', onWindowResize, false);

// Khởi tạo mô hình 3D
init3D();