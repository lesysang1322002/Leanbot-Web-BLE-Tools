// leanbot_ble.js
// SDK Leanbot BLE - Quản lý kết nối và giao tiếp BLE với Leanbot

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

        // Chuyển toàn bộ HEX sang gói BLE
        const packets = convertHexToBlePackets(hexText);
        console.log(`Uploader: Prepared ${packets.length} BLE packets`);

        // Gửi lần lượt từng gói
        for (let i = 0; i < packets.length; i++) {
          await WebToLb.writeValueWithoutResponse(packets[i]);
          console.log(`Uploader: Sent block #${i} (${packets[i].length} bytes)`);
          // console.log(Array.from(packets[i]).map(b => b.toString(16).padStart(2, '0')).join(''));
          await new Promise(resolve => setTimeout(resolve, 10));
          // if ((i + 1) % 3 === 0) {
          //   await new Promise(resolve => setTimeout(resolve, 10));
          // }
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

function parseHexLine(line) {
  if (!line.startsWith(":")) return null;
  const hex = line.slice(1);
  const length = parseInt(hex.substr(0, 2), 16);
  const address = parseInt(hex.substr(2, 4), 16);
  const recordType = hex.substr(6, 2);
  const data = hex.substr(8, length * 2);
  const checksum = parseInt(hex.substr(8 + length * 2, 2), 16);
  return { length, address, recordType, data, checksum, hex };
}

// Kiểm tra checksum của dòng HEX
function verifyChecksum(parsed) {
  const { hex, length, checksum } = parsed;
  const allBytes = [];
  for (let i = 0; i < 4 + length; i++) {
    allBytes.push(parseInt(hex.substr(i * 2, 2), 16));
  }
  const sum = allBytes.reduce((a, b) => a + b, 0);
  const calcChecksum = ((~sum + 1) & 0xFF);
  return calcChecksum === checksum;
}

// Chuyển dòng HEX thành mảng byte
function hexLineToBytes(block) {
  const bytes = [];
  for (let i = 0; i < block.length; i += 2) {
    const b = parseInt(block.substr(i, 2), 16);
    if (!isNaN(b)) bytes.push(b);
  }
  return new Uint8Array(bytes);
}

/**
 * Convert Intel HEX text into optimized BLE packets
 * - Parse HEX lines → validate checksum
 * - Merge consecutive lines with continuous addresses
 * - Split into BLE packets of max 236 bytes
 * 
 * @param {string} hexText - HEX file content
 * @returns {Uint8Array[]} packets - Array of BLE message bytes ready to send
 */
function convertHexToBlePackets(hexText) {
  const MAX_BLE_LEN = 512;
  const lines = hexText.split(/\r?\n/).filter(line => line.trim().length > 0);

  // --- STEP 1: Parse each HEX line ---
  const parsedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseHexLine(lines[i].trim());
    if (!parsed) continue;
    if (!verifyChecksum(parsed)) continue;
    const bytes = hexLineToBytes(parsed.data);
    parsedLines.push({ address: parsed.address, bytes: bytes });
  }

  // --- STEP 2: Merge consecutive address blocks ---
  const mergedBlocks = [];
  let current = null;

  for (const line of parsedLines) {
    if (!current) {
      // Dùng spread operator [...] để sao chép dữ liệu, tránh ảnh hưởng mảng gốc
      current = { address: line.address, bytes: [...line.bytes] };
      continue;
    }

    const expectedAddr = current.address + current.bytes.length;
    if (line.address === expectedAddr) {
      current.bytes.push(...line.bytes);
    } else {
      mergedBlocks.push(current);
      current = { address: line.address, bytes: [...line.bytes] };
    }
  }
  if (current) mergedBlocks.push(current);

  // --- STEP 3: Split each merged block into BLE packets (≤ MAX_BLE_LEN bytes) ---
  const packets = [];
  let sequence = 0;
  let lastAddr = 0;

  for (const block of mergedBlocks) {
    const data = block.bytes;

    // Tính delta giữa các block (so với block trước)
    let deltaAddr = 0;

    if (data.length === 0) {
      // Xử lý trường hợp block EOF
      const bytes = new Uint8Array([sequence & 0xFF, deltaAddr]);
      packets.push(bytes);
      break;
    }

    if (packets.length === 0) {
      deltaAddr = 0; // block đầu tiên
    } else {
      const diff = block.address - lastAddr;
      while (diff > 255) {
        // Gửi marker 0xFF (bản tin rỗng)
        const seqByte = sequence & 0xFF;
        const marker = new Uint8Array([seqByte, 0xFF]);
        packets.push(marker);
        sequence++;
        diff -= 255; // giảm dần khoảng cách
      }

      deltaAddr = diff & 0xFF; // phần còn lại (<255)
    }
    
    let offset = 0;

    while (offset < data.length) {
      const remain = data.length - offset;

      if (deltaAddr === 0 && remain >= (MAX_BLE_LEN - 1)) {
        // Loại 1: [Seq][511 data]
        const chunk = data.slice(offset, offset + (MAX_BLE_LEN - 1));
        const bytes = new Uint8Array([sequence & 0xFF, ...chunk]);
        packets.push(bytes);
        offset += (MAX_BLE_LEN - 1);
      } else {
        // Loại 2: [Seq][deltaAddr][≤509 data]
        const chunk = data.slice(offset, offset + (MAX_BLE_LEN - 3));
        const bytes = new Uint8Array([sequence & 0xFF, deltaAddr, ...chunk]);
        packets.push(bytes);
        offset += (MAX_BLE_LEN - 3);
      }

      sequence++;
    }

    lastAddr = block.address + data.length;
  }
  return packets;
}