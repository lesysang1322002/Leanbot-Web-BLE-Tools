const resetColor = "#CCCCCC"; // màu mặc định (xám)

function logstatusWebName(text){
    logstatus(text + " - Standard Modules");
}

function handleSerialLine(line) {
    if (! line) return;
    console.log("Nano > " + line);

    const arrString = line.split(/[ \t]+/);
    checkCodefromLeanbot(arrString);

    if (checkCalibrationGripper) return Gripper_Calibration_handle(arrString);
    if (arrString[0] === "TB" && checkmessage) return DemoTest_handle(arrString);
    UpdateBorderButtonDemo(arrString[0]);
}

function checkCodefromLeanbot(arrString) {
    if (arrString[0] === "TB" && arrString[3] === "IR" && !checkmessage) {
        console.log("Message correct.");
        send(".RemoteControl");
        checkmessage = true;
        clearTimeout(timeoutCheckMessage); // Hủy kết thúc sau 5 giây

        // Khi đã kết nối chuyển text từ xám sang màu đen
        const elementsToChangeColor = [
            'HCSR04', 'Gripper', 'Gripper_Left', 'Gripper_Right_Text', 
            'IR_LineCalibration', 'Gripper_Calibration'
        ];
        elementsToChangeColor.forEach(id => UI(id).style.color = "black");
        buttonsTest.forEach(item => item.style.color = "black");
        gridItems.forEach(item => item.style.removeProperty("color"));
    }
}

const buttonsTest = document.querySelectorAll('.buttonTest');
const gridItems = document.querySelectorAll('.grid-item');

//**********************Calibration Gripper**************************//

let checkCalibrationGripper = false;

function Gripper_Calibration_handle(arrString){
    // Dùng .filter(Boolean) để giữ lại các phần tử không trống.
    // Sau đó, flatMap làm phẳng tất cả mảng con thành một mảng duy nhất (value).
    const value = arrString.flatMap(arr => arr.split(/[\(\),]/).filter(Boolean));
    console.log("Value: " + value);
    
    switch(value[0]){ 
        case 'GetCalibration'    : return Gripper_Calibration_Get(value);
        case 'degL'              : return Gripper_Calibration_UpdateValue(value);
        case 'OpenPosition'      : return Gripper_Calibration_Step1();
        case 'ClosePosition'     : return Gripper_Calibration_Step2();
        case 'SetCalibration'    : return Gripper_Calibration_Step3();
        case 'Touch'             : return Gripper_Calibration_Step4();
        case 'TB1A'              : return Gripper_Calibration_Done();
    }
}

let Gripper_Step = 0;
let Gripper_old00L, Gripper_old90L, Gripper_old00R, Gripper_old90R;
let Gripper_angleLeft, Gripper_angleRight;

function Gripper_Calibration_Get(arrString){
    Gripper_old00L = arrString[1];
    Gripper_old90L = arrString[2];
    Gripper_old00R = arrString[3];
    Gripper_old90R = arrString[4];
    console.log("Old00L: " + Gripper_old00L + " Old90L: " + Gripper_old90L + " Old00R: " + Gripper_old00R + " Old90R: " + Gripper_old90R);
    send(',Step1'); // Bắt đầu hiệu chỉnh cánh tay
}

function Gripper_Calibration_UpdateValue(arrString){
    Gripper_angleLeft = arrString[2];
    Gripper_angleRight = arrString[5];

    if(Gripper_angleLeft !== UI('angleLvalueCali').value || Gripper_angleRight !== UI('angleRvalueCali').value) alert('WRONG MESSAGE!');
}

function Gripper_Calibration_Step1(){
    Gripper_Step = 1;
    UI("Next").innerText = "Next";
    UI('textareaCali').value = "Step 1/4: Adjust both gripper arms to proper 0° position (pointing down)";
    UI('angleRvalueCali').value = Gripper_old00R;
    UI('angleLvalueCali').value = Gripper_old00L;
    sendLR();
    toggleDisplayForElements(["R0increment", "R0decrement", "L0increment", "L0decrement",
                              "R0_5increment", "R0_5decrement", "L0_5increment", "L0_5decrement"], "block");
    toggleDisplayForElements(["R90increment", "R90decrement", "L90increment", "L90decrement",
                              "R90_5increment", "R90_5decrement", "L90_5increment", "L90_5decrement"], "none");
    toggleDisplayForElements(["Next"], "block");
}

function Gripper_Calibration_Step2(){
    Gripper_Step = 2;
    UI("Next").innerText = "Next";
    UI('textareaCali').value = "Step 2/4: Adjust both gripper arms to proper 90° position (pointing horizontally)";
    toggleDisplayForElements(["R90increment", "R90decrement", "L90increment", "L90decrement",
                               "R90_5increment", "R90_5decrement", "L90_5increment", "L90_5decrement" ], "block");
    toggleDisplayForElements(["R0increment", "R0decrement", "L0increment", "L0decrement", 
                              "R0_5increment", "R0_5decrement", "L0_5increment", "L0_5decrement"], "none");
    UI('angleRvalueCali').value = Gripper_old90R;
    UI('angleLvalueCali').value = Gripper_old90L;
    sendLR();
}

function Gripper_Calibration_Step3(){
    Gripper_Step = 3;
    UI("Next").innerText = "Save";
    UI('textareaCali').value = "Step 3/4: Observe gripper open and close correctly";
    toggleDisplayForElements(["R90increment", "R90decrement", "L90increment", "L90decrement",
                              "R90_5increment", "R90_5decrement", "L90_5increment", "L90_5decrement" ], "none");
}

function Gripper_Calibration_Step4(){
    Gripper_Step = 4;
    UI('textareaCali').value = "Step 4/4: Touch TB1A + TB1B to permanently save calibration settings";
    UI("Next").innerText = "Done";
    toggleDisplayForElements(["Next"], "none");
}

function Gripper_Calibration_Done(){
    UI('textareaCali').value = `TB1A + TB1B touched. Calibration settings saved. Calibration Done. Please Rescan Leanbot`;
    Backbutton.style.display = "none";
    Cancelbutton.style.display = "none";
}

function Next() {
    console.log("Gripper_Step: " + Gripper_Step);
    if(Gripper_Step == 1){
        send(',Step2');
    }
    else if(Gripper_Step == 2){
        send(',Step3');
    }
    else if(Gripper_Step == 3){
        send(',Step4');
    }
}

function Back() {
    if(Gripper_Step == 3){
        send(',Step2');
    }
    else if(Gripper_Step == 2){
        send(',Step1');
    }
    else if(Gripper_Step == 4){
        send(',Step3');
    }
}

function Cancel(){
    tab1.style.display = "none";
    checkCalibrationGripper = false;
    checkClickDone = false;
}

function sendLR(){
    send (',LR' + ' ' + UI('angleLvalueCali').value + ' ' + UI('angleRvalueCali').value);
}

function toggleDisplayForElements(elementIds, displayValue) {
    elementIds.forEach(function(id) {
        if (UI(id)) UI(id).style.display = displayValue;
    });
}

//**********************End Calibration Gripper**************************//


//********************** Handle Message *************************************//


let checkArray = [], checksum = []; // Touch + IR

// Các id của IR và Touch trong Grid
const elementIds = [
    "TB1A", "TB1B", "TB2A", "TB2B", 
    "ir6L", "ir4L", "ir2L", "ir0L", 
    "ir1R", "ir3R", "ir5R", "ir7R"
];

function DemoTest_handle(arrString){
    // String: TB,0000,-,IR,0001,255,92,16,19,16,47,104,255,-,1000,cm,-,GR,0,0 
    Touch_handle(arrString);
    IR_handle(arrString);
    HCSR04_handle(arrString);
    Gripper_handle(arrString);
    Done_handle();
}

//****Touch****/
let TB1A, TB1B, TB2A, TB2B;
let Touch_Count = Array(4).fill(0);
let Touch_checkCount = Array(4).fill(true);

function Touch_handle(arrString){ 
    const idx = arrString.indexOf('TB');
    if (idx === -1) return;
    const TB = arrString[idx + 1];
    for (let i = 0; i < 4; i++) {
        checkArray[i] = parseInt(TB[i]);
        const element = UI(elementIds[i]); // Lưu đối tượng UI vào biến
        const paragraph = element.querySelector('p');
        
        // Cập nhật Touch_Count khi checkArray[i] là 1 và Touch_checkCount[i] là true
        if (checkArray[i] === 1 && Touch_checkCount[i]) {
            Touch_checkCount[i] = false;
            Touch_Count[i]++;
            paragraph.innerHTML = `${elementIds[i]}<br>${Touch_Count[i]}`;

            // Cập nhật viền dựa trên Touch_Count
            element.style.border = Touch_Count[i] === 1 ? "3px solid orange" : 
                                   Touch_Count[i] === 3 ? "3px solid green" : 
                                   element.style.border;

            if (Touch_Count[i] === 3) checksum[i] = 1;
        } 
        else if (checkArray[i] === 0) {
            Touch_checkCount[i] = true;
        }
        
        // Cập nhật màu nền
        updateBackground(elementIds[i], checkArray[i]);
    }
}

//****IR****/
let ir2L, ir0L, ir1R, ir3R, ir4L, ir6L, ir5R, ir7R;
let IR_checkValue0 = Array(8).fill(false), IR_checkValue1 = Array(8).fill(false); // Touch + IR
let IR_TimeoutValue0 = [], IR_TimeoutValue1 = [];
let IR_LastCmdValue0 = Array(8).fill(true), IR_LastCmdValue1 = Array(8).fill(true);

function IR_handle(arrString) { 
    const idx = arrString.indexOf('IR');
    if (idx === -1) return;
    const IR_startIndex = idx + 1;
    for (let i = IR_startIndex; i < IR_startIndex + 8; i++) {
        checkArray[i] = IR_compareThreshold(arrString, i - 4);
        let paragraph = UI(elementIds[i]).querySelector('p'); // Tìm phần tử <p> bên trong div
        
        // Cập nhật giá trị IR
        paragraph.innerHTML = elementIds[i] + "<br>" + arrString[i + 1];
        
        // Chuyển màu viền của IR
        IR_handleBorderChange(i, UI(elementIds[i]), IR_checkValue1, IR_LastCmdValue1, IR_TimeoutValue1, 1);
        IR_handleBorderChange(i, UI(elementIds[i]), IR_checkValue0, IR_LastCmdValue0, IR_TimeoutValue0, 0);
        
        if (IR_checkValue0[i] && IR_checkValue1[i]) {
            checksum[i] = 1;
            UI(elementIds[i]).style.border = "3px solid green";
        }
        // Cập nhật màu nền
        updateBackground(elementIds[i], checkArray[i]);
    }
    const IR_lineState = checkArray.slice(IR_startIndex + 2, IR_startIndex + 6).join('');
    IR_LineFollow(IR_lineState);
}

function IR_handleBorderChange(i, element, check, lastCommand, timeout, value) {
    if (check[i]) return;

    if(checkArray[i] === value) {
        element.style.border = "3px solid orange";
        if (lastCommand[i - 4]) {
            timeout[i] = setTimeout(() => {
                element.style.border = "3px solid #CCCCCC";
                check[i] = true;
            }, 2000);
        }
        lastCommand[i - 4] = false;
    } else {
        clearTimeout(timeout[i]);
        lastCommand[i - 4] = true;
    }
}

const threshold = Array(8).fill(map(100, 0, 768, 0, 255));

function map(value, in_min, in_max, out_min, out_max) {
    return parseInt((value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
}

function IR_compareThreshold(arrString, index) {
    let irValue = parseInt(arrString[index + 5]);
    threshold[index] = parseFloat((Math.min(threshold[index], irValue * 1.8))).toFixed(1);
    return irValue > threshold[index] ? 1 : 0;
}

let checkAlertFollowLine = false;

function IR_LineFollow(lineState){ 
    
    if(lineState === '1111' || lineState === '0000'){
        testFollowline.style.color = "#CCCCCC";
        return;
    }
    testFollowline.style.color = "green";
    if(!checkAlertFollowLine) return;
    
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

//****HC-SR04****/
let HCSR04_DistanceInt;
let HCSR04_Value10cm = false, HCSR04_Value30cm = false;
let HCSR04_LastCmd10cm = true, HCSR04_LastCmd30cm = true;
let HCSR04_Timeout10cm, HCSR04_Timeout30cm;

function HCSR04_handle(arrString) {
    const idx = arrString.indexOf('cm');
    if (idx === -1) return;
    const distance = arrString[idx - 1];
    HCSR04_ObjectFollow(distance);
    handle10cmCheck(distance);
    handle30cmCheck(distance);
    // HCSR04_handleDistanceCheck(distance, '10', "text10cm", HCSR04_Value10cm, HCSR04_LastCmd10cm, HCSR04_Timeout10cm);
    // HCSR04_handleDistanceCheck(distance, '30', "text30cm", HCSR04_Value30cm, HCSR04_LastCmd30cm, HCSR04_Timeout30cm);
    HCSR04_DistanceDisplay(distance);
}

function HCSR04_ObjectFollow(distance) {
    HCSR04_DistanceInt = parseInt(distance);
    if (HCSR04_DistanceInt > 50) {
        UI('testObjectfollow').style.color = resetColor;
        return;
    }
    if (checkTestObjectDemo) {
        UI('customAlert').style.display = 'none';
        checkClickDone = false;
        runTest("Objectfollow", ".Objectfollow");
        checkTestObjectDemo = false;
    }
    UI('testObjectfollow').style.color = "green";
}

function handle10cmCheck(distance) {
    if (HCSR04_Value10cm) return;
    
    if (distance === '10') {
        UI("text10cm").style.color = "orange";
        if (HCSR04_LastCmd10cm) {
            HCSR04_Timeout10cm = setTimeout(() => {
                UI("text10cm").style.color = "green";
                HCSR04_Value10cm = true;
            }, 3000);
        }
        HCSR04_LastCmd10cm = false;
    } else {
        UI("text10cm").style.color = resetColor;
        clearTimeout(HCSR04_Timeout10cm);
        HCSR04_LastCmd10cm = true;
    }
}

function handle30cmCheck(distance) {
    if (HCSR04_Value30cm) return;
    
    if (distance === '30') {
        UI("text30cm").style.color = "orange";
        if (HCSR04_LastCmd30cm) {
            HCSR04_Timeout30cm = setTimeout(() => {
                UI("text30cm").style.color = "green";
                HCSR04_Value30cm = true;
            }, 3000);
        }
        HCSR04_LastCmd30cm = false;
    } else {
        UI("text30cm").style.color = resetColor;
        clearTimeout(HCSR04_Timeout30cm);
        HCSR04_LastCmd30cm = true;
    }
}

// function HCSR04_handleDistanceCheck(distance, targetDistance, elementId, check, lastCommand, timeout) {
//     if (check.value) return;
    
//     if (distance === targetDistance) {
//         UI(elementId).style.color = "orange";
//         if (lastCommand.value) {
//             timeout.value = setTimeout(() => {
//                 UI(elementId).style.color = "green";
//                 check.value = true;
//             }, 3000);
//         }
//         lastCommand.value = false;
//     } else {
//         UI(elementId).style.color = resetColor;
//         clearTimeout(timeout.value);
//         lastCommand.value = true;
//     }
// }

function HCSR04_DistanceDisplay(distance) {
    UI('HCSR04').textContent = (distance === "1000") ? "HC-SR04 Ultrasonic distance" : `${distance} cm`;
    UI('HCSR04').style.fontSize = (distance === "1000") ? "13px" : "20px";
    UI('distanceSlider').value = distance;
    if (HCSR04_Value10cm && HCSR04_Value30cm) {
        UI('HCSR04').style.color = "green";
        UI('ctn-slider').style.border = "3px solid green";
    }
}

//****Gripper****/
let Gripper_angleL, Gripper_angleR;

function Gripper_handle(arrString) {
    const idx = arrString.indexOf('GR');
    if (idx === -1) return;
    Gripper_angleL = arrString[idx + 1];
    Gripper_angleR = arrString[idx + 2];
    UI('textangleL').textContent = `${Gripper_angleL}°`;
    UI('textangleR').textContent = `${Gripper_angleR}°`;
}

const Gripper_angleValues = ["0", "-30" , "120" , "90", "45"];

function Gripper_sendAngle(nextAngleL, nextAngleR){ 
    if (!checkClickDone) send([".GripperLR", toStr(nextAngleL, 3), toStr(nextAngleR, 3)].join(' '));
}

function buttonGripperLeft(){
    const currentIndexL = Gripper_angleValues.indexOf(Gripper_angleL);
    const nextIndexL = (currentIndexL + 1) % Gripper_angleValues.length;
    Gripper_sendAngle(Gripper_angleValues[nextIndexL], Gripper_angleR);
}

function buttonGripperRight(){
    const currentIndexR = Gripper_angleValues.indexOf(Gripper_angleR);
    const nextIndexR = (currentIndexR + 1) % Gripper_angleValues.length;
    Gripper_sendAngle(Gripper_angleL, Gripper_angleValues[nextIndexR]);
}

//*********************End Message Handle*********************/

//*********************Test Demo*******************************/

function UpdateBorderButtonDemo(report) {
    const reportMap = {
        'Gripper'       : { id: "testGripper",          index: 0 },
        'Motion'        : { id: "testMotor",            index: 1 },
        'RGBLeds'       : { id: "testLed",              index: 2 },
        'Buzzer'        : { id: "testBuzzer",           index: 3 },
        'StraightMotion': { id: "testStraightMotion",   index: 4 },
        'LineFollow'    : { id: "testFollowline",       index: 5 },
        'Objectfollow'  : { id: "testObjectfollow",     index: 6 }
    };

    const element = reportMap[report];
    if (element) {
        UI(element.id).style.border = "3px solid green";
        checkButtonGreen[element.index] = 1;
        checkClickDone = false;
    }
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

function TestStraightMotion(){
    runTest("StraightMotion",".StraightMotion");
}

let checkTestObjectDemo = false;

function TestObjectfollow(){
    if (!checkmessage) return;
    if (HCSR04_DistanceInt <= 50) return runTest("Objectfollow",".Objectfollow");
    
    // Hiển thị thông báo khi khoảng cách không đạt yêu cầu
    UI('customAlert').style.display = 'block';
    checkTestObjectDemo = true;
    checkClickDone = true;
}

function TestIRLineCalibration(){
    if(checkmessage) return send(".IRLine");
}

//*****************************************************************//

function Done_handle(){
    if(areAllElementsEqualToOne(checkButtonGreen) && areAllElementsEqualToOne(checksum) && HCSR04_Value10cm && HCSR04_Value30cm){
        navbarTitle.style.color = "green";
    }
}

function resetVariable() {
    // 1. Thiết lập lại hiển thị và giao diện
    tab1.style.display = "none";
    navbarTitle.style.color = "orange";
    UI("buttonText").innerText = "Scan";

    // 2. Đặt màu mặc định cho các phần tử
    UI('HCSR04').style.color = resetColor;
    UI('Gripper').style.color = resetColor;
    UI('Gripper_Left').style.color = resetColor;
    UI('Gripper_Right_Text').style.color = resetColor;
    UI('IR_LineCalibration').style.color = resetColor;
    UI('HCSR04').style.fontSize = "13px";
    
    buttonsTest.forEach(item => item.style.color = resetColor);
    gridItems.forEach(item => {
        item.style.color = resetColor;
        item.style.border = `3px solid ${resetColor}`;
    });
    elements.forEach(item => item.style.color = resetColor);
    UI('distanceSlider').style.border = `3px solid ${resetColor}`;
    Gripper_Calibration.style.color = resetColor;

    // 3. Đặt lại giá trị văn bản
    UI('HCSR04').textContent = "HC-SR04 Ultrasonic distance";
    UI('textangleL').textContent = '';
    UI('textangleR').textContent = '';

    // 4. Đặt lại các timeout
    clearTimeout(HCSR04_Timeout10cm);
    clearTimeout(HCSR04_Timeout30cm);
    clearTimeout(timeoutCheckMessage);
    for (let i = 0; i < 12; i++) {
        clearTimeout(IR_TimeoutValue1[i]);
        clearTimeout(IR_TimeoutValue0[i]);
    }

    // 5. Đặt lại các giá trị mảng và biến cờ
    UI('distanceSlider').value = 0;
    checksum = Array(12).fill(0);
    IR_checkValue0 = Array(8).fill(0);
    IR_checkValue1 = Array(8).fill(0);
    IR_LastCmdValue1 = Array(8).fill(true);
    IR_LastCmdValue0 = Array(8).fill(true);
    HCSR04_Value10cm = false;
    HCSR04_Value30cm = false;
    checkClickDone = false;
    checkTestObjectDemo = false;
    checkCalibrationGripper = false;

    // 6. Đặt lại các giá trị biến đếm chạm
    const resetElements = ["TB1A", "TB1B", "TB2A", "TB2B"];
    resetElements.forEach((id, index) => {
        let paragraph = UI(id).querySelector('p');
        paragraph.innerHTML = `${id}<br>0`; // Sử dụng <br> để xuống dòng
        Touch_Count[index] = 0; // Đặt lại Touch_Count cho các phần tử này
        Touch_checkCount[index] = true; // Đặt lại Touch_checkCount
    });

    // 7. Thiết lập lại ngưỡng cho cảm biến
    threshold = Array(8).fill(map(100, 0, 768, 0, 255));

    // 8. Đặt lại màu cho các phần tử đặc biệt
    UI("text10cm").style.color = resetColor;
    UI("text30cm").style.color = resetColor;

    // 9. Đặt lại nền (nếu có hàm resetBackground())
    resetBackground();
}


let checkmessage = false;
let elements = document.querySelectorAll("#text10cm, #text30cm");

if (!checkmessage) {
    const elements = [HCSR04, Gripper, Gripper_Left, Gripper_Right_Text, Gripper_Calibration, ...buttonsTest, ...gridItems];
    elements.forEach(item => {
        item.style.color = resetColor;
    });
}

function updateBackground(id, value) {
    if (value === 0) {
        UI(id).classList.remove('black');
        UI(id).classList.add('white');
        return;
    } 

    if(id == "TB1A" || id == "TB1B" || id == "TB2A" || id == "TB2B" ){
        UI(id).classList.remove('white');
        UI(id).classList.add('red');
    }
    else{
        UI(id).classList.remove('white');
        UI(id).classList.add('black');
    }
}

function handleTimeoutCheck(check, array, lastCommand, timeout) {
    for (let i = 0; i < 12; i++) {
        if (check[i])  return;

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

function updateAllBackground() {
    const elements = [
        ['TB1A', checkArray[0]], ['TB1B', checkArray[1]], ['TB2A', checkArray[2]], ['TB2B', checkArray[3]],
        ['ir6L', checkArray[4]], ['ir4L', checkArray[5]], ['ir2L', checkArray[6]], ['ir0L', checkArray[7]],
        ['ir1R', checkArray[8]], ['ir3R', checkArray[9]], ['ir5R', checkArray[10]], ['ir7R', checkArray[11]]
    ];
    elements.forEach(([id, value]) => updateBackground(id, value));
}

let checkButtonGreen = [0, 0, 0, 0, 0, 0, 0];

function areAllElementsEqualToOne(arr) {
    for (let i = 0; i < arr.length; i++) if (arr[i] !== 1) return false;
    return true;
}

function resetBackground() {
    const elements = ['ir2L', 'ir0L', 'ir1R', 'ir3R', 'ir4L', 'ir6L', 'ir5R', 'ir7R', 'TB1A', 'TB1B', 'TB2A', 'TB2B'];
    elements.forEach(id => updateBackground(id, 0));
}

let checkClickDone = false;
    // Thực hiện send và đổi màu viền khi click
function runTest(component, command){
    if(checkmessage && !checkClickDone){
        console.log("Command: " + command);
        send(command);
        element = UI("test" + component);
        element.style.border = "3px solid orange";
        checkClickDone = true;
        // resetBackground();
    }
}

// Calibration  Gripper
function GripperCalibration() {
    if ( !checkmessage) return;

    if (tab1.style.display === "none" || tab1.style.display === "") {
        resetVariable();
        document.getElementById("buttonText").innerText = "Rescan";
        send(',GripperCalibration');
        checkCalibrationGripper = true;
        checkClickDone = true;
        tab1.style.display = "block"; // Show the element
    } else {
        tab1.style.display = "none";   // Hide the element if it's visible
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

function toStr(value, length) {
    // Chuyển đổi giá trị thành số nguyên
    const intValue = parseInt(value);
    // Chuyển đổi số nguyên thành chuỗi và thêm số 0 ở phía trước nếu độ dài của chuỗi nhỏ hơn `length`
    return String(intValue).padStart(length, '0');
}

function closeCustomAlert() {
    UI('customAlert').style.display = 'none';
    checkClickDone = false;
    checkTestObjectDemo = false;
}

function closeCustomAlertFollowLine() {
    UI('customAlertFollowLine').style.display = 'none';
    checkClickDone = false;
    checkAlertFollowLine = false;
}

function closeAlertErrorCode(){
    UI('infopopup').style.display = 'none';
}
  
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