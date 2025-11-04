// main.js
import { LeanbotBLE } from "./leanbot_ble.js";
import * as utils from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/sdk_leanbot/leanbot_utils.js";

const leanbot = new LeanbotBLE();
console.log(leanbot);

leanbot.Serial.OnMessage = msg => console.log("Leanbot → " + msg);
leanbot.Uploader.OnMessage = msg => console.log("Uploader →", msg);

const botB = new LeanbotBLE();

// leanbot.Serial.OnMessage(LeanbotBLE.CHAR_UUID, msg => utils.log("Leanbot → " + msg));
// leanbot.Uploader.OnMessage = msg => utils.log("Uploader Notify → " + msg);

// leanbot.OnConnect = () => utils.log(`Callback: ${leanbot.getLeanbotID()} ready`);
// leanbot.OnDisconnect = (dev) => utils.log(`Callback: Disconnected from ${dev.name}`);

// ====== BUTTON EVENTS (Device A) ======
document.getElementById("connectBtnA").onclick = async () => connectLeanbot();

async function connectLeanbot() {
  console.log("Scanning for Leanbot...");
  const result = await leanbot.Connect();
  if(result.success){
    console.log("Connected to " + leanbot.getLeanbotID());
  } else {
    console.log("Connection failed: " + result.message);
  }
}

leanbot.OnDisconnect = () => console.log(`Callback: Disconnected Leanbot`);

function Disconnect(){
  console.log("Disconnecting ...");
  leanbot.Disconnect();
}

async function Reconnect(){
  console.log("Reconnecting ...");
  const result = await leanbot.Reconnect();
  console.log("Reconnect result:", result.message);
}

async function Rescan(){
  console.log("Rescanning ...");
  const result = await leanbot.Rescan();
  console.log("Rescan result:", result.message);
}

function checkConnected(){
  const state= leanbot.IsConnected() ? "Connected" : "Not connected";
  console.log(`Connection status: ${state}`);
  console.log(leanbot.getLeanbotID());
}

utils.UI("disconnectBtnA").onclick = () => Disconnect();
utils.UI("reconnectBtnA").onclick = () => Reconnect();
utils.UI("rescanBtnA").onclick = () => Rescan();
utils.UI("checkConnA").onclick = () => checkConnected();

utils.UI("getIDBtnA").onclick = () => {
  utils.log(`[A] ID: ${leanbot.getLeanbotID()}`);
};

utils.UI("sendBtnA").onclick = async () => {
  const t0 = performance.now();
  await leanbot.Serial.Send("Hello\n");
  utils.log("Send() time: " + (performance.now() - t0).toFixed(1) + " ms");
};

async function testSendPerformance(){
  const t0 = performance.now();
  await leanbot.Serial.Send("Hello\n");
  utils.log("Send() time: " + (performance.now() - t0).toFixed(1) + " ms");
}

async function testSendWithoutResponsePerformance(){
  const t0 = performance.now();
  await leanbot.Serial.SendWithoutResponse("Quick\n");
  utils.log("SendWithoutResponse() time: " + (performance.now() - t0).toFixed(1) + " ms");
}

utils.UI("sendFastBtnA").onclick = async () => {
  await testSendWithoutResponsePerformance();
};

utils.UI("serialSupportedBtn").onclick = () => {
  const supported = leanbot.Serial.supported() ? "Yes" : "No";
  console.log(leanbot.getLeanbotID() + ` Serial Supported: ${supported}`);
};

utils.UI("uploaderSupportedBtn").onclick = () => {
  const supported = leanbot.Uploader.supported() ? "Yes" : "No";
  utils.log(leanbot.getLeanbotID() + ` Uploader Supported: ${supported}`);
};

utils.UI("uploadStandardBtn").onclick = async () => {
  const res = await fetch("./firmware/standard.hex");
  const text = await res.text();
  await leanbot.Uploader.Upload(text);
};

utils.UI("uploadAdvanceBtn").onclick = async () => {
  const res = await fetch("./firmware/advance.hex");
  const text = await res.text();
  await leanbot.Uploader.Upload(text);
};

// ====== BUTTON EVENTS (Device B - chỉ kết nối cơ bản) ======
utils.UI("connectBtnB").onclick = () => botB.Connect();
utils.UI("disconnectBtnB").onclick = () => botB.Disconnect();

botB.OnConnect = (dev) => utils.log(`Callback: ${dev.name} ready`);
botB.OnDisconnect = (dev) => utils.log(`Callback: Disconnected from ${dev.name}`);
