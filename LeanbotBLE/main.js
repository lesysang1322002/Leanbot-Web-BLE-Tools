// main.js
import { LeanbotBLE } from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/sdk_leanbot/leanbot_ble.js";
import * as utils from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/sdk_leanbot/leanbot_utils.js";

// // =================== FILE SELECTION MODAL =================== //
// const btnCode = document.getElementById("btnCode");
// const modal = document.getElementById("fileModal");
// const closeModal = document.getElementById("closeModal");
// const fileNameLabel = document.getElementById("fileName");

// btnCode.addEventListener("click", () => {
//   modal.classList.remove("hidden");
// });

// closeModal.addEventListener("click", () => {
//   modal.classList.add("hidden");
// });

// document.querySelectorAll(".fileOption").forEach(btn => {
//   btn.addEventListener("click", e => {
//     const filePath = e.target.getAttribute("data-file");
//     const fileName = filePath.split("/").pop();
//     fileNameLabel.textContent = fileName;
//     modal.classList.add("hidden");
//     utils.log(`Selected file: ${fileName}`);
//   });
// });

// =================== BLE =================== //

const status = utils.UI("leanbotStatus");
const btnConnect = utils.UI("btnConnect");
const btnReconnect = utils.UI("btnReconnect");

const leanbot = new LeanbotBLE();

leanbot.OnConnect = () => {
    status.textContent = leanbot.getLeanbotID();
    status.className = "connected";
}

leanbot.OnDisconnect = () => {
    status.className = "disconnected";
}

btnConnect.onclick = async () => connectLeanbot();
btnReconnect.onclick = async () => reconnectLeanbot();

async function connectLeanbot() {
    console.log("Disconnect before scan...");
    leanbot.Disconnect();
    console.log("Scanning for Leanbot...");
    const result = await leanbot.Connect();
    console.log("Connect result:", result.message);
}

// utils.UI("btnConnect").onclick = () => {
//   status.textContent = "Connecting...";
//   status.className = "disconnected";
//   utils.log("Connecting to Leanbot...");
//   setTimeout(() => {
//     status.textContent = "Leanbot 123456 BLE";
//     status.className = "connected";
//     utils.log("Connected to Leanbot 123456 BLE");
//   }, 1000);
// };

// utils.UI("btnReconnect").onclick = () => {
//   utils.log("Reconnect clicked (placeholder)");
// };

// // =================== SERIAL BUTTONS =================== //
// utils.UI("btnClear").onclick = () => {
//   utils.UI("serialLog").textContent = "";
// };
// utils.UI("btnCopy").onclick = () => {
//   navigator.clipboard.writeText(utils.UI("serialLog").textContent);
//   alert("Copied Serial Log!");
// };

// // =================== LOG FUNCTION =================== //
// utils.log = function (msg) {
//   const logBox = utils.UI("serialLog");
//   const timestamp = utils.UI("showTimestamp").checked
//     ? "[" + new Date().toLocaleTimeString() + "] "
//     : "";
//   logBox.textContent += timestamp + msg + "\n";
//   if (utils.UI("autoScroll").checked)
//     logBox.scrollTop = logBox.scrollHeight;
// };
