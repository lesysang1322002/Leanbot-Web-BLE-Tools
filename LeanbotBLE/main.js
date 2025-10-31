import { LeanbotBLE } from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/Leanbot-BLE-Test/leanbot_ble.js";
import * as utils from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/Leanbot-BLE-Test/leanbot_utils.js";

const leanbot = new LeanbotBLE();
const status = utils.UI("leanbotStatus");
const logBox = utils.UI("serialLog");

// ========= UI EVENTS =========
utils.UI("btnConnect").onclick = () => connectLeanbot();
utils.UI("btnReconnect").onclick = () => leanbot.Reconnect();

async function connectLeanbot() {
  console.log("Disconnect before connecting ...");
  leanbot.Disconnect();

  console.log("Scanning for Leanbot...");
  const result = await leanbot.Connect();

  if(result.success){
    status.textContent = leanbot.getLeanbotID();
    status.className = "connected";
  } else {
    status.textContent = result.message;
    status.className = "disconnected";
  }
}

leanbot.OnConnect = (dev) => {
  status.textContent = dev.name;
  status.className = "connected";
  utils.log("Connected to " + dev.name);
};
leanbot.OnDisconnect = () => {
  status.textContent = "Disconnected";
  status.className = "disconnected";
};

// SEND SERIAL
utils.UI("btnSend").onclick = () => {
  const msg = utils.UI("serialInput").value;
  const final = utils.UI("addNewline").checked ? msg + "\n" : msg;
  leanbot.Serial.Send(LeanbotBLE.UUID, final);
  utils.log("> " + msg);
};

// CLEAR / COPY LOG
utils.UI("btnClear").onclick = () => logBox.textContent = "";
utils.UI("btnCopy").onclick = () => {
  navigator.clipboard.writeText(logBox.textContent);
  alert("Copied Serial Log!");
};

// // CUSTOM LOG BEHAVIOR
// utils.log = function (msg) {
//   const timestamp = utils.UI("showTimestamp").checked
//     ? "[" + new Date().toLocaleTimeString() + "] "
//     : "";
//   logBox.textContent += timestamp + msg + "\n";
//   if (utils.UI("autoScroll").checked)
//     logBox.scrollTop = logBox.scrollHeight;
// };
