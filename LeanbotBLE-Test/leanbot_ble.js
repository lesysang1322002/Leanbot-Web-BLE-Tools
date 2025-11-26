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
      console.log("Device disconnected", this.#device.name);
      if (this.onDisconnect) this.onDisconnect();
      
      if (this.Uploader.isTransferring === false) {
        if(this.Uploader.onTransferError) this.Uploader.onTransferError();
      }
      
    });
    
    /** ---------- GATT CONNECTION ---------- */
    this.#server = await this.#device.gatt.connect();
    this.#service = await this.#server.getPrimaryService(LeanbotBLE.SERVICE_UUID);

    /** ---------- CHARACTERISTICS ---------- */
    const chars = await this.#service.getCharacteristics();
    this.#chars = {};
    for (const c of chars) this.#chars[c.uuid.toLowerCase()] = c;
    
    /** ---------- SETUP SUB-CONNECTIONS ---------- */
    await this.Serial.setupConnection(this.#chars);
    await this.Uploader.setupConnection(this.#chars, window.BLE_MaxLength, window.BLE_Interval);

    /** ---------- CONNECT CALLBACK ---------- */
    console.log("Callback onConnect: Enabled");
    if (this.onConnect) this.onConnect();

    //** --------- SAVE DEVICENAME TO LOCALSTORAGE --------- */
    console.log("Saving device to localStorage:", this.#device.name);
    localStorage.setItem("leanbot_device", JSON.stringify(this.#device.name));
  }

  constructor() {
    this.onConnect = null;
    this.onDisconnect = null;
    
    this.Serial = new Serial(this);
    this.Uploader = new Uploader(this);
  }
}

// ======================================================
// 🔹 SUBMODULE: SERIAL
// ======================================================
class Serial {
  // UUID riêng của Serial
  static SerialPipe_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
  #SerialPipe_char = null;

  /** Kiểm tra hỗ trợ Serial */
  isSupported() {
    return !!this.#SerialPipe_char;
  }

  /** Callback khi nhận notify Serial */
  onMessage = null;

  // Queue nhận dữ liệu
  #SerialPipe_rxQueue = [];
  #SerialPipe_rxTSQueue = [];
  #SerialPipe_busy   = false;
  #SerialPipe_buffer = "";
  #SerialPipe_lastTS = null;

  /** Gửi dữ liệu qua đặc tính Serial mặc định (UUID)
   * @param {string|Uint8Array} data - dữ liệu cần gửi
   * @param {boolean} withResponse - true = gửi chờ phản hồi, false = gửi nhanh
   */
  async send(data, withResponse = true) {
    try {
      if (!this.isSupported()) {
        console.log("Serial.Send Error: Serial not supported");
        return;
      }

      // Chuyển dữ liệu sang Uint8Array nếu là chuỗi
      const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;

      await this.#SerialPipe_sendToLeanbot(buffer, withResponse);
    } catch (e) {
      console.log(`Serial.Send Error: ${e}`);
    }
  }

  /** Thiết lập characteristic + notify **/
  async setupConnection(characteristics) {
    this.#SerialPipe_char = characteristics[Serial.SerialPipe_UUID] || null;

    if (!this.isSupported()) {
      console.log("Serial Notify: Serial not supported");
      return;
    }

    if (!this.#SerialPipe_char.properties.notify) {
      console.log("Serial Notify: Not supported");
      return;
    }

    await this.#SerialPipe_char.startNotifications();
    this.#SerialPipe_char.addEventListener("characteristicvaluechanged", (event) => {
      const BLEPacket = new TextDecoder().decode(event.target.value);
      const Packet_TS = new Date();
      this.#SerialPipe_onReceiveFromLeanbot(BLEPacket, Packet_TS);
    });

    console.log("Callback Serial.onMessage: Enabled");
  }

  #SerialPipe_rxQueueHandler() {
    if (this.#SerialPipe_busy) return;
    this.#SerialPipe_busy = true;

    while (this.#SerialPipe_rxQueue.length > 0) {

      let BLEPacket = this.#SerialPipe_rxQueue.shift();
      const PacketTS  = this.#SerialPipe_rxTSQueue.shift();

      if (BLEPacket === "AT+NAME\r\n")  continue;
      if (BLEPacket === "LB999999\r\n") BLEPacket = ">>> Leanbot ready >>>\n\n";

      this.#SerialPipe_buffer += BLEPacket;

      if (!BLEPacket.includes("\n")) continue;

      const timestamp = formatTimestamp(PacketTS);

      let gap = this.#SerialPipe_lastTS ? (PacketTS - this.#SerialPipe_lastTS) / 1000 : 0;
      this.#SerialPipe_lastTS = PacketTS;

      let lines = this.#SerialPipe_buffer.split("\n");
      this.#SerialPipe_buffer = "";

      for (let i = 0; i < lines.length - 1; i++) { // Khi split thì thừa 1 dòng rỗng ở cuối rỗng nên bỏ qua
        const line = lines[i] + "\n";
        const timegap = i === 0 ? gap : 0;         // Chỉ dòng đầu tiên mới có timegap, các dòng sau là 0
        if (this.onMessage) this.onMessage(line, timestamp, timegap.toFixed(3));
      }
    }

    this.#SerialPipe_busy = false;
  }

  // ========== Serial Pipe Communication ==========
  async #SerialPipe_sendToLeanbot(packet, withResponse) {
    if (withResponse) {
      await this.#SerialPipe_char.writeValue(packet);
    } else {
      await this.#SerialPipe_char.writeValueWithoutResponse(packet);
    }
  }

  async #SerialPipe_onReceiveFromLeanbot(BLEPacket, Packet_TS){
    this.#SerialPipe_rxQueue.push(BLEPacket);
    this.#SerialPipe_rxTSQueue.push(Packet_TS);
    setTimeout(() => this.#SerialPipe_rxQueueHandler(), 0);
  }
}

// ======================================================
// 🔹 SUBMODULE: UPLOADER
// ======================================================
class Uploader {
  static DataPipe_UUID    = '0000ffe2-0000-1000-8000-00805f9b34fb';
  static ControlPipe_UUID = '0000ffe3-0000-1000-8000-00805f9b34fb';

  // ---- PRIVATE MEMBERS ----

  // Characteristics
  #DataPipe_char     = null;
  #ControlPipe_char  = null;

  // Upload state
  #packets           = [];
  #nextToSend        = 0;
  #PacketBufferSize  = 4;
  #totalBytesData    = 0;
  
  // Queue state
  #ControlPipe_rxQueue = [];
  #ControlPipe_busy = false;

  // ===== User Callbacks =====
  onMessage  = null;
  onTransfer = null;
  onWrite    = null;
  onVerify   = null;
  onRSSI     = null;
  onSuccess  = null;
  onError    = null;
  
  isTransferring  = null;
  onTransferError = null;
  onWriteError    = null;
  onVerifyError   = null;

  /** Kiểm tra hỗ trợ Uploader */
  isSupported() {
    return !!this.#DataPipe_char && !!this.#ControlPipe_char;
  }

  /** Upload HEX */
  async upload(hexText) {
    if (!this.isSupported()) {
      console.log("Uploader Error: Uploader characteristic not found.");
      return;
    }

    console.log("Uploader: Start uploading HEX...");
    
    // Chuyển toàn bộ HEX sang gói BLE
    this.#packets = convertHexToBlePackets(hexText);

    const totalBytes = this.#packets.reduce((a, p) => a + p.length, 0);
    const dataBytes = totalBytes - this.#packets.length - 1; // trừ đi header (1 byte) và EOF block (1 byte)
    this.#totalBytesData = Math.ceil(dataBytes / 128) * 128; // Làm tròn lên bội số của 128 bytes

    // Reset trạng thái upload
    this.#nextToSend = 0;
    this.#ControlPipe_rxQueue = [];
    this.#ControlPipe_busy = false;

    console.log("Uploader: Start uploading");

    for (let i = 0; i < Math.min(this.#PacketBufferSize, this.#packets.length); i++) {
      await this.#DataPipe_sendToLeanbot(this.#packets[i]);
      console.log(`Uploader: Sent packet #${i}`);
      this.#nextToSend++;
    }

    console.log("Waiting for Receive feedback...");
  }

  /** Setup Char + Notify + Queue */
  async setupConnection(characteristics, BLE_MaxLength, BLE_Interval) {
    this.#DataPipe_char    = characteristics[Uploader.DataPipe_UUID] || null;
    this.#ControlPipe_char = characteristics[Uploader.ControlPipe_UUID] || null;

    if (!this.isSupported()) {
      console.log("Uploader Notify: Uploader not supported");
      return;
    }

    if (!this.#ControlPipe_char.properties.notify) {
      console.log("Uploader Notify: Not supported");
      return;
    }

    await this.#ControlPipe_char.startNotifications();
    this.#ControlPipe_char.addEventListener("characteristicvaluechanged", (event) => {
      const BLEPacket = new TextDecoder().decode(event.target.value);
      this.#ControlPipe_onReceiveFromLeanbot(BLEPacket);
    });

    console.log("Callback Uploader.onMessage: Enabled");

    // Các lệnh thiết lập (nếu có)
    if (BLE_MaxLength) {
      const cmd = `SET BLE_MAX_LENGTH ${BLE_MaxLength}`;
      await this.#ControlPipe_sendToLeanbot(new TextEncoder().encode(cmd));
      console.log(`Uploader: Set BLE Max Length = ${BLE_MaxLength}`);
    }

    if (BLE_Interval) {
      const cmd = `SET BLE_INTERVAL ${BLE_Interval}`;
      await this.#ControlPipe_sendToLeanbot(new TextEncoder().encode(cmd));
      console.log(`Uploader: Set BLE Interval = ${BLE_Interval}`);
    }
  }

  // ========== Queue handler ==========
  async #ControlPipe_rxQueueHandler() {
    if (this.#ControlPipe_busy) return;
    this.#ControlPipe_busy = true;

    while (this.#ControlPipe_rxQueue.length > 0) {
      const BLEPacket = this.#ControlPipe_rxQueue.shift();
      const LineMessages = BLEPacket.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

      for (const LineMessage of LineMessages) {
        await this.#onMessageInternal(LineMessage);
        if (this.onMessage) this.onMessage(LineMessage);
      }
    }

    this.#ControlPipe_busy = false;
  };

  // ========== Message Processor ==========
  async #onMessageInternal(LineMessage) {
    let m = null;

    // RSSI
    if (m = [...LineMessage.matchAll(/\[(-?\d+(?:\.\d+)?)\]/g)]) {
      // LineMessage = [2.897] [-54.3] Receive 56
      // m[0][0] = [2.897], m[1][0] = [-54.3]
      const rssi = m[1][1]; // rssi = -54.3
      if(this.onRSSI) this.onRSSI(rssi);
    }

    // Transfer
    if (m = LineMessage.match(/Receive\s+(\d+)/i)) {
      const progress = parseInt(m[1]);
      const totalPackets = this.#packets.length - 1; // Không tính EOF packet

      this.isTransferring = false;
      if (progress === totalPackets) this.isTransferring = true;
      
      await this.#onTransferInternal(progress);
      if (this.onTransfer) this.onTransfer(progress + 1, totalPackets); // vì Received = N nghĩa là đã nhận N+1 packet
      return;
    }

    // Write
    if (m = LineMessage.match(/Write\s+(\d+)\s*bytes/i)) {
      const progress = parseInt(m[1]);
      if (this.onWrite) this.onWrite(progress, this.#totalBytesData);
      return;
    }

    // Verify
    if (m = LineMessage.match(/Verify\s+(\d+)\s*bytes/i)) {
      const progress = parseInt(m[1]);
      if (this.onVerify) this.onVerify(progress, this.#totalBytesData);
      return;
    }

    // Success
    if (/Upload success/i.test(LineMessage)) {
      if (this.onSuccess) this.onSuccess();
      return;
    }

    // Errors
    if (/Write failed|Verify failed/i.test(LineMessage)) {
      if (this.onError) this.onError(LineMessage);
    }

    if (/Write failed/i.test(LineMessage)) {
      if (this.onWriteError) this.onWriteError();
      return;
    }

    if (/Verify failed/i.test(LineMessage)) {
      if (this.onVerifyError) this.onVerifyError();
      return;
    }
  };

  // ========== Send next packet ==========
  async #onTransferInternal(received) {
    if (this.#nextToSend !== received + this.#PacketBufferSize) return;
    if (this.#nextToSend >= this.#packets.length) return;

    console.log(`Uploader: Sending packet #${this.#nextToSend}`);
    await this.#DataPipe_sendToLeanbot(this.#packets[this.#nextToSend]);
    this.#nextToSend++;
  };

  // ========== Control Pipe Communication ==========
  async #ControlPipe_sendToLeanbot(packet) {
    await this.#ControlPipe_char.writeValueWithoutResponse(packet);
  }

  async #ControlPipe_onReceiveFromLeanbot(packet){
    this.#ControlPipe_rxQueue.push(packet);
    setTimeout(async () => await this.#ControlPipe_rxQueueHandler(), 0);
  }

  // ========== Data Pipe Communication ==========
  async #DataPipe_sendToLeanbot(packet) {
    await this.#DataPipe_char.writeValueWithoutResponse(packet);
  }
}

// ======================================================
// 🔹 TIMESTAMP FORMATTE
// ======================================================
function formatTimestamp(ts) {
  const hours        = String(ts.getHours()).padStart(2,'0');
  const minutes      = String(ts.getMinutes()).padStart(2,'0');
  const seconds      = String(ts.getSeconds()).padStart(2,'0');
  const milliseconds = String(ts.getMilliseconds()).padStart(3,'0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// ======================================================
// 🔹 HEX TO BLE PACKETS CONVERTER
// ======================================================
function parseHexLine(LineMessage) {
  if (!LineMessage.startsWith(":")) return null;
  const hex = LineMessage.slice(1);
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
 * - Parse HEX LinesMessage → validate checksum
 * - Merge consecutive LinesMessage with continuous addresses
 * - Split into BLE packets of max 236 bytes
 * 
 * @param {string} hexText - HEX file content
 * @returns {Uint8Array[]} packets - Array of BLE message bytes ready to send
 */
function convertHexToBlePackets(hexText) {
  const BLE_MaxLength = window.BLE_MaxLength || 512; // Mặc định 512 nếu không có thiết lập
  console.log(`convertHexToBlePackets: Using BLE_MaxLength = ${BLE_MaxLength}`);

  // --- STEP 0: Split HEX text into LinesMessage ---
  const LinesMessage = hexText.split(/\r?\n/).filter(LineMessage => LineMessage.trim().length > 0);

  // --- STEP 1: Parse each HEX LineMessage ---
  const parsedLines = [];
  for (let i = 0; i < LinesMessage.length; i++) {
    const parsed = parseHexLine(LinesMessage[i].trim());
    if (!parsed) continue;
    if (!verifyChecksum(parsed)) continue;
    const bytes = hexLineToBytes(parsed.data);
    parsedLines.push({ address: parsed.address, bytes: bytes });
  }

  // --- STEP 2: Merge consecutive address blocks ---
  const mergedBlocks = [];
  let current = null;

  for (const LineMessage of parsedLines) {
    if (!current) {
      // Dùng spread operator [...] để sao chép dữ liệu, tránh ảnh hưởng mảng gốc
      current = { address: LineMessage.address, bytes: [...LineMessage.bytes] };
      continue;
    }

    const expectedAddr = current.address + current.bytes.length;
    if (LineMessage.address === expectedAddr) {
      current.bytes.push(...LineMessage.bytes);
    } else {
      mergedBlocks.push(current);
      current = { address: LineMessage.address, bytes: [...LineMessage.bytes] };
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