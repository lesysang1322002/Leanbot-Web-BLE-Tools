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
    for (const c of chars) this.#chars[c.uuid.toLowerCase()] = c;

    this.SerialChar      = this.#chars[ this.Serial.UUID ] || null;
    this.UploaderWebToLb = this.#chars[ this.Uploader.UUID_WebToLb ] || null;
    this.UploaderLbToWeb = this.#chars[ this.Uploader.UUID_LbToWeb ] || null;

    /** ---------- SETUP MODULES ---------- */
    await this.Serial.setup();
    await this.Uploader.setup();

    /** ---------- CONNECT CALLBACK ---------- */
    console.log("Callback onConnect: Enabled");
    if (this.onConnect) this.onConnect();
  }

  constructor() {
    this.onConnect = null;
    this.onDisconnect = null;

    // Chứa characteristic để truy cập nhanh
    this.SerialChar = null;
    this.UploaderWebToLb = null;
    this.UploaderLbToWeb = null;

    // ======================================================
    // 🔹 SUBMODULE: SERIAL
    // ======================================================
    this.Serial = {
      // UUID riêng của Serial
      get UUID() {
        return '0000ffe1-0000-1000-8000-00805f9b34fb';
      },

      /** Kiểm tra hỗ trợ Serial */
      isSupported: () => !!this.SerialChar,

      /** Callback khi nhận notify Serial */
      onMessage: null,

      /** Gửi dữ liệu qua đặc tính Serial mặc định (UUID)
       * @param {string|Uint8Array} data - dữ liệu cần gửi
       * @param {boolean} withResponse - true = gửi chờ phản hồi, false = gửi nhanh
       */
      send: async (data, withResponse = true) => {
        try {
          if (!this.Serial.isSupported()) {
            console.log("Serial.Send Error: Serial not supported");
            return;
          }

          // Chuyển dữ liệu sang Uint8Array nếu là chuỗi
          const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;

          if (withResponse) {
            await this.SerialChar.writeValue(buffer);
          } else {
            await this.SerialChar.writeValueWithoutResponse(buffer);
          }
        } catch (e) {
          console.log(`Serial.Send Error: ${e}`);
        }
      },

      setup: async () => {
        if (!this.Serial.isSupported()) {
          console.log("Serial Notify: Serial not supported");
          return;
        }

        if (!this.SerialChar.properties.notify) {
          console.log("Serial Notify: Not supported");
          return;
        }

        await this.SerialChar.startNotifications();
        this.SerialChar.addEventListener("characteristicvaluechanged", (event) => {
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
      isSupported: () => !!this.UploaderWebToLb && !!this.UploaderLbToWeb,
      
      /** Callback khi nhận notify Uploader */
      onMessage: null,
      
      upload: async (hexText) => {
        if (!this.Uploader.isSupported()) {
          console.log("Uploader Error: Uploader characteristic not found.");
          return;
        }

        console.log("Uploader: Start uploading HEX...");

        // Chuyển toàn bộ HEX sang gói BLE
        const packets = convertHexToBlePackets(hexText);
        console.log(`Uploader: Prepared ${packets.length} BLE packets`);

        // === Sau khi tạo packets ===
        const BlockBufferSize = 4;
        let nextToSend = 0;
        let msgQueue = [];
        let isProcessing = false;

        console.log("Uploader: Start upload (4-block mode)");

        // Callback BLE: khi nhận được message
        this.Uploader.onMessage = (msg) => {
          msgQueue.push(msg.trim());
          processQueue();
        };

        // Hàm xử lý queue
        const processQueue = async () => {
          if (isProcessing) return;
          isProcessing = true;

          while (msgQueue.length > 0) {
            const currentMsg = msgQueue.shift();
            // console.log(`Uploader Received: ${currentMsg}`);

            if (typeof this.Uploader.previousOnMessage === "function") {
              this.Uploader.previousOnMessage(currentMsg + '\n');
            }

            const lines = currentMsg.split(/\r?\n/);
            for (const line of lines) {
              if (!line.trim()) continue;
              const match = line.match(/Receive\s+(\d+)/i);
              if (!match) return;

              const received = parseInt(match[1]);
              console.log(`Uploader: Received feedback for block #${received}`);

              // Nếu chưa tới lượt gửi → thoát
              if (nextToSend !== received + BlockBufferSize) return;

              // Nếu đã gửi hết → thoát
              if (nextToSend >= packets.length) return;

              console.log(`Uploader: Sending block #${nextToSend}`);
              await this.UploaderWebToLb.writeValueWithoutResponse(packets[nextToSend]);
              nextToSend++;
            }
          }

          isProcessing = false;
        };

        // --- Gửi 4 block đầu tiên ---
        for (let i = 0; i < Math.min(BlockBufferSize, packets.length); i++) {
          await this.UploaderWebToLb.writeValueWithoutResponse(packets[i]);
          console.log(`Uploader: Sent block #${i}`);
          nextToSend++;
        }

        console.log("Waiting for Receive feedback...");
      },

      setup: async () => {
        if (!this.Uploader.isSupported()) {
          console.log("Uploader Notify: Uploader not supported");
          return;
        }

        if (!this.UploaderLbToWeb.properties.notify) {
          console.log("Uploader Notify: Not supported");
          return;
        }

        await this.UploaderLbToWeb.startNotifications();
        this.UploaderLbToWeb.addEventListener("characteristicvaluechanged", (event) => {
          const msg = new TextDecoder().decode(event.target.value);
          if (this.Uploader.onMessage) this.Uploader.onMessage(msg);
        });

        console.log("Callback Uploader.onMessage: Enabled");

        // Lưu callback gốc để không bị ghi đè
        this.Uploader.previousOnMessage = this.Uploader.onMessage;

        // Gửi text command sang Leanbot qua UUID Lb2Web để thiết lập tham số nếu có
        if (window.BLE_Interval) {
          const cmd = `SET BLE_INTERVAL ${window.BLE_Interval}`;
          await this.UploaderLbToWeb.writeValueWithoutResponse(new TextEncoder().encode(cmd));
          console.log(`Uploader: Set BLE Interval = ${window.BLE_Interval} ms`);
        } 

        if (window.BLE_MaxLength) {
          const cmd = `SET BLE_MAX_LENGTH ${window.BLE_MaxLength}`;
          await this.UploaderLbToWeb.writeValueWithoutResponse(new TextEncoder().encode(cmd));
          console.log(`Uploader: Set BLE Max Length = ${window.BLE_MaxLength} bytes`);
        }
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
  const BLE_MaxLength = window.BLE_MaxLength || 512; // Mặc định 512 nếu không có thiết lập
  console.log(`convertHexToBlePackets: Using BLE_MaxLength = ${BLE_MaxLength}`);

  // --- STEP 0: Split HEX text into lines ---
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

  // --- STEP 3: Split each merged block into BLE packets (≤ BLE_MaxLength bytes) ---
  const packets = [];
  let sequence = 0;
  let lastAddr = 0;

  for (const block of mergedBlocks) {
    const data = block.bytes;
    const isLastBlock = block === mergedBlocks[mergedBlocks.length - 2]; // block EOF không tính

    // Tính delta giữa các block (so với block trước)
    let deltaAddr = 0;

    if (packets.length === 0) {
      deltaAddr = 0; // block đầu tiên
    } else {
      const diff = block.address - lastAddr;
      while (diff > 0x7F) {
        // Gửi marker 0x7F (bản tin rỗng)
        const seqByte = sequence & 0xFF;
        const marker = new Uint8Array([seqByte, 0x7F]);
        packets.push(marker);
        sequence++;
        diff -= 0x7F; // giảm dần khoảng cách
      }

      deltaAddr = diff & 0x7F; // giới hạn trong [0x00, 0x7F]
    }
    
    let offset = 0;

    while (offset < data.length) {
      const remain = data.length - offset;

      const isFinalPacket = isLastBlock && (offset + (BLE_MaxLength - 1) >= data.length);

      if (deltaAddr === 0 && remain >= (BLE_MaxLength - 1)) {
        // Loại 1: [Seq][511 data]
        const chunk = data.slice(offset, offset + (BLE_MaxLength - 1));
        const bytes = new Uint8Array([sequence & 0xFF, ...chunk]);
        packets.push(bytes);
        offset += (BLE_MaxLength - 1);
      } else {
        // Loại 2: [Seq][deltaAddr][≤509 data]
        const chunk = data.slice(offset, offset + (BLE_MaxLength - 3));
        const effectiveDelta = isFinalPacket ? (0xFF - deltaAddr) : deltaAddr;
        const bytes = new Uint8Array([sequence & 0xFF, effectiveDelta, ...chunk]);
        packets.push(bytes);
        offset += (BLE_MaxLength - 3);
      }

      sequence++;
    }

    lastAddr = block.address + data.length;
  }
  return packets;
}