// leanbot_ble.js
// SDK Leanbot BLE - Quản lý kết nối và giao tiếp BLE với Leanbot
import * as utils from "https://cdn.jsdelivr.net/gh/lesysang1322002/Leanbot-Web-BLE-Tools@latest/sdk_leanbot/leanbot_utils.js";

export class LeanbotBLE {
  // ===== SERVICE UUID CHUNG =====
  static SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';

  // ---- PRIVATE MEMBERS ----
  #device  = null;
  #server  = null;
  #service = null;
  #chars   = {};

  // ---------------- BLE CORE ----------------
  async connect(deviceName = null) {
    try {
      // Nếu deviceName rỗng → quét tất cả thiết bị có service UUID tương ứng
      if (!deviceName || deviceName.trim() === "") {
        this.#device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [LeanbotBLE.SERVICE_UUID] }],
        });
      } 
      // Nếu có deviceName → chỉ quét thiết bị có tên trùng khớp
      else {
        this.#device = await navigator.bluetooth.requestDevice({
          filters: [{
            name: deviceName.trim(),
            services: [LeanbotBLE.SERVICE_UUID],
          }],
        });
      }

      // Lưu tên thiết bị vào localStorage để reconnect sau này
      console.log("Saving device to localStorage:", this.#device.name);
      localStorage.setItem("leanbot_device", JSON.stringify(this.#device.name));

      // Thiết lập kết nối BLE
      await this.#setupConnection();
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

  async reconnect() {
    try {
      if (this.isConnected()) {
        // Nếu đang kết nối rồi thì không cần làm gì
        return {
          success: true,
          message: `Already connected to ${this.#device.name}`
        };
      }

      if (this.#device) {
        // Nếu đã ngắt kết nối thì kết nối lại
        await this.#setupConnection();
        return {
          success: true,
          message: `Reconnected to ${this.#device.name}`
        };
      }

      // Gọi lại Connect nếu không có thiết bị trong phiên làm việc hiện tại
      return await this.connect(this.getLeanbotID());
    } catch (error) {
      return {
        success: false,
        message: `Reconnect failed: ${error.message || "Unknown error"}`
      };
    }
  }

  disconnect() {
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

  isConnected() {
    return this.#device?.gatt.connected === true;
  }

  getLeanbotID() {
    // Nếu phiên làm việc hiện tại có thiết bị thì trả về tên thiết bị đó
    if (this.#device) return this.#device.name;
    
    // Ngược lại lấy từ localStorage
    const lastDevice = localStorage.getItem("leanbot_device");
    return lastDevice ? JSON.parse(lastDevice) : "No Leanbot";
  }

  async #setupConnection() {
    /** ---------- DISCONNECT EVENT ---------- */
    console.log("Callback onDisconnect: Enabled");
    this.#device.addEventListener("gattserverdisconnected", () => {
      if (this.onDisconnect) this.onDisconnect();
    });
    
    /** ---------- GATT CONNECTION ---------- */
    this.#server = await this.#device.gatt.connect();
    this.#service = await this.#server.getPrimaryService(LeanbotBLE.SERVICE_UUID);

    /** ---------- CHARACTERISTICS ---------- */
    const chars = await this.#service.getCharacteristics();
    this.#chars = {};
    for (const c of chars) this.#chars[c.uuid] = c;

    /** ---------- ENABLE NOTIFICATIONS ---------- */
    await this.Serial.enableNotify();
    await this.Uploader.enableNotify();

    /** ---------- CONNECT CALLBACK ---------- */
    console.log("Callback onConnect: Enabled");
    if (this.onConnect) this.onConnect();
  }

  constructor() {
    this.onConnect = null;
    this.onDisconnect = null;

    // ======================================================
    // 🔹 SUBMODULE: SERIAL
    // ======================================================
    this.Serial = {
      // UUID riêng của Serial
      get UUID() {
        return '0000ffe1-0000-1000-8000-00805f9b34fb';
      },

      /** Kiểm tra hỗ trợ Serial */
      isSupported: () => {
        return this.#chars?.[this.Serial.UUID];
      },

      /** Callback khi nhận notify Serial */
      onMessage: null,

      /** Gửi dữ liệu qua đặc tính Serial mặc định (UUID)
       * @param {string|Uint8Array} data - dữ liệu cần gửi
       * @param {boolean} withResponse - true = gửi chờ phản hồi, false = gửi nhanh
       */
      send: async (data, withResponse = true) => {
        try {
          const uuid = this.Serial.UUID;
          const char = this.#chars?.[uuid];
          if (!char) {
            console.log(`Serial.Send Error: characteristic ${uuid} not found`);
            return;
          }

          // Chuyển dữ liệu sang Uint8Array nếu là chuỗi
          const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;

          if (withResponse) {
            await char.writeValue(buffer);
          } else {
            await char.writeValueWithoutResponse(buffer);
          }
        } catch (e) {
          console.log(`Serial.Send Error: ${e}`);
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
          if (this.Serial.onMessage) this.Serial.onMessage(msg);
        });

        console.log("Callback Serial.onMessage: Enabled");
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

      /** Kiểm tra hỗ trợ Uploader */
      isSupported: () => {
        const hasWebToLb = this.#chars?.[this.Uploader.UUID_WebToLb];
        const hasLbToWeb = this.#chars?.[this.Uploader.UUID_LbToWeb];
        return hasWebToLb && hasLbToWeb;
      },  
      
      /** Callback khi nhận notify Uploader */
      onMessage: null,

      /** Upload HEX file */
      upload: async (hexText) => {
        if (!this.#chars || !this.#chars[this.Uploader.UUID_WebToLb]) {
          console.log("Uploader Error: RX characteristic not found.");
          return;
        }

        const WebToLb = this.#chars[this.Uploader.UUID_WebToLb];
        console.log("Uploader: Start uploading HEX...");

        // Gửi header bắt đầu
        const startHeader = new Uint8Array([0xFF, 0x1E, 0xA2, 0xB0, 0x75, 0x00]);
        await WebToLb.writeValueWithoutResponse(startHeader);
        console.log("Uploader: Sent START header");

        // Chuyển toàn bộ HEX sang gói BLE
        const packets = this.Uploader.convertHexToBlePackets(hexText);
        console.log(`Uploader: Prepared ${packets.length} BLE packets`);

        // Gửi lần lượt từng gói
        for (let i = 0; i < packets.length; i++) {
          await WebToLb.writeValueWithoutResponse(packets[i]);
          console.log(`Uploader: Sent block #${i} (${packets[i].length} bytes)`);
        }

        console.log("Uploader: Upload completed!");
      },

      enableNotify: async () => {
        const uuid = this.Uploader.UUID_LbToWeb;
        const char = this.#chars?.[uuid];
        if (!char) return console.log("Uploader Notify: UUID not found");
        if (!char.properties.notify) return console.log("Uploader Notify: Not supported");

        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", (event) => {
          const msg = new TextDecoder().decode(event.target.value);
          if (this.Uploader.onMessage) this.Uploader.onMessage(msg);
        });

        console.log("Callback Uploader.onMessage: Enabled");
      },
    };
  }
}