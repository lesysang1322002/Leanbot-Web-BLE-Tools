#include <Leanbot.h>
 
struct sLbGripperCalibration {
  int deg00L;
  int deg90L;
  int deg00R;
  int deg90R;
};
 
sLbGripperCalibration calibData;
 
int degL = 0;
int degR = 0;
 
int bmpDegree00 = BITMAP(ledF, ledE, ledB, ledC);
int bmpDegree90 = BITMAP(ledA, ledO, ledD);
 
 
void setup() {
  Leanbot.begin();
  LbGripper.setCalibration(0, 90, 0, 90);  
}
void loop() {
  serial_checkCommand();
}

bool checkNextStep = true;

void CalibrateOpenPosition() {
  Serial.print(F("OpenPosition"));
  Serial.println();
  degL = degR = 0;
  LbGripper.writeLR(degL, degR);
}

void CalibrateClosePosition() {
  Serial.print(F("ClosePosition"));
  Serial.println();
  degL = degR = 90;
  LbGripper.writeLR(degL, degR);
}

void PrintCalibrationResult() {
  Serial.print(F("LbGripper.setCalibration("));
  Serial.print(calibData.deg00L);
  Serial.print(F(", "));
 
  Serial.print(calibData.deg90L);
  Serial.print(F(", "));
 
  Serial.print(calibData.deg00R);
  Serial.print(F(", "));
  
  Serial.print(calibData.deg90R);
  Serial.print(F(");\n"));
  while(Serial.available()<=0){
  LbGripper.writeLR(calibData.deg00L,calibData.deg00R);
  delay(1000);
  LbGripper.writeLR(calibData.deg90L,calibData.deg90R);
  delay(1000);
  }
}

void WriteCalibrationResultToEEPROM() {
  Serial.print(F("WriteCalibrationResultToEEPROM"));
  Serial.println();
  while(!LbTouch.read(TB1A) || !LbTouch.read(TB1B)) {}
  beep(3);
  LbHwConfig.writeGripperCalibrationData(calibData.deg00L, calibData.deg90L, calibData.deg00R, calibData.deg90R);
}

void handleCommand(String command) {
  if (command == "Step1"){
    checkNextStep = true;
    CalibrateOpenPosition();                
  }
  else if(command == "Step2"){
    if(checkNextStep){
    calibData.deg00L = degL;
    calibData.deg00R = degR;
    }
    CalibrateClosePosition();                
  }
  else if(command == "Step3"){
    checkNextStep = false;
    calibData.deg90L = degL;
    calibData.deg90R = degR;
    PrintCalibrationResult();
  }
  else if(command == "Step4"){
    WriteCalibrationResultToEEPROM();
  }
  else{
    if(command[0] == 'L'){
      String StrdegL = "";
      String StrdegR = "";
      size_t i = 3;
      while(command[i] != ' '){
        StrdegL += command[i];
        i++;
      }
      while(i < command.length()){
        StrdegR += command[i];
        i++;
      }
      degL = atoi(StrdegL.c_str());
      degR = atoi(StrdegR.c_str());
    }
    LbGripper.writeLR(degL, degR);
    PrintCurrentDegree();
  }
  beep(1);
}

void PrintCurrentDegree() {
  Serial.print(F("degL = "));
  Serial.print(degL);
  Serial.print(F("\t"));
  Serial.print(F("degR = "));
  Serial.print(degR);
  Serial.println();
}
 
void beep(int repeats) {
  while (repeats--) {
    Leanbot.tone(440*4, 25);
    delay(50);
  }
}
 
void beep_err() {
  Leanbot.tone(130*1, 500);
  delay(500);
}
 

void serial_checkCommand() {
  if(Serial.available()<=0) return 0;
  static String commandBuffer = "";
  while (Serial.available() > 0) {
    char incomingChar = Serial.read();
    if (incomingChar == '\n') {
      handleCommand(commandBuffer);
      commandBuffer = "";
    } else {
      commandBuffer += incomingChar;
    }
  }
}
