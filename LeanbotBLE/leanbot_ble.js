// leanbot_ble.js
export class LeanbotBLE {

  // ===== SERVICE UUID CHUNG =====
  static SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';

  // ---- PRIVATE MEMBERS ----
  #device = null;
  #server = null;
  #service = null;
  #chars = {};
  #ReconnectWithFilterName = false;
  #lastDevice = null;
  
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
          if (!char) return console.log(`Serial.Send Error: characteristic ${uuid} not found`);

          const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
          await char.writeValue(buffer);
        } catch (e) {
          console.log(`Serial.Send Error: ${e}`);
        }
      },

      /** Gửi nhanh (không chờ phản hồi, tốc độ cao hơn) */
      SendWithoutResponse: async (data) => {
        try {
          const uuid = this.Serial.UUID.toLowerCase();
          const char = this.#chars?.[uuid];
          if (!char) return console.log(`Serial.SendWithoutResponse Error: characteristic ${uuid} not found`);

          const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
          await char.writeValueWithoutResponse(buffer);
        } catch (e) {
          console.log(`Serial.SendWithoutResponse Error: ${e}`);
        }
      },

      enableNotify: async () => {
        const uuid = this.Serial.UUID;
        const char = this.#chars?.[uuid];
        if (!char) return console.log("Serial Notify: UUID not found");
        if (!char.properties.notify) return console.log("Serial Notify: Not supported");

        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", (event) => {
          const msg = new TextDecoder().decode(event.target.value);
          if (this.Serial.OnMessage) this.Serial.OnMessage(msg);
        });

        console.log("Callback Serial.OnMessage: Enabled");
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
          console.log("Uploader Error: RX characteristic not found.");
          return;
        }

        const WebtoLb = this.#chars[this.Uploader.UUID_WebToLb];
        const LINES_PER_BLOCK = 14;
        const lines = hexText.split(/\r?\n/).filter(line => line.trim().length > 0);

        console.log("Uploader: Start uploading HEX...");
        const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
        await WebtoLb.writeValueWithoutResponse(startHeader);
        console.log("Uploader: Sent START header");

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
          console.log(`Uploader: Sent block #${sequence} (${bytes.length} bytes)`);

          sequence++;
        }

        console.log("Uploader: Upload completed!");
      },

      enableNotify: async () => {
        const uuid = this.Uploader.UUID_LbToWeb.toLowerCase();
        const char = this.#chars?.[uuid];
        if (!char) return console.log("Uploader Notify: UUID not found");
        if (!char.properties.notify) return console.log("Uploader Notify: Not supported");

        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", (event) => {
          const msg = new TextDecoder().decode(event.target.value);
          if (this.Uploader.OnMessage) this.Uploader.OnMessage(msg);
        });

        console.log("Callback Uploader.OnMessage: Enabled");
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
      if (this.#ReconnectWithFilterName) {
        // Chọn thiết bị BLE có tên tương ứng
        this.#device = await navigator.bluetooth.requestDevice({
          filters: [{
            name: this.#lastDevice,
            services: [LeanbotBLE.SERVICE_UUID]
          }],
        });
        this.#ReconnectWithFilterName = false;
      } else {
        // Chọn thiết bị BLE có service UUID tương ứng
        this.#device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
        });
      }

      // Lưu tên thiết bị vào localStorage để reconnect sau này
      localStorage.setItem("leanbot_device", JSON.stringify(this.#device.name));

      // Gắn sự kiện ngắt kết nối
      console.log("Callback OnDisconnect: Enabled");
      this.#device.addEventListener("gattserverdisconnected", () => {
        if (this.OnDisconnect) {
          this.OnDisconnect();
        }
      });

        // Thiết lập kết nối BLE
      await this.#setupConnection();

      console.log("Callback OnConnect: Enabled");
      if (this.OnConnect) this.OnConnect();

      return {  
        success: true,
        message: `Connected to ${this.#device.name}`
      };

    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message || "Unknown error"}`
      };
    }
  }

  Disconnect() {
    try {
      // Không có thiết bị nào được lưu
      if (!this.#device) {
        return {
          success: false,
          message: "No device found to disconnect. Please connect a device first."
        };
      }

      // Thiết bị tồn tại nhưng chưa kết nối
      if (!this.#device.gatt.connected) {
        return {
          success: false,
          message: "Device is not currently connected."
        };
      }

      // Ngắt kết nối
      this.#device.gatt.disconnect();

      return {
        success: true,
        message: `Disconnected from ${this.#device.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Disconnect failed: ${error.message || "Unknown error"}`
      };
    }
  }


  async Reconnect() {
    try {
      // Nếu không có thiết bị đã lưu, thử lấy từ localStorage
      if (!this.#device) {
        const lastDevice = localStorage.getItem("leanbot_device");
        this.#lastDevice = lastDevice ? JSON.parse(lastDevice) : null;

        // Nếu có thiết bị đã lưu, thử reconnect với tên đó
        if(this.#lastDevice) {
          this.#ReconnectWithFilterName = true;
        }

        return await this.Connect();
      }

      // Nếu thiết bị vẫn đang kết nối
      if (this.#device.gatt.connected) {
        return {
          success: true,
          message: `Already connected to ${this.#device.name}`
        };
      }

      // Bắt đầu quá trình reconnect
      await this.#setupConnection();

      if (this.OnConnect) this.OnConnect(this.#device);

      return {
        success: true,
        message: `Reconnected to ${this.#device.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Reconnect failed: ${error.message || "Unknown error"}`
      };
    }
  }


  async Rescan() {
    try {
      this.Disconnect();
      return await this.Connect();
    } catch (error) {
      return {
        success: false,
        message: `Rescan failed: ${error.message || "Unknown error"}`
      };
    }
  }

  IsConnected() {
    return this.#device?.gatt.connected === true;
  }

  getLeanbotID() {
    if (!this.#device) return "No device";
    return this.#device.name || "Unknown";
  }

  getLastLeanbotID() {
    const lastDevice = localStorage.getItem("leanbot_device");
    return lastDevice ? JSON.parse(lastDevice) : null;
  }

  async #setupConnection() {
    // Kết nối GATT, lấy service và characteristics
    this.#server = await this.#device.gatt.connect();
    this.#service = await this.#server.getPrimaryService(LeanbotBLE.SERVICE_UUID);

    const chars = await this.#service.getCharacteristics();
    this.#chars = {};
    for (const c of chars) this.#chars[c.uuid] = c;

    // Bật notify cho Serial và Uploader
    await this.Serial.enableNotify();
    await this.Uploader.enableNotify();
  }
}