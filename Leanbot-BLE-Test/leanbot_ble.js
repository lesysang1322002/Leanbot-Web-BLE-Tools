// leanbot_ble.js
import * as utils from "./leanbot_utils.js";

export class LeanbotBLE {

  // ===== SERVICE UUID CHUNG =====
  static SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';

  // ---- PRIVATE MEMBERS ----
  #device = null;
  #server = null;
  #service = null;
  #chars = {};
  
  constructor() {
    this.OnConnect = null;
    this.OnDisconnect = null;

    // ======================================================
    // 🔹 SUBMODULE: SERIAL
    // ======================================================
    this.Serial = {
      // UUID riêng của Serial
      get UUID() {
        return '0000ffe1-0000-1000-8000-00805f9b34fb';
      },

      /** Callback khi nhận notify Serial */
      OnMessage: null,

      /** Gửi dữ liệu qua đặc tính Serial mặc định (UUID) */
      Send: async (data) => {
        try {
          const uuid = this.Serial.UUID.toLowerCase();
          const char = this.#chars?.[uuid];
          if (!char) return utils.log(`Serial.Send Error: characteristic ${uuid} not found`);

          const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
          await char.writeValue(buffer);
          utils.log(`[Serial] Sent (${buffer.length} bytes)`);
        } catch (e) {
          utils.log(`Serial.Send Error: ${e}`);
        }
      },

      /** Gửi nhanh (không chờ phản hồi, tốc độ cao hơn) */
      SendWithoutResponse: async (data) => {
        try {
          const uuid = this.Serial.UUID.toLowerCase();
          const char = this.#chars?.[uuid];
          if (!char) return utils.log(`Serial.SendWithoutResponse Error: characteristic ${uuid} not found`);

          const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
          await char.writeValueWithoutResponse(buffer);
          utils.log(`[Serial] SentWithoutResponse (${buffer.length} bytes)`);
        } catch (e) {
          utils.log(`Serial.SendWithoutResponse Error: ${e}`);
        }
      },

      enableNotify: async () => {
        const uuid = this.Serial.UUID;
        const char = this.#chars?.[uuid];
        if (!char) return utils.log("Serial Notify: UUID not found");
        if (!char.properties.notify) return utils.log("Serial Notify: Not supported");

        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", (event) => {
          const msg = new TextDecoder().decode(event.target.value);
          utils.log(`[Serial RX] ${msg}`);
          if (this.Serial.OnMessage) this.Serial.OnMessage(msg);
        });

        utils.log("Callback Serial.OnMessage: Enabled");
      },

      /** Kiểm tra hỗ trợ Serial */
      supported: () => {
        return this.#chars?.[this.Serial.UUID];
      },
    };

    // ======================================================
    // 🔹 SUBMODULE: UPLOADER
    // ======================================================
    this.Uploader = {
      // UUID riêng của Uploader
      get UUID_WebToLb() {
        return '0000ffe2-0000-1000-8000-00805f9b34fb';
      },
      get UUID_LbToWeb() {
        return '0000ffe3-0000-1000-8000-00805f9b34fb';
      },
      
      /** Callback khi nhận notify Uploader */
      OnMessage: null,

      /** Upload HEX file */
      Upload: async (hexText) => {
        if (!this.#chars || !this.#chars[this.Uploader.UUID_WebToLb]) {
          utils.log("Uploader Error: RX characteristic not found.");
          return;
        }

        const WebtoLb = this.#chars[this.Uploader.UUID_WebToLb];
        const LINES_PER_BLOCK = 14;
        const lines = hexText.split(/\r?\n/).filter(line => line.trim().length > 0);

        utils.log("Uploader: Start uploading HEX...");
        const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
        await WebtoLb.writeValueWithoutResponse(startHeader);
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
          await WebtoLb.writeValueWithoutResponse(bytes);
          utils.log(`Uploader: Sent block #${sequence} (${bytes.length} bytes)`);

          sequence++;
        }

        utils.log("Uploader: Upload completed!");
      },

      enableNotify: async () => {
        const uuid = this.Uploader.UUID_LbToWeb.toLowerCase();
        const char = this.#chars?.[uuid];
        if (!char) return utils.log("Uploader Notify: UUID not found");
        if (!char.properties.notify) return utils.log("Uploader Notify: Not supported");

        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", (event) => {
          const msg = new TextDecoder().decode(event.target.value);
          utils.log(`[Uploader RX] ${msg}`);
          if (this.Uploader.OnMessage) this.Uploader.OnMessage(msg);
        });

        utils.log("Callback Uploader.OnMessage: Enabled");
      },

      /** Kiểm tra hỗ trợ Uploader */
      supported: () => {
        const hasWebToLb = this.#chars?.[this.Uploader.UUID_WebToLb];
        const hasLbToWeb = this.#chars?.[this.Uploader.UUID_LbToWeb];
        return hasWebToLb && hasLbToWeb;
      },  
    };
  }

  // ---------------- BLE CORE ----------------
  async Connect() {
    try {
      // 1️⃣ Chọn thiết bị BLE có service UUID tương ứng
      this.#device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
      });

      localStorage.setItem("leanbot_device", JSON.stringify(this.#device));
      console.log("Saved device to LocalStorage.", this.#device.name);
      let saved = localStorage.getItem("leanbot_device");
      console.log("Loaded device from LocalStorage.");
      saved = JSON.parse(saved);
      console.log("Device ID:", saved.id);
      console.log("Device Name:", saved.name);
      //  Lưu vào LocalStorage
      // this.#saveLastDevice(this.#device);

      // 2️⃣ Gắn sự kiện ngắt kết nối
      console.log("Callback OnDisconnect: Enabled");
      this.#device.addEventListener("gattserverdisconnected", () => {
        if (this.OnDisconnect) {
          this.OnDisconnect();
        }
      });

      // 3️⃣ Kết nối GATT server
      this.#server = await this.#device.gatt.connect();

      // 4️⃣ Lấy service chính
      this.#service = await this.#server.getPrimaryService(LeanbotBLE.SERVICE_UUID);

      // 5️⃣ Lấy toàn bộ characteristics
      const chars = await this.#service.getCharacteristics();
      // Lưu lại toàn bộ characteristic
      this.#chars = {};
      for (const c of chars) this.#chars[c.uuid] = c;

      // --- Bật notify riêng cho từng module ---
      await this.Serial.enableNotify();
      await this.Uploader.enableNotify();

      console.log("Callback OnConnect: Enabled");
      if (this.OnConnect) {
        this.OnConnect();
      }
      return {
        success: true,
        message: `Connected to ${this.#device.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Connect failed: ${error.message}`
      };
    }
  }

  // ============================================================
  // 🔹 PRIVATE: Lưu / Tải thông tin thiết bị BLE
  // ============================================================
  #saveLastDevice(device) {
    try {
      localStorage.setItem(
        "leanbot_last_device", JSON.stringify({ id: device.id, name: device.name })
      );
      utils.log(`Saved device: ${device.name}`);
    } catch (err) {
      utils.log("LocalStorage Save Error: " + err);
    }
  }

  #loadLastDevice() {
    try {
      const saved = localStorage.getItem("leanbot_last_device");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  Disconnect() {
    if (this.#device?.gatt.connected) this.#device.gatt.disconnect();
  }

  async Reconnect() {
    try {
      if (!this.#device) {
        const last = this.#loadLastDevice();
        console.log("Last saved device:", last);
        if (!last) {
          utils.log("No saved device found in LocalStorage.");
          return;
        }
        // Lấy danh sách thiết bị đã được cấp quyền
        const devices = await navigator.bluetooth.getDevices();
        console.log("Previously granted devices:", devices);
        const target = devices.find(d => d.id === last.id || d.name === last.name);

        if (target) {
          this.#device = target;
        } else {
          utils.log("No matching device found.");
          return;
        }
      }

      if (this.#device.gatt.connected) {
        utils.log("Already connected to " + this.#device.name);
        return;
      }

      utils.log("Reconnecting to " + this.#device.name + "...");
      this.#server = await this.#device.gatt.connect();
      this.#service = await this.#server.getPrimaryService(LeanbotBLE.SERVICE_UUID);
      this.char = await this.#service.getCharacteristic(LeanbotBLE.CHAR_UUID);

      utils.log("Reconnected to " + this.#device.name);
      if (this.OnConnect) this.OnConnect(this.#device);
    } catch (e) {
      utils.log("Reconnect failed: " + e);
    }
  }

  async Rescan() {
    try {
      utils.log("Rescanning BLE device...");
      if (!this.#device) {
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
    return this.#device?.gatt.connected === true;
  }

  getLeanbotID() {
    if (!this.#device) return "No device";
    return this.#device.name || "Unknown";
  }

}