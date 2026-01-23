// leanbot_ble.js
// SDK Leanbot BLE - Quản lý kết nối và giao tiếp BLE với Leanbot

import { LeanbotCompiler } from "./LeanbotCompiler.js";

export class LeanbotBLE {
  // ===== SERVICE UUID CHUNG =====
  static SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';

  // ---- PRIVATE MEMBERS ----
  #device  = null;
  #server  = null;
  #service = null;
  #chars   = {};
  #connectingStartMs = 0;
  #connectingEndMs   = 0;

  // ---------------- BLE CORE ----------------

  #returnBleResult(success, message) {
    if (!success) {
      if(this.onConnectError) this.onConnectError(message);
    }
    return { success, message };
  };

  async connect(deviceName = null) {
    this.#connectingStartMs = performance.now();
    this.#connectingEndMs = 0;
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
      return this.#returnBleResult(true, `Connected to ${this.#device.name}`);
    } catch (error) {
      return this.#returnBleResult(false, `Connection failed: ${error.message || "Unknown error"}`);
    }
  }

  async reconnect() {
    this.#connectingStartMs = performance.now();
    this.#connectingEndMs = 0;
    try {
      if (this.isConnected()) {
        // Nếu đang kết nối rồi thì không cần làm gì
        return this.#returnBleResult(true, `Already connected to ${this.#device.name}`);
      }

      if (this.#device) {
        // Nếu đã ngắt kết nối thì kết nối lại
        await this.#setupConnection();
        return this.#returnBleResult(true, `Reconnected to ${this.#device.name}`);
      }

      // Gọi lại Connect nếu không có thiết bị trong phiên làm việc hiện tại
      return await this.connect(this.getLeanbotID());
    } catch (error) {
      return this.#returnBleResult(false, `Reconnect failed: ${error.message || "Unknown error"}`); 
    }
  }

  disconnect() {
    try {
      // Không có thiết bị nào được lưu
      if (!this.#device) {
        return this.#returnBleResult(false, "No device found to disconnect. Please connect a device first.");
      }

      // Thiết bị tồn tại nhưng chưa kết nối
      if (!this.#device.gatt.connected) {
        return this.#returnBleResult(false, "Device is not currently connected.");
      }

      // Ngắt kết nối
      this.#device.gatt.disconnect();
      return this.#returnBleResult(true, `Disconnected from ${this.#device.name}`);
    } catch (error) {
      return this.#returnBleResult(false, `Disconnect failed: ${error.message || "Unknown error"}`);  
    }
  }

  isConnected() {
    return this.#device?.gatt.connected === true;
  }

  getLeanbotID() {
    if (this.#device) return this.#device.name;
      
    const lastDevice = localStorage.getItem("lastDeviceInfo");
    return lastDevice ? JSON.parse(lastDevice) : "No Leanbot";
  }

  #onGattDisconnected = () => {
    //console.log("Device disconnected", this.#device.name);

    this.Uploader.isUploadSessionActive = false;

    if (this.onDisconnect) this.onDisconnect();
      
    if (this.Uploader.isTransferring === true) {
      this.Uploader.emitTransferError("Device disconnected while uploading.");
      this.Uploader.abortAll();
    }  
  };

  async #setupConnection() {
    /** ---------- DISCONNECT EVENT ---------- */
    console.log("Callback onDisconnect: Enabled");

    this.#device.removeEventListener("gattserverdisconnected", this.#onGattDisconnected);

    this.#device.addEventListener("gattserverdisconnected", this.#onGattDisconnected);

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

    this.#connectingEndMs = performance.now();
    if (this.onConnect) this.onConnect();

    /** --------- SAVE DEVICENAME TO LOCALSTORAGE --------- */
    console.log("Saving device to localStorage:", this.#device.name);
    localStorage.setItem("lastDeviceInfo", JSON.stringify(this.#device.name));
  }

  #base64ToText(b64) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  
  async compileAndUpload(SourceCode, compileServer) {

    this.Uploader.prepareUpload();

    const compileResult = await this.Compiler.compile(SourceCode, compileServer);

    if (compileResult.hex && compileResult.hex.trim() !== "") {
      await this.Uploader.upload(this.#base64ToText(compileResult.hex));
    }
    else {
      this.Uploader.abortAll();
    }
  }

  constructor() {
    this.onConnect = null;
    this.onDisconnect = null;
    this.onConnectError = null;

    this.Serial      = new Serial(this);
    this.Uploader    = new Uploader(this);
    this.JDYUploader = new JDYUploader(this, this.Serial, this.Uploader);
    this.Compiler    = new LeanbotCompiler();
    
    this.Serial.setJDYUploader(this.JDYUploader);
    this.Uploader.setJDYUploader(this.JDYUploader);
  }

  connectingTimeMs() {
    if (this.#connectingEndMs === 0){
      return performance.now() - this.#connectingStartMs;
    }
    return this.#connectingEndMs - this.#connectingStartMs;
  }
}

// ======================================================
// 🔹 SUBMODULE: SERIAL
// ======================================================
class Serial {
  // UUID riêng của Serial
  static SerialPipe_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
  #SerialPipe_char = null;
  #JDYUploader = null;

  setJDYUploader(jdyUploader) {
    this.#JDYUploader = jdyUploader;
  }

  /** Kiểm tra hỗ trợ Serial */
  isSupported() {
    return !!this.#SerialPipe_char;
  }

  /** Callback khi nhận notify Serial */
  onMessage = null;

  /** Callback chuyển tiếp dữ liệu thô sang JDYUploader */
  onForwardReponse = null;

  // Queue nhận dữ liệu
  #SerialPipe_rxQueue   = [];
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
      await this.SerialPipe_sendToLeanbot(buffer, withResponse);
    } catch (e) {
      console.log(`Serial.Send Error: ${e}`);
    }
  }

  /** Thiết lập characteristic + notify **/
  async setupConnection(characteristics) {
    const fullUUID  = Serial.SerialPipe_UUID;
    const shortUUID = fullUUID.slice(4, 8); // ffe1

    let char = null;

    if (characteristics[fullUUID]) {
      char = characteristics[fullUUID];
    } else {
      console.log("SerialPipe NOT found by full UUID");
    }

    if (!char && characteristics[shortUUID]) {
      char = characteristics[shortUUID];
    } else if (!char) {
      console.log("SerialPipe NOT found by short UUID");
    }

    this.#SerialPipe_char = char;

    if (!this.isSupported()) {
      console.log("Serial: Not supported");
      return;
    }

    console.log("Serial: supported");


    if (!this.isSupported()) {
      console.log("Serial: Not supported");
      return;
    }

    if (!this.#SerialPipe_char.properties.notify) {
      console.log("Serial Notify: Not supported");
      return;
    }

    await this.#SerialPipe_char.startNotifications();
    this.#SerialPipe_char.addEventListener("characteristicvaluechanged", (event) => {
      const bytes = new Uint8Array(event.target.value.buffer); // UploaderJDY needs raw bytes
      if (this.#JDYUploader && this.#JDYUploader.isUploading) {
        if (this.onForwardReponse) this.onForwardReponse(bytes);
        return;
      }
      const BLEPacket = new TextDecoder().decode(bytes);
      const Packet_TS = new Date(performance.timeOrigin + event.timeStamp);
      this.#SerialPipe_onReceiveFromLeanbot(BLEPacket, Packet_TS);
    });

    console.log("Callback Serial.onMessage: Enabled");
  }

  #SerialPipe_rxQueueHandler() {
    if (this.#SerialPipe_busy) return;
    this.#SerialPipe_busy = true;

    while (this.#SerialPipe_rxQueue.length > 0) {
      const BLEPacket = this.#SerialPipe_rxQueue.shift();
      this.#SerialPipe_buffer += BLEPacket;

      const PacketTS  = this.#SerialPipe_rxTSQueue.shift();

      let lines = this.#SerialPipe_buffer.split("\n");
      this.#SerialPipe_buffer = lines.pop();

      for (let i = 0; i < lines.length; i++) { 
        let line = lines[i] + "\n";
        let timeGapMs = this.#SerialPipe_lastTS ? (PacketTS - this.#SerialPipe_lastTS) : 0;

        if (line === "AT+NAME\r\n")  continue;
        if (line === "LB999999\r\n") {
          line = ">>> Leanbot ready >>>\n";
          if (this.onMessage) this.onMessage(line, PacketTS, timeGapMs);
          if (this.onMessage) this.onMessage("\n", PacketTS, 0);
          continue;
        }

        if (this.onMessage) this.onMessage(line, PacketTS, timeGapMs);
        this.#SerialPipe_lastTS = PacketTS;
      }
    }

    this.#SerialPipe_busy = false;
  }

  // ========== Serial Pipe Communication ==========
  async SerialPipe_sendToLeanbot(packet, withResponse = true) {
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

  #JDYUploader = null;

  setJDYUploader(jdyUploader) {
    this.#JDYUploader = jdyUploader;
  }

  // Characteristics
  #DataPipe_char     = null;
  #ControlPipe_char  = null;

  // Upload state
  #packets            = [];
  #packetHashes      = [];
  #nextToSend        = 0;
  #lastReceived      = -1;
  totalBytesData     = 0;
  totalPackets       = 0;
  #PacketBufferSize  = 0;
  #MaxPacketBufferSize = 4;
  
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

  isUploadSessionActive = null;

  #uploadStartMs = 0;
  #uploadEndMs = 0;

  /** Kiểm tra hỗ trợ Uploader */
  isSupported() {
    return !!this.#DataPipe_char && !!this.#ControlPipe_char;
  }

  /** Prepare for upload (abstract for JDYUploader)*/
  async prepareUpload() {
    if (!this.isSupported()){
      this.#JDYUploader.prepareUpload(); 
    }
  }

  /** Upload HEX */
  async upload(hexText) {
    try{
      this.#uploadStartMs = performance.now();
      this.#uploadEndMs = 0;

      if (!this.isSupported() && this.#JDYUploader) {
        await this.#JDYUploader.upload(hexText);
        return;
      }

      this.isUploadSessionActive = true;
    
      // Chuyển toàn bộ HEX sang gói BLE
      this.#packets = convertHexToBlePackets(hexText);
      this.totalPackets = this.#packets.length - 1;

      // Tính toán hash cho từng gói
      this.#packetHashes = [];
      this.#computePacketHashesHash32();

      const totalBytes = this.#packets.reduce((a, p) => a + p.length, 0);
      const dataBytes = totalBytes - this.#packets.length - 1; // trừ đi header (1 byte) và EOF block (1 byte)
      this.totalBytesData = Math.ceil(dataBytes / 128) * 128; // Làm tròn lên bội số của 128 bytes

      // Reset trạng thái upload
      this.#nextToSend = 0;
      this.#lastReceived = -1;
      this.#ControlPipe_rxQueue = [];
      this.#ControlPipe_busy = true;
      this.#PacketBufferSize = this.#MaxPacketBufferSize;

      console.log('[START] Initializing upload......');
      for (let i = 0; i < Math.min(this.#PacketBufferSize, this.#packets.length); i++) {
        await this.#DataPipe_sendToLeanbot(this.#packets[i]);
        console.log(`Uploader: Sending packet #${i}`);
        this.#nextToSend++;
      }
    
      this.#ControlPipe_busy = false;
      this.#uploadEndMs = performance.now();

      // console.log("Waiting for Receive feedback...");
    }
    catch(e){
      console.log("Catch Upload Error:", e);
    }
  }

  #computePacketHashesHash32() {
    let hash32 = 0 >>> 0; // reset hash32
    for (let i = 0; i < this.#packets.length; i++) {
      hash32 = updateHashWithBytes(hash32, this.#packets[i]);
      this.#packetHashes[i] = hash32.toString(16).toUpperCase().padStart(8, '0');
    }
  }

  /** Setup Char + Notify + Queue */
  async setupConnection(characteristics, BLE_MaxLength, BLE_Interval, HASH) {
    this.#DataPipe_char    = characteristics[Uploader.DataPipe_UUID] || null;
    this.#ControlPipe_char = characteristics[Uploader.ControlPipe_UUID] || null;

    if (!this.isSupported()) {
      console.log("Uploader: Not supported");
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
    }

    if (BLE_Interval) {
      const cmd = `SET BLE_INTERVAL ${BLE_Interval}`;
      await this.#ControlPipe_sendToLeanbot(new TextEncoder().encode(cmd));
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
        await this.onMessageInternal(LineMessage);
        if (this.onMessage) this.onMessage(LineMessage);
      }
    }

    this.#ControlPipe_busy = false;
  };

  // ========== Message Processor ==========
  async onMessageInternal(LineMessage, onTransferInternal = true) {
    let m = null;

    // RSSI
    if (m = [...LineMessage.matchAll(/\[(-?\d+(?:\.\d+)?)\]/g)]) {
      // LineMessage = [2.897] [-54.3] Receive 56
      // m[0][0] = [2.897], m[1][0] = [-54.3]
      if (m.length >= 2){
        const rssi = m[1][1]; // rssi = -54.3
        if(this.onRSSI) this.onRSSI(rssi);
      }
    }

    // Transfer
    if (m = LineMessage.match(/Receive\s+(-?\d+)(?:\s+(\S+))?/i)) {
      const progress = parseInt(m[1]);
      // console.log(`[RECV ${progress}]`);
      const recvHash = m[2] ? m[2].toUpperCase() : null;
      // console.log(`Received Hash:`, recvHash);

      if (recvHash) {
        const expected = this.#packetHashes[progress];
        // console.log(`Expected Hash:`, expected);
        if (recvHash !== expected) {
          this.isUploadSessionActive = false;
          const err = `Transfer Error: Hash mismatch. ESP32: ${recvHash}, WEB: ${expected}`;
          // console.error(err);
          this.emitTransferError(err);
          return; // stop transfer
        }
      }
       
      this.isTransferring = true;
      if (progress === this.totalPackets) this.isTransferring = false;

      if (onTransferInternal) await this.#onTransferInternal(progress);
      if (this.onTransfer) this.onTransfer(progress + 1, this.totalPackets);
      return;
    }

    // Write
    if (m = LineMessage.match(/Write\s+(\d+)\s*bytes/i)) {
      const progress = parseInt(m[1]);
      if (this.onWrite) this.onWrite(progress, this.totalBytesData);
      return;
    }

    // Verify
    if (m = LineMessage.match(/Verify\s+(\d+)\s*bytes/i)) {
      const progress = parseInt(m[1]);
      if (this.onVerify) this.onVerify(progress, this.totalBytesData);
      return;
    }

    // Success
    if (/Upload success/i.test(LineMessage)) {
      this.isUploadSessionActive = false;
      if (this.onSuccess) this.onSuccess();
      return;
    }

    // Errors
    if (/Write failed|Verify failed/i.test(LineMessage)) {
      this.isUploadSessionActive = false;
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
  #timeoutDuration = 200;
  #timeoutCount = 0;
  #timeoutTimer = null;
  #isSending = false;

  #clearTimeoutTimer() {
    if (this.#timeoutTimer) {
      clearInterval(this.#timeoutTimer);
      this.#timeoutTimer = null;
    }
    this.#timeoutCount = 0;
  }

  async #sendPacket(index) {
    if (index >= this.#packets.length) return;

    while (this.#isSending) await new Promise(resolve => setTimeout(resolve, 5));

    this.#isSending = true;
    await this.#DataPipe_sendToLeanbot(this.#packets[index]);
    this.#isSending = false;
  }

  #startTimeoutForNextPacket() {
    this.#timeoutTimer = setInterval(async () => {
      this.#PacketBufferSize = 1;
      this.#nextToSend = this.#lastReceived + this.#PacketBufferSize;

      this.#timeoutCount++;
      console.log(`[TIMEOUT] TRIAL ${this.#timeoutCount}: Waiting for packet #${this.#nextToSend} response`);
      
      console.log(`[TIMEOUT] Uploader: Resending packet #${this.#nextToSend}`);
      await this.#sendPacket(this.#nextToSend);
      this.#nextToSend++;
      
      if (this.#timeoutCount >= 5) {
        this.#clearTimeoutTimer();
        const err = `Uploader: Transfer Error.`;
        // console.log(err);
        this.isUploadSessionActive = false;
        this.emitTransferError(err); 
      }
    }, this.#timeoutDuration);
  }

  async #onTransferInternal(received) {
    console.log(`[RECV ${received}] onTransferInternal called`);

    if (received <= this.#lastReceived){
      console.log(`Uploader: Not the first time, ignore`);
      return;
    }

    this.#lastReceived = received;

    if (this.#PacketBufferSize < this.#MaxPacketBufferSize) this.#PacketBufferSize++;

    const nextToSendLimit = received + this.#PacketBufferSize;
    while(this.#nextToSend <= nextToSendLimit && this.#nextToSend < this.#packets.length) {
      console.log(`Uploader: Sending packet #${this.#nextToSend}`);
      await this.#sendPacket(this.#nextToSend);
      this.#nextToSend++;
    }

    this.#clearTimeoutTimer();

    if (received + 1 >= this.#packets.length) {
      console.log(`Uploader: Leanbot received all #packets.`);
      return;
    }

    console.log(`Uploader: Setting timeout for packet #${received + 1}`);
    this.#startTimeoutForNextPacket();
  }

  // ========== Control Pipe Communication ==========
  async #ControlPipe_sendToLeanbot(packet) {
    await this.#ControlPipe_char.writeValueWithoutResponse(packet);
  }

  async #ControlPipe_onReceiveFromLeanbot(packet){
    if (this.isUploadSessionActive !== true) return;

    this.#ControlPipe_rxQueue.push(packet);
    setTimeout(async () => await this.#ControlPipe_rxQueueHandler(), 0);
  }

  // ========== Data Pipe Communication ==========
  async #DataPipe_sendToLeanbot(packet) {
    try {
      await this.#DataPipe_char.writeValueWithoutResponse(packet);
    } catch (err) {
      // console.error("Write Error:", err);

      this.isUploadSessionActive = false;

      this.emitTransferError("Write Error:", err);
    }
  }

  cancel() {
    this.#ControlPipe_rxQueue = []; 
    this.#lastReceived = this.#packets.length;
    this.#ControlPipe_busy = true;
  }

  emitTransferError(err) { // call both transfer error and general error
    if (this.onTransferError) this.onTransferError();
    if (this.onError) this.onError(err);
  }

  elapsedTimeMs() {
    if (!this.isSupported()) {
      if (this.#JDYUploader) return this.#JDYUploader.elapsedTimeMs();
    }

    if (this.#uploadEndMs === 0) // if upload not done yet
      return performance.now() - this.#uploadStartMs;
    return this.#uploadEndMs - this.#uploadStartMs;
  }

  abortAll(){
    this.isUploadSessionActive = false;
    this.isTransferring = false;

    if (!this.isSupported()) {
      if (this.#JDYUploader) this.#JDYUploader.abortAll();
      return;
    }

    this.#isSending = false;
    this.cancel();
  }

}

// ======================================================
// 🔹 SUBMODULE: JDYUploader
// ======================================================
class JDYUploader {
  #leanbot;
  #serial;
  #uploader;

  isUploading        = false;
  #isSyncing         = false;
  #isLoadingAddress  = false;
  #isReadingPage     = false;
  #isCollectingPage  = false;
  #isWritingPage     = false;

  #pageSize    = 128;
  #BLEPackets  = [];
  #pageBuffer  = [];

  #uploadStartMs = 0;
  #uploadEndMs = 0;

  intervalGetSync = null;
  #isGetSyncOK = false;
  #isCompileOK = false;

  #responseACK = new Uint8Array([0x14, 0x10]); // STK_OK
  #isACK(bytes){
    return bytes[0] === this.#responseACK[0] 
        && bytes[1] === this.#responseACK[1];
  }

  /* ------------------- CONSTRUCTOR ------------------- */
  constructor(ble, serial, uploader) {
    this.#leanbot = ble;     // dùng được hàm của LeanbotBLE
    this.#serial  = serial;  // dùng được hàm của Serial
    this.#uploader = uploader; // dùng được hàm của Uploader

    // callback nhận dữ liệu từ Serial
    serial.onForwardReponse = async (bytes) => {
      await this.#handleResponse(bytes);
    };
  }

  /* ------------------- UPLOAD HEX ------------------- */
  async upload(hexText) {
    this.#isCompileOK = true; // Đã compile xong
    if (this.intervalGetSync) clearInterval(this.intervalGetSync); // xóa interval get sync nếu có

    this.#uploadStartMs = performance.now();
    this.#uploadEndMs = 0;
    this.#BLEPackets = convertHexToBlePackets(hexText, { returnStep2: true });

    while (!this.#isGetSyncOK) await new Promise(resolve => setTimeout(resolve, 5));

    await this.#uploadCode();

    this.#uploadEndMs = performance.now();
  }

  async prepareUpload() {
    if (!this.#serial.isSupported()) {
      console.log("[UPLOAD] Error: Serial not supported.");
      return;
    }

    this.#isGetSyncOK = false;
    this.#isCompileOK = false;
    clearInterval(this.intervalGetSync);

    console.log("[UPLOAD] Disconnecting...");
    const resultDisc = await this.#leanbot.disconnect();
    console.log("[UPLOAD] Disconnect result:", resultDisc?.message);

    await new Promise(resolve => setTimeout(resolve, 3500));

    console.log("[UPLOAD] Reconnecting...");
    let resultReco;
    while (!(resultReco?.success)) {
      try {
        resultReco = await this.#leanbot.reconnect();
      } catch {}
      await new Promise(r => setTimeout(r, 50));
    }
    console.log("[UPLOAD] Reconnect success.");
    this.isUploading = true;

    console.log("[UPLOAD] Starting SYNC...");
    if (this.#isCompileOK) {
      // Nếu đã compile xong thì chỉ cần get sync 1 lần
      await this.#getSync();
    } else {
      // Nếu chưa compile xong thì cứ 500ms get sync 1 lần
      this.intervalGetSync = setInterval(() => this.#getSync(), 500);
    }
  }

  /* ------------------- HANDLE RESPONSE ------------------- */
  async #handleResponse(bytes) {
    console.log("[UPLOAD] Received response: ", bytes.toString());
    if (this.#isSyncing ) {
      await this.#handleGetSyncAck(bytes);
      return;
    }

    if (this.#isLoadingAddress) {
      await this.#handleLoadAddressAck(bytes);
      return;
    }

    if (this.#isReadingPage) {
      await this.#handleReadFlashAck(bytes);
      return;
    }

    if (this.#isWritingPage) {
      await this.#handleWriteFlashAck(bytes);
      return;
    }
  }

  /* ------------------- GET SYNC ------------------- */
  async #getSync() {
    // STK_GET_SYNC + STK_CRC_EOP
    const getSyncCmd = new Uint8Array([0x30, 0x20]); 
    console.log("[SYNC] Sent GET_SYNC command");
    await this.#serial.SerialPipe_sendToLeanbot(getSyncCmd, false);
    this.#isSyncing  = true;
  }

  async #handleGetSyncAck(bytes) {
    this.#isSyncing  = false;
    if (!this.#isACK(bytes)) {
      console.log("[SYNC] Invalid SYNC ACK response");
      this.#emitUploadMessage("Get Sync failed");
      this.isUploading = false;
      return;
    }
    console.log("[SYNC] SYNC ACK received!");
    this.#isGetSyncOK = true;
    // this.#emitUploadMessage("Get Sync successful");
  }
  
  /* ------------------- LOAD ADDRESS ------------------- */
  async #loadAddress(pageIndex) {
    const byteAddress = pageIndex * this.#pageSize;
    const wordAddress = byteAddress >> 1;
    const addrLow     = wordAddress & 0xFF;
    const addrHigh    = (wordAddress >> 8) & 0xFF;

    // STK_LOAD_ADDRESS + addrLow + addrHigh + STK_CRC_EOP
    const cmd = new Uint8Array([0x55, addrLow, addrHigh, 0x20]);
    console.log(`[LOAD] Sent LOAD_ADDRESS for page ${pageIndex}`);
    await this.#serial.SerialPipe_sendToLeanbot(cmd, false);
    this.#isLoadingAddress = true;

    while (this.#isLoadingAddress) await new Promise(resolve => setTimeout(resolve, 5));
  }

  async #handleLoadAddressAck(bytes) {
    this.#isLoadingAddress = false;
    if (!this.#isACK(bytes)) {
      console.log("[LOAD] Invalid LOAD_ADDRESS ACK response");
      this.#emitUploadMessage("Load address failed");
      this.isUploading = false;
      return;
    }
    console.log("[LOAD] LOAD_ADDRESS ACK received!");
  }

  /* ------------------- READ FLASH ------------------- */
  async #readFlash(pageIndex = 0) {
    console.log(`[READ] Page ${pageIndex}`);
    
    // 1) LOAD_ADDRESS
    await this.#loadAddress(pageIndex);

    // 2) STK_READ_PAGE + len_hi + len_lo + 'F' + STK_CRC_EOP
    const readPageCmd = new Uint8Array([0x74, 0x00, this.#pageSize, 0x46, 0x20]);
    console.log("[READ] Sent READ_PAGE command");
    await this.#serial.SerialPipe_sendToLeanbot(readPageCmd, false);

    this.#isReadingPage = true;
    this.#isCollectingPage = false;
    this.#pageBuffer = [];

    while (this.#isReadingPage) await new Promise(resolve => setTimeout(resolve, 5));
  }

  async #handleReadFlashAck(chunk) {
    if (!this.#isCollectingPage && chunk[0] !== this.#responseACK[0]) return;

    if (!this.#isCollectingPage) this.#isCollectingPage = true; // bắt đầu thu thập page

    this.#pageBuffer.push(...chunk);

    if (chunk[chunk.length - 1] !== this.#responseACK[1]) return; // chưa kết thúc, chờ chunk tiếp theo

    if (this.#pageBuffer.length !== this.#pageSize + 2) return; // kích thước không đúng, chờ chunk tiếp theo

    this.#pageBuffer = this.#pageBuffer.slice(1, -1); // loại bỏ byte ACK đầu và cuối
    this.#isReadingPage = false;
    this.#isCollectingPage = false;
  }

  /* ------------------- WRITE FLASH ------------------- */
  async #writeFlash(pageIndex, pageData) {
    console.log(`[WRITE] Page ${pageIndex}`);

    if (!(pageData instanceof Uint8Array) || pageData.length !== this.#pageSize) {
      throw new Error(`pageData must be Uint8Array[${this.#pageSize}]`);
    }
    // 1) LOAD_ADDRESS
    await this.#loadAddress(pageIndex);

    // 2) PROG PAGE
    const progPageHeader = new Uint8Array([0x64, 0x00, this.#pageSize,  0x46]); // STK_PROG_PAGE + len_hi + len_lo + 'F'
    const progPageTail = new Uint8Array([0x20]); // STK_CRC_EOP

    console.log("[WRITE] Sending PAGE command");

    await this.#serial.SerialPipe_sendToLeanbot(progPageHeader, false);
    await this.#serial.SerialPipe_sendToLeanbot(pageData, false);
    await this.#serial.SerialPipe_sendToLeanbot(progPageTail, false);

    this.#emitUploadMessage(`Receive ${pageIndex + 1}`);

    this.#isWritingPage = true;

    while (this.#isWritingPage) await new Promise(resolve => setTimeout(resolve, 5));

    this.#emitUploadMessage(`Write ${(pageIndex + 1) * this.#pageSize} bytes`);
  }
 
  async #handleWriteFlashAck(bytes) {
    this.#isWritingPage = false;
    if (!this.#isACK(bytes)) {
      console.log("[WRITE] Invalid PROG_PAGE ACK response");
      this.#emitUploadMessage("Write failed");
      this.isUploading = false;
      return;
    }
    console.log("[WRITE] PROG_PAGE ACK received!");
  }

  /* ------------------- UPLOAD CODE ------------------- */
  async #uploadCode() {
    console.log("[UPLOAD] Starting code upload...");
    const pages = this.#buildPagesFromBlocks(this.#BLEPackets, this.#pageSize);

    // Tổng số byte data thực sự (để UI dùng)
    const totalBytesData = pages.length * this.#pageSize;
    this.#uploader.totalPackets   = pages.length;
    this.#uploader.totalBytesData = totalBytesData;

    const t1 = performance.now();
    for (const page of pages) {
      await this.#writeFlash(page.pageIndex, page.bytes);
    }
    const t2 = performance.now();
    // console.log(`[UPLOAD] Completed in ${((t2 - t1) / 1000).toFixed(2)} s`);
    console.log(`[UPLOAD] Completed in ${sec3FromMs(t2 - t1)} s`);

    // Verify
    const t3 = performance.now();
    const verifyOk = await this.verifyUploadedCode();
    const t4 = performance.now();
    // console.log(`[UPLOAD] Verification completed in ${((t4 - t3) / 1000).toFixed(2)} s`);
    console.log(`[UPLOAD] Verification completed in ${sec3FromMs(t4 - t3)} s`);
    console.log("[UPLOAD] Verify result:", verifyOk ? "OK" : "FAILED");

    // Thông báo success / fail cho UI cũ
    if (this.#uploader) {
      if (verifyOk) {
        this.#emitUploadMessage(`Upload success, Reset Leanbot`);
      } else {
        this.#emitUploadMessage(`Verify failed`);
      }
    }

    this.isUploading = false;
  }

  /* ------------------- BUILD PAGES FROM BLOCKS ------------------- */
  #buildPagesFromBlocks(mergedBlocks) {
    const pages = {};

    for (const block of mergedBlocks) {
      let addr = block.address;
      for (let i = 0; i < block.bytes.length; i++, addr++) {
        const pageIndex  = Math.floor(addr / this.#pageSize);
        const pageBase   = pageIndex * this.#pageSize;
        const pageOffset = addr % this.#pageSize;

        if (!pages[pageIndex]) {
          pages[pageIndex] = {
            pageIndex,
            address: pageBase,
            bytes: new Uint8Array(this.#pageSize).fill(0xFF),
          };
        }
        pages[pageIndex].bytes[pageOffset] = block.bytes[i];
      }
    }

    return Object.values(pages).sort((a, b) => a.pageIndex - b.pageIndex);
  }

  /* ------------------- SO SÁNH 2 PAGE ------------------- */
  #comparePage(expected, actual) {
    if (!expected || !actual) return false;
    if (expected.length !== actual.length) return false;

    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== actual[i]) return false;
    }
    return true;
  }

  /* Đọc 1 page và chờ đến khi nhận xong */
  async #readPageAndGetData(pageIndex) {
    await this.#readFlash(pageIndex);

    // chờ cho đến khi #handleReadFlashAck xử lý xong
    while (this.#isReadingPage) await new Promise(resolve => setTimeout(resolve, 5));

    return this.#pageBuffer;
  }

  /* ------------------- VERIFY READ_PAGE ------------------- */
  /**
   * mode = "full"   → verify tất cả page
   * mode = "sample" → verify 1/16 số page, random
   */
  async verifyUploadedCode(mode = "sample") {
    const pages = this.#buildPagesFromBlocks(this.#BLEPackets, this.#pageSize);
    const totalPages = pages.length;

    if (totalPages === 0) {
      console.log("[VERIFY] No pages to verify.");
      return false;
    }

    let pageIndices = [];

    /* ---------------- SELECT VERIFY MODE ---------------- */
    if (mode === "full") {
      console.log(`[VERIFY] Mode FULL: verifying all ${totalPages} pages...`);
      pageIndices = [...Array(totalPages).keys()]; // 0 → totalPages-1

    } else if (mode === "sample") {
      const sampleCount = Math.max(1, Math.floor(totalPages / 16));
      const selected = new Set();

      while (selected.size < sampleCount) {
        const r = Math.floor(Math.random() * totalPages);
        selected.add(r);
      }

      pageIndices = [...selected];
      console.log(`[VERIFY] Mode SAMPLE: verifying ${pageIndices.length}/${totalPages} random pages (~1/16)`);
    } 
    else {
      console.log(`[VERIFY] Invalid mode "${mode}". Expected "full" or "sample".`);
      return false;
    }

    /* ---------------- EXECUTE VERIFY ---------------- */
    let allOk = true;
    let verifyStep = 0; 
    for (const idx of pageIndices) {
      const page = pages[idx];
      const pageIndex = page.pageIndex;

      console.log(`[VERIFY] Reading page ${pageIndex}...`);
      const deviceData = await this.#readPageAndGetData(pageIndex);

      const isSame = this.#comparePage(page.bytes, deviceData);

      if (!isSame) {
        allOk = false;
        console.log(`[VERIFY] Page ${pageIndex} MISMATCH!`);

        // log byte đầu tiên bị sai
        for (let i = 0; i < page.bytes.length; i++) {
          if (page.bytes[i] !== deviceData[i]) {
            console.log(
              `[VERIFY] Page ${pageIndex}, offset ${i}: ` +
              `expected 0x${page.bytes[i].toString(16).padStart(2,'0')}, ` +
              `got 0x${deviceData[i].toString(16).padStart(2,'0')}`
            );
            break;
          }
        }
      } else {
        console.log(`[VERIFY] Page ${pageIndex} OK`);
      }
      verifyStep++;
      const verifiedBytes = (verifyStep / pageIndices.length) * this.#uploader.totalBytesData;
      this.#emitUploadMessage(`Verify ${Math.floor(verifiedBytes)} bytes`);
    }

    /* ---------------- FINAL RESULT ---------------- */
    if (allOk) {
      console.log(`[VERIFY] Verification SUCCESS (${mode} mode).`);
    } else {
      console.log(`[VERIFY] Verification FAILED (${mode} mode).`);
    }

    return allOk;
  }

  #emitUploadMessage(message) {
    if (this.#uploader) {
      this.#uploader.onMessageInternal(message, false);
      // const timeStamp = ((performance.now() - this.#uploadStartMs) / 1000).toFixed(3);
      // this.#uploader.onMessage(`[${timeStamp}] ${message}`);
      const timeStamp = performance.now() - this.#uploadStartMs
      this.#uploader.onMessage({timeStamp, message});
    }
  }

  elapsedTimeMs() {
    if (this.#uploadEndMs === 0) // if upload not done yet
      return performance.now() - this.#uploadStartMs;
    return this.#uploadEndMs - this.#uploadStartMs;
  }

  abortAll(){

    if (this.intervalGetSync) clearInterval(this.intervalGetSync); // xóa interval get sync nếu có
    this.isUploading = false;
    this.#isSyncing        = false;
    this.#isGetSyncOK      = false;
    this.#isLoadingAddress = false;
    this.#isReadingPage    = false;
    this.#isWritingPage    = false;
  }
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
function convertHexToBlePackets(hexText, { returnStep2 = false } = {}) {
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

  if (returnStep2) {
    console.log("convertHexToBlePackets: returning mergedBlocks after STEP 2");
    return mergedBlocks;
  }

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

// ======================================================
// 🔹 HASH FUNCTION (32-bit)
// ======================================================

// Hằng số P1
const P1 = 0xDE1AD64D;

/**
 * @param {number} hash - hash hiện tại
 * @param {number} data - dữ liệu 32-bit
 * @returns {number} hash mới (uint32)
 */
function updateHash(hash, data) {
  hash ^= data;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, P1);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, P1);
  hash ^= hash >>> 15;
  return hash >>> 0; // đảm bảo trả về uint32
}

/**
 * @param {number} hash32 - hash hiện tại (uint32)
 * @param {Uint8Array} data - mảng byte
 * @returns {number} hash sau khi xử lý hết data
 */
function updateHashWithBytes(hash32, data) {
  let idx = 0;
  const len = data.length;

  // Xử lý các block 4 byte
  const fullBlocks = (len / 4) | 0;
  for (let i = 0; i < fullBlocks; i++) {
    let data32 =
      (data[idx]       << 0)  |
      (data[idx + 1]   << 8)  |
      (data[idx + 2]   << 16) |
      (data[idx + 3]   << 24);

    hash32 = updateHash(hash32, data32);
    idx += 4;
  }

  // Xử lý phần còn lại 1–3 byte
  if (idx < len) {
    let data32 = 0;
    for ( ; idx < len; idx++) {
      data32 <<= 8;
      data32  |= data[idx];
    }
    hash32 = updateHash(hash32, data32);
  }

  return hash32;
}

// ======================================================
// 🔹 Console log timeStamp
// ======================================================

function sec3FromMs(ms) {
  return (ms / 1000).toFixed(3);
}