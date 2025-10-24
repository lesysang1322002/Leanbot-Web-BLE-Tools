// leanbot_ble.js
import { log } from "./leanbot_utils.js";

export class LeanbotBLE {

  // ===== UUID BLE MẶC ĐỊNH =====
  static SERVICE_UUID  = '0000ffe0-0000-1000-8000-00805f9b34fb';
  static CHAR_UUID     = '0000ffe1-0000-1000-8000-00805f9b34fb';
  // static WEB_TX_UUID   = '0000ffe2-0000-1000-8000-00805f9b34fb';
  // static WEB_RX_UUID   = '0000ffe3-0000-1000-8000-00805f9b34fb';

  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.char = null;

    this.OnConnect = null;
    this.OnDisconnect = null;

    // // --- Submodules ---
    // this.Serial = {
    //   SendSerialMessage: async (msg) => this.#sendSerial(msg),
    //   OnSerialMessage: null,
    // };

    // this.Uploader = {
    //   Upload: async (hexText) => this.#uploadHEX(hexText),
    //   OnUploadMessage: null,
    // };
  }

  // ---------------- BLE CORE ----------------
  async Connect() {
    try {
      log("Requesting BLE device...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
      });

      this.device.addEventListener("gattserverdisconnected", () => {
        if (this.OnDisconnect) this.OnDisconnect(this.device);
      });

      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(LeanbotBLE.SERVICE_UUID);
      this.char = await this.service.getCharacteristic(LeanbotBLE.CHAR_UUID);

      log(`Connected: ${this.device.name}`);
      if (this.OnConnect) this.OnConnect(this.device);
    } catch (e) {
      log("Connection failed: " + e);
    }
  }

  Disconnect() {
    log("Disconnecting...");
    if (this.device?.gatt.connected) this.device.gatt.disconnect();
  }

  async Reconnect() {
    try {
      if (!this.device) {
        log("No previous device found. Use Connect() first.");
        return;
      }

      if (this.device.gatt.connected) {
        log("Already connected to " + this.device.name);
        return;
      }

      log("Reconnecting to " + this.device.name + "...");
      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(LeanbotBLE.SERVICE_UUID);
      this.char = await this.service.getCharacteristic(LeanbotBLE.CHAR_UUID);

      log("Reconnected to " + this.device.name);
      if (this.OnConnect) this.OnConnect(this.device);
    } catch (e) {
      log("Reconnect failed: " + e);
    }
  }

  async Rescan() {
    try {
      log("Rescanning BLE device...");
      this.Disconnect();
      await this.Connect();
    } catch (e) {
      log("Rescan failed: " + e);
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
//       log("Requesting BLE device...");
//       this.device = await navigator.bluetooth.requestDevice({
//         filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
//       });

//       this.device.addEventListener("gattserverdisconnected", () => {
//         log(`Disconnected: ${this.device.name}`);
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

//       log(`Connected: ${this.device.name}`);
//       if (this.OnConnect) this.OnConnect(this.device);
//     } catch (e) {
//       log("Connection failed: " + e);
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
// //       log("Serial characteristic not available");
// //       return;
// //     }
// //     const bytes = new TextEncoder().encode(msg);
// //     await this.txChar.writeValueWithoutResponse(bytes);
// //     log(`[Serial] Sent: ${msg}`);
// //   }

// //   // ---------------- UPLOADER ----------------
// //   async #uploadHEX(hexText) {
// //     if (!this.txChar) {
// //       log("Upload characteristic not available");
// //       return;
// //     }

// //     const lines = hexText.split(/\r?\n/).filter((l) => l.trim().length > 0);
// //     const LINES_PER_BLOCK = 8;

// //     // Gửi header START
// //     const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
// //     await this.txChar.writeValueWithoutResponse(startHeader);
// //     log("⬆️ Upload started");

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

// //     log("✅ Upload completed");
// //   }
// }
