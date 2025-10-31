// main.js
import { LeanbotBLE } from "./leanbot_ble.js";
import * as utils from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools/sdk_leanbot/leanbot_utils.js";

// =================== FILE SELECTION MODAL =================== //
const btnCode = utils.UI("btnCode");
const modal = utils.UI("fileModal");
const closeModal = utils.UI("closeModal");
const fileNameLabel = utils.UI("fileName");
let loadedHexContent = ""; // lưu nội dung file HEX đã đọc

btnCode.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.querySelectorAll(".fileOption").forEach(btn => {
  btn.addEventListener("click", async e => {
    const filePath = e.target.getAttribute("data-file");
    const fileName = filePath.split("/").pop();
    fileNameLabel.textContent = fileName;
    modal.classList.add("hidden");
    utils.log(`Loaded HEX file: ${fileName}`);
    const text = await fetch(filePath).then(res => res.text());
    loadedHexContent = text;
  });
});

// =================== Button Load HEX =================== //
const btnLoadHex = utils.UI("btnLoadHex");
const fileInput = utils.UI("hexFileInput");

btnLoadHex.addEventListener("click", () => {
  fileInput.click(); // mở hộp chọn file
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // cập nhật tên file hiển thị
  fileNameLabel.textContent = file.name;

  // đọc nội dung HEX
  const text = await file.text();
  loadedHexContent = text;

  console.log(`Loaded HEX file: ${file.name}`);
});


// =================== BLE =================== //

const status = utils.UI("leanbotStatus");
const btnConnect = utils.UI("btnConnect");
const btnReconnect = utils.UI("btnReconnect");

const leanbot = new LeanbotBLE();
console.log("Get last device for reconnect...");
const lastDevice = leanbot.getLastLeanbotID();
status.textContent = lastDevice ? lastDevice : "No Leanbot";

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
    console.log("Scanning for Leanbot...");
    const result = await leanbot.Rescan();
    console.log("Connect result:", result.message);
}

async function reconnectLeanbot() {
    console.log("Reconnecting to Leanbot...");
    const result = await leanbot.Reconnect();
    console.log("Reconnect result:", result.message);
}
