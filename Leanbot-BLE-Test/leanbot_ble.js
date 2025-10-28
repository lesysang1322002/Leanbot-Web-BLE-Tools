// leanbot_ble.js
import * as utils from "./leanbot_utils.js";

export class LeanbotBLE {

  // ===== UUID BLE MẶC ĐỊNH =====
  static SERVICE_UUID   = '0000ffe0-0000-1000-8000-00805f9b34fb';
  static CHAR_UUID      = '0000ffe1-0000-1000-8000-00805f9b34fb';
  static ESP32_RX       = '0000ffe2-0000-1000-8000-00805f9b34fb';
  static ESP32_TX       = '0000ffe3-0000-1000-8000-00805f9b34fb';

  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.char = null;

    this.OnConnect = null;
    this.OnDisconnect = null;

    // --- Submodules ---
  this.Serial = {
    /** Đăng ký callback nhận notify cho từng UUID */
    OnMessage: (uuid, callback) => {
      if (!this._onMessageMap) this._onMessageMap = {};
      this._onMessageMap[uuid.toLowerCase()] = callback;
    },

    /** Gửi dữ liệu qua characteristic có hỗ trợ write */
    Send: async (uuid, data) => {
      try {
        const char = this.chars?.[uuid.toLowerCase()];
        if (!char) return utils.log(`Send Error: characteristic ${uuid} not found`);
        const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
        await char.writeValue(buffer);
        utils.log(`[${uuid}] Sent (${buffer.length} bytes)`);
      } catch (e) {
        utils.log(`Send Error: ${e}`);
      }
    },

    /** Gửi nhanh (không chờ phản hồi, tốc độ cao hơn) */
    SendWithoutResponse: async (uuid, data) => {
      try {
        const char = this.chars?.[uuid.toLowerCase()];
        if (!char) return utils.log(`Send Error: characteristic ${uuid} not found`);
        const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
        await char.writeValueWithoutResponse(buffer);
        utils.log(`[${uuid}] SentWithoutResponse (${buffer.length} bytes)`);
      } catch (e) {
        utils.log(`SendWithoutResponse Error: ${e}`);
      }
    },
  };

  // --- Submodules ---
  this.Uploader = {
    /**
     * Upload nội dung HEX qua BLE (blocking until done)
     * @param {string} hexText - nội dung file .hex
     */
    Upload: async (hexText) => {
      if (!this.chars || !this.chars[LeanbotBLE.ESP32_RX]) {
        utils.log("Uploader Error: RX characteristic not found.");
        return;
      }

      const rxChar = this.chars[LeanbotBLE.ESP32_RX];
      const LINES_PER_BLOCK = 14;
      const lines = hexText.split(/\r?\n/).filter(line => line.trim().length > 0);

      utils.log("Uploader: Start uploading HEX...");
      const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
      await rxChar.writeValueWithoutResponse(startHeader);
      utils.log("Uploader: Sent START header");

      let sequence = 0;
      for (let i = 0; i < lines.length;) {
        const rawLine = lines[i].trim();
        const parsed = utils.parseHexLine(rawLine);
        if (!parsed || !utils.verifyChecksum(parsed)) { i++; continue; }

        // Ghép các dòng liên tiếp
        let block = parsed.hex.substr(2, 4) + parsed.data;
        let baseLen = parsed.length;
        let currentAddr = parsed.address;
        let lineCount = 1;

        for (let j = i + 1; j < lines.length && lineCount < LINES_PER_BLOCK; j++) {
          const next = utils.parseHexLine(lines[j].trim());
          if (!next || !utils.verifyChecksum(next)) break;
          const expectedAddr = currentAddr + baseLen;
          if (next.address !== expectedAddr) break;
          block += next.data;
          currentAddr = next.address;
          baseLen = next.length;
          lineCount++;
          i = j;
        }

        i++;

        // Gửi block
        const header = sequence.toString(16).padStart(2, "0").toUpperCase();
        const payload = header + block;
        const bytes = utils.hexLineToBytes(payload);
        await rxChar.writeValueWithoutResponse(bytes);
        utils.log(`Uploader: Sent block #${sequence} (${bytes.length} bytes)`);

        sequence++;
      }

      utils.log("Uploader: Upload completed!");
    },
    OnUploadMessage: null,
    
  };
  // --- Gắn cố định callback notify của ESP32_TX ---
  this.Serial.OnMessage(LeanbotBLE.ESP32_TX, (msg) => {
    if (this.Uploader.OnUploadMessage) {
      this.Uploader.OnUploadMessage(msg);
    } else {
      log(`[ESP32_TX] ${msg}`);
    }
  });
  }

  // ---------------- BLE CORE ----------------
  async Connect() {
    try {
      utils.log("Scanning Leanbot...");
      // 1️⃣ Chọn thiết bị BLE có service UUID tương ứng
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
      });

      // 2️⃣ Gắn sự kiện ngắt kết nối
      this.device.addEventListener("gattserverdisconnected", () => {
        if (this.OnDisconnect) this.OnDisconnect(this.device);
      });

      // 3️⃣ Kết nối GATT server
      this.server = await this.device.gatt.connect();

      // 4️⃣ Lấy service chính
      this.service = await this.server.getPrimaryService(LeanbotBLE.SERVICE_UUID);

      // 5️⃣ Lấy toàn bộ characteristics
      const chars = await this.service.getCharacteristics();
      this.chars = {};
      this.OnMessage = this.OnMessage || {}; // khởi tạo bảng callback

      for (const c of chars) {
        const uuid = c.uuid.toLowerCase();
        this.chars[uuid] = c;

        // Bật notify nếu có hỗ trợ
        if (c.properties.notify) {
          await c.startNotifications();
          c.addEventListener("characteristicvaluechanged", (event) => {
            const msg = new TextDecoder().decode(event.target.value);
            const handler = this._onMessageMap?.[uuid];
            if (handler) handler(msg);
          });
        }
      }

    utils.log(`Connected: ${this.device.name}`);
    if (this.OnConnect) this.OnConnect(this.device);
    return this.device;

    } catch (e) {
      utils.log("Connection failed: " + e);
      return null;
    }
  }

  Disconnect() {
    utils.log("Disconnecting...");
    if (this.device?.gatt.connected) this.device.gatt.disconnect();
  }

  async Reconnect() {
    try {
      if (!this.device) {
        utils.log("No previous device found. Use Connect() first.");
        return;
      }

      if (this.device.gatt.connected) {
        utils.log("Already connected to " + this.device.name);
        return;
      }

      utils.log("Reconnecting to " + this.device.name + "...");
      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(LeanbotBLE.SERVICE_UUID);
      this.char = await this.service.getCharacteristic(LeanbotBLE.CHAR_UUID);

      utils.log("Reconnected to " + this.device.name);
      if (this.OnConnect) this.OnConnect(this.device);
    } catch (e) {
      utils.log("Reconnect failed: " + e);
    }
  }

  async Rescan() {
    try {
      utils.log("Rescanning BLE device...");
      if (!this.device) {
        utils.log("No previous device found to rescan.");
        return;
      }
      this.Disconnect();
      await this.Connect();
      utils.log("Rescan completed.");
    } catch (e) {
      utils.log("Rescan failed: " + e);
    }
  }


  IsConnected() {
    return this.device?.gatt.connected === true;
  }

  getLeanbotID() {
    if (!this.device) return "No device";
    return this.device.name || "Unknown";
  }

}

// export class LeanbotBLE {

//   // ===== UUID BLE MẶC ĐỊNH =====
//   static SERVICE_UUID  = '0000ffe0-0000-1000-8000-00805f9b34fb';
//   static CHAR_UUID     = '0000ffe1-0000-1000-8000-00805f9b34fb';
//   static WEB_TX_UUID   = '0000ffe2-0000-1000-8000-00805f9b34fb';
//   static WEB_RX_UUID   = '0000ffe3-0000-1000-8000-00805f9b34fb';

//   constructor() {
//     this.device = null;
//     this.server = null;
//     this.service = null;
//     this.txChar = null;
//     this.rxChar = null;

//     this.OnConnect = null;
//     this.OnDisconnect = null;

//     // // --- Submodules ---
//     // this.Serial = {
//     //   SendSerialMessage: async (msg) => this.#sendSerial(msg),
//     //   OnSerialMessage: null,
//     // };

//     // this.Uploader = {
//     //   Upload: async (hexText) => this.#uploadHEX(hexText),
//     //   OnUploadMessage: null,
//     // };
//   }

//   // ---------------- BLE CORE ----------------
//   async Connect() {
//     try {
//       utils.log("Requesting BLE device...");
//       this.device = await navigator.bluetooth.requestDevice({
//         filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
//       });

//       this.device.addEventListener("gattserverdisconnected", () => {
//         utils.log(`Disconnected: ${this.device.name}`);
//         if (this.OnDisconnect) this.OnDisconnect(this.device);
//       });

//       this.server = await this.device.gatt.connect();
//       this.service = await this.server.getPrimaryService(LeanbotBLE.SERVICE_UUID);
//       this.txChar = await this.service.getCharacteristic(LeanbotBLE.CHAR_UUID);

//       await this.txChar.startNotifications();
//       this.txChar.addEventListener("characteristicvaluechanged", (event) => {
//         const msg = new TextDecoder().decode(event.target.value);
//         if (this.Serial.OnSerialMessage) this.Serial.OnSerialMessage(msg);
//       });

//       utils.log(`Connected: ${this.device.name}`);
//       if (this.OnConnect) this.OnConnect(this.device);
//     } catch (e) {
//       utils.log("Connection failed: " + e);
//     }
//   }

//   Disconnect() {
//     if (this.device?.gatt.connected) this.device.gatt.disconnect();
//   }

//   async Reconnect() {
//     if (this.device && !this.device.gatt.connected) {
//       await this.Connect();
//     }
//   }

//   IsConnected() {
//     return this.device?.gatt.connected || false;
//   }

//   getLeanbotID() {
//     return this.device ? `${this.device.name} BLE` : "No device connected";
//   }

// //   // ---------------- SERIAL ----------------
// //   async #sendSerial(msg) {
// //     if (!this.txChar) {
// //       utils.log("Serial characteristic not available");
// //       return;
// //     }
// //     const bytes = new TextEncoder().encode(msg);
// //     await this.txChar.writeValueWithoutResponse(bytes);
// //     utils.log(`[Serial] Sent: ${msg}`);
// //   }

// //   // ---------------- UPLOADER ----------------
// //   async #uploadHEX(hexText) {
// //     if (!this.txChar) {
// //       utils.log("Upload characteristic not available");
// //       return;
// //     }

// //     const lines = hexText.split(/\r?\n/).filter((l) => l.trim().length > 0);
// //     const LINES_PER_BLOCK = 8;

// //     // Gửi header START
// //     const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
// //     await this.txChar.writeValueWithoutResponse(startHeader);
// //     utils.log("⬆️ Upload started");

// //     let seq = 0;
// //     for (let i = 0; i < lines.length; i += LINES_PER_BLOCK) {
// //       const blockLines = lines.slice(i, i + LINES_PER_BLOCK).join("\n");
// //       const blockBytes = new TextEncoder().encode(seq.toString().padStart(2, "0") + ":" + blockLines);

// //       await this.txChar.writeValueWithoutResponse(blockBytes);
// //       if (this.Uploader.OnUploadMessage)
// //         this.Uploader.OnUploadMessage(`Sent block #${seq}`);

// //       seq++;
// //       await delay(5);
// //     }

// //     utils.log("✅ Upload completed");
// //   }
// }
