function logstatusWebName(text){
    logstatus(text + " - IoT Modules");
    enableButtons();
}

function resetVariable(){
    SoilMoisture_isFirstRead = true;
    SoilMoisture_IntMin = 1023;
    SoilMoisture_IntMax = 0;
    SoilMoisture_checkInitError = false;
    MAX30102_checkInitError = false;
    BME280_isFirstRead = true;
    checkMsg = false;
    disableButtons();
    clearTextArea();
    clearTimeout(timeoutCheckMessage);
    document.querySelectorAll('.item').forEach(item => {
        item.classList.remove('active');
    });
    UI('HCSR501_Square').style.backgroundColor = "transparent";
    UI('MAX30102_Square').style.backgroundColor = "transparent";
    UI('SoilMoisture_Progress').value = 0;
}

const buttons = document.querySelectorAll('.btn-primary-test');
buttons.forEach(button => {
    button.disabled = true;
});

function enableButtons() {
    buttons.forEach(button => {
        button.disabled = false;
    });
}

function disableButtons() {
    buttons.forEach(button => {
        button.disabled = true;
    });
}

function clearTextArea() {
    const textAreas = [
        'HCSR501_TextArea', 'OLED_TextArea', 'SoilMoisture_TextArea', 'BME280_TextArea', 'WiFi_TextArea', 'MAX30102_TextArea', 
        'BME280_TextArea_Tem', 'BME280_TextArea_Hum', 'BME280_TextArea_Pres', 'BME280_TextArea_RelAlt', 'SoilMoisture_TextArea_Min',
        'SoilMoisture_TextArea_Max', 'SoilMoisture_TextArea_Range', 'MAX30102_TextArea_Beat', 'MAX30102_TextArea_BPM',
        'WiFi_TextArea_PasswordfromWeb', 'WiFi_TextArea_SSIDfromWeb', 'WiFi_TextArea_UTCTime', 'WiFi_TextArea_BrowserTimeZone', 'WiFi_TextArea_LocalTime' 
    ];
    // Reset value for each TextArea
    textAreas.forEach(id => {
        if (UI(id)) {
            UI(id).value = "";
        }
    });
}

function handleSerialLine(line) {
    if (! line) return;
    console.log("line: " + line);

    checkCodefromLeanbot(line);

    const arrString = line.split(/[ \t]+/);
    switch(arrString[0]) {
        case 'HC-SR501'      : return HCSR501_handle(arrString);
        case 'OLED'          : return OLED_handle(arrString);
        case 'SoilMoisture'  : return SoilMoisture_handle(arrString);
        case 'BME280'        : return BME280_handle(arrString);
        case 'Connecting'    :
        case 'WiFi'          : return WiFi_handle(arrString);
        case 'MAX30102'      : return MAX30102_handle(arrString);
        default              : console.log("Unknown message type");
    }
}

const msgFromLeanbot = "Test IoT Modules";
let checkMsg = false;

function checkCodefromLeanbot(line) { 
    if (line !== msgFromLeanbot || checkMsg) return;
    clearTimeout(timeoutCheckMessage);
    checkMsg = true;
    console.log("Correct message.");
} 

//********HC-SR501********//
function HCSR501_handle(arrString) {
    UI('HCSR501_TextArea').value = arrString[1];
    if (arrString[1] === '1') UI('HCSR501_Square').style.backgroundColor = "red";
    else UI('HCSR501_Square').style.backgroundColor = "white";
}

function HCSR501_button(){
    send("HC-SR501 Test");
}

//********OLED********//
function OLED_handle(arrString) {
    UI('OLED_TextArea').value = arrString.slice(1, arrString.length).join(' ');
    if (arrString[2] !== 'Error') return;
    UI('OLED-button').disabled = true; 
    UI('OLED-button').textContent = "Not detected";
}

function OLED_button(){
    send("OLED Test");
    UI('OLED_TextArea').value = "Observe the OLED screen";
}

//********SoilMoisture********//
let SoilMoisture_isFirstRead = true;
let SoilMoisture_IntMin = 1023;
let SoilMoisture_IntMax = 0;
let SoilMoisture_checkInitError = false;

function SoilMoisture_handle(arrString) {
    if (SoilMoisture_checkInitError) return;
    UI('SoilMoisture_TextArea').value = arrString.slice(1, arrString.length).join(' ');
    if (arrString[1] === 'Init') {
        if (arrString[2] === 'Error')   {
            UI('SoilMoisture-button').disabled = true;
            UI('SoilMoisture-button').textContent = "Not detected";
            SoilMoisture_checkInitError = true;
        }
        return;
    }

    const moistureValue = parseInt(arrString[1]);
    SoilMoisture_IntMin = Math.min(SoilMoisture_IntMin, moistureValue);
    SoilMoisture_IntMax = Math.max(SoilMoisture_IntMax, moistureValue);

    // UI('SoilMoisture_TextArea').value = "Init Ok";
    // UI('SoilMoisture_TextArea').value = moistureValue;
    UI('SoilMoisture_Progress').value = moistureValue;
    UI('SoilMoisture_TextArea_Min').value = SoilMoisture_IntMin;
    UI('SoilMoisture_TextArea_Max').value = SoilMoisture_IntMax;
    UI('SoilMoisture_TextArea_Range').value = SoilMoisture_IntMax - SoilMoisture_IntMin;
    UI('SoilMoisture-button').disabled = false;
}

function SoilMoisture_button() {
    send("SoilMoisture Test");
    SoilMoisture_IntMin = 1023;
    SoilMoisture_IntMax = 0;
}

//********BME280********//
let BME280_isFirstRead = true;
let BME280_RelAltRef;
let BME280_CountValue = 0;
let BME280_SumAlt = 0;

function BME280_handle(arrString) {
    UI('BME280_TextArea').value = arrString.slice(1, arrString.length).join(' ');

    if(arrString[1] === 'Init') {
        if(arrString[2] === 'Error') {
            UI('BME280-button').disabled = true;
            UI('BME280-button').textContent = "Not detected";
        }
        return;
    }

    UI('BME280_TextArea_Tem').value  = `${parseFloat(arrString[2]).toFixed(1)}  °C `;
    UI('BME280_TextArea_Hum').value  = `${parseFloat(arrString[4]).toFixed(1)}  %  `;
    UI('BME280_TextArea_Pres').value = `${arrString[6]} hPa`;
    let BME280_ALtRawFloat = parseFloat(arrString[8]);

    if(BME280_isFirstRead){
        BME280_SumAlt += BME280_ALtRawFloat;
        if(++BME280_CountValue === 10){
            BME280_RelAltRef = BME280_SumAlt / 10;
            BME280_isFirstRead = false;
        }
        console.log("BME280_SumAlt: " + BME280_SumAlt);
    }
    else UI('BME280_TextArea_RelAlt').value = `${(BME280_ALtRawFloat - BME280_RelAltRef).toFixed(2)} m  `;
}

function BME280_button(){
    send("BME280 Test");
    BME280_isFirstRead = true;
    BME280_CountValue = 0;
    BME280_SumAlt = 0;
}

//********WiFi********//
function WiFi_handle(arrString) {
    if(arrString[1] === 'to' || arrString[1] === 'Init') {
       if(arrString[3] === 'module') UI('WiFi_TextArea').value = arrString.join(" ") + '\n'; // Ex: Msg = "Connecting to WiFi module ... OK"
       else if (arrString[3] === 'network') UI('WiFi_TextArea').value += arrString.join(" ") + '\n'; // Ex: Msg = "Connecting to WiFi network X ... OK"
       else UI('WiFi_TextArea').value += arrString.join(" "); // Ex: Msg = "WiFi Init Ok"
       return;
    }

    UI('WiFi_TextArea_UTCTime').value = arrString[3].replace('T', ' ').replace('Z', '');
    const utcDate = new Date(arrString[3]);  
    const parts = utcDate.toString().split(' ');  
    if (parts[5]) {
        UI('WiFi_TextArea_BrowserTimeZone').value = parts[5].substring(3, 8);
    }

    // Tính toán giờ địa phương
    const localTime = utcDate.toLocaleString('en-GB', { hour12: false });  
    let [datePart, timePart] = localTime.split(', '); // Tách ngày giờ : "10/11/2021, 10:10:10"
    datePart = datePart.replace(/\//g, '-');          // Thay thế '/' bằng '-' : "10-11-2021"
    const [day, month, year] = datePart.split('-');  // Tách ngày, tháng, năm thành mảng : ["10", "11", "2021"]
    const formattedDate = `${year}-${month}-${day}`; // Định dạng ngày Ex: "2021-11-10"
    const formattedLocalTime = `${formattedDate} ${timePart}`; // Kết hợp ngày và giờ : "2021-11-10 10:10:10"

    UI('WiFi_TextArea_LocalTime').value = formattedLocalTime;
}

async function WiFi_button(){
    if(UI('WiFi_TextArea_SSIDfromWeb').value === "" || UI('WiFi_TextArea_PasswordfromWeb').value === ""){
        UI('WiFi_TextArea').value = "Input WiFi SSID and Password to Test WiFi";
        return;
    }

    await send("WiFi Password "+ UI('WiFi_TextArea_PasswordfromWeb').value);
    await send("WiFi Connect " + UI('WiFi_TextArea_SSIDfromWeb').value);

    UI('WiFi_TextArea').value = "";
    UI('WiFi_TextArea_UTCTime').value = "";
    UI('WiFi_TextArea_BrowserTimeZone').value = "";
    UI('WiFi_TextArea_LocalTime').value = "";
    UI('WiFi_TextArea').value = "Connecting ...";
}

//********MAX30102********//
let MAX30102_checkInitError = false;
function MAX30102_handle(arrString) {
    if(MAX30102_checkInitError) return;
    UI('MAX30102_TextArea').value = arrString.slice(1, arrString.length).join(' ');

    if(arrString[1] === 'Init'){
        if(arrString[2] === 'Error'){
            UI('MAX30102-button').disabled = true;
            UI('MAX30102-button').textContent = "Not detected";
            MAX30102_checkInitError = true;
        }
        return;
    }

    if(arrString[1] === 'No') {
        UI('MAX30102_Square').style.backgroundColor = "white";
        UI('MAX30102_TextArea_Beat').value = "";
        UI('MAX30102_TextArea_BPM').value = "";
        return;
    }
    UI('MAX30102_Square').style.backgroundColor = "red";
    UI('MAX30102_TextArea_Beat').value = arrString[2];
    UI('MAX30102_TextArea_BPM').value = parseFloat(arrString[4]).toFixed(1);
}

function MAX30102_button(){
    send("MAX30102 Test");
}

//****************//

document.addEventListener('DOMContentLoaded', (event) => {
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Xóa lớp 'active' khỏi tất cả các mục
            document.querySelectorAll('.item').forEach(item => {
                item.classList.remove('active');
            });
            // Thêm lớp 'active' vào mục chứa nút được nhấn
            button.closest('.item').classList.add('active');
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    UI('infoButton').addEventListener('click', function (event) {
        event.stopPropagation(); // Ngăn chặn sự kiện click lan sang các phần tử cha
        if (UI('infoContent').style.display === 'block') {
            UI('infoContent').style.display = 'none';
        } else {
            UI('infoContent').style.display = 'block';
        }
    });
  
    document.addEventListener('click', function () {
        UI('infoContent').style.display = 'none';
    });
});