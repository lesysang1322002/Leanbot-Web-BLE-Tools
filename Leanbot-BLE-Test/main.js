// main.js
import { LeanbotBLE } from "./leanbot_ble.js";
import { log, UI } from "./leanbot_utils.js";

const botA = new LeanbotBLE();
const botB = new LeanbotBLE();

botA.OnConnect = (dev) => log(`Callback: ${dev.name} ready`);
botA.OnDisconnect = (dev) => log(`Callback: Disconnected from ${dev.name}`);

// ====== BUTTON EVENTS (Device A) ======
UI("connectBtnA").onclick = () => botA.Connect();
UI("disconnectBtnA").onclick = () => botA.Disconnect();
UI("reconnectBtnA").onclick = () => botA.Reconnect();
UI("rescanBtnA").onclick = () => botA.Rescan();

UI("checkConnA").onclick = () => {
  const state = botA.IsConnected() ? "Connected" : "Not connected";
  log(`[A] State: ${state}`);
};

UI("getIDBtnA").onclick = () => {
  log(`[A] ID: ${botA.getLeanbotID()}`);
};

// ====== BUTTON EVENTS (Device B - chỉ kết nối cơ bản) ======
UI("connectBtnB").onclick = () => botB.Connect();
UI("disconnectBtnB").onclick = () => botB.Disconnect();

botB.OnConnect = (dev) => log(`Callback: ${dev.name} ready`);
botB.OnDisconnect = (dev) => log(`Callback: Disconnected from ${dev.name}`);
