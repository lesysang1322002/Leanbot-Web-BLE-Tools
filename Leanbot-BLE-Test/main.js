// main.js
import { LeanbotBLE } from "https://raw.githubusercontent.com/lesysang1322002/Leanbot-Web-BLE-Tools/main/sdk_leanbot/leanbot_ble.js";
import { log } from "https://raw.githubusercontent.com/lesysang1322002/Leanbot-Web-BLE-Tools/main/sdk_leanbot/leanbot_utils.js";

const bot = new LeanbotBLE();

bot.OnConnect = (dev) => log(`Connected to ${dev.name}`);
bot.OnDisconnect = (dev) => log(`Disconnected from ${dev.name}`);
bot.Serial.OnSerialMessage = (msg) => log(`[Serial] ${msg}`);
bot.Uploader.OnUploadMessage = (msg) => log(`[Upload] ${msg}`);

document.getElementById("connectBtn").onclick = () => bot.Connect();
document.getElementById("sendBtn").onclick = () => bot.Serial.SendSerialMessage("Hello Leanbot!");
document.getElementById("uploadBtn").onclick = async () => {
  const hex = ":100000000C945C000C946E000C946E000C946E00A4\n:00000001FF";
  await bot.Uploader.Upload(hex);
};
