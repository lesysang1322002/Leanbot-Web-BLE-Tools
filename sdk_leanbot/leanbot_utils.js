// leanbot_utils.js
export const delay = ms => new Promise(r => setTimeout(r, ms));

/* Truy cập nhanh phần tử DOM qua ID */
export function UI(id) {
  return document.getElementById(id);
}

/* Ghi log ra console và lên giao diện. */
export function log(msg) {
  console.log(msg);

  const logBox = UI("log");
  if (!logBox) return;

  logBox.textContent += msg + "\n";
  logBox.scrollTop = logBox.scrollHeight;
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

export function convertHexToBlePackets(hexText) {
  const packets = [];
  const LINES_PER_BLOCK = 14;
  const lines = hexText.split(/\r?\n/).filter(line => line.trim().length > 0);

  let sequence = 0;

  for (let i = 0; i < lines.length;) {
    const rawLine = lines[i].trim();
    const parsed = parseHexLine(rawLine);
    if (!parsed || !verifyChecksum(parsed)) { i++; continue; }

    // Ghép block đầu tiên
    let block = parsed.hex.substr(2, 4) + parsed.data;
    let baseLen = parsed.length;
    let currentAddr = parsed.address;
    let lineCount = 1;

    // Ghép thêm tối đa LINES_PER_BLOCK dòng liền kề
    for (let j = i + 1; j < lines.length && lineCount < LINES_PER_BLOCK; j++) {
      const next = parseHexLine(lines[j].trim());
      if (!next || !verifyChecksum(next)) break;
      const expectedAddr = currentAddr + baseLen;
      if (next.address !== expectedAddr) break;
      block += next.data;
      currentAddr = next.address;
      baseLen = next.length;
      lineCount++;
      i = j;
    }

    i++;

    // Tạo payload BLE
    const header = sequence.toString(16).padStart(2, "0").toUpperCase();
    const payload = header + block;
    const bytes = hexLineToBytes(payload);
    packets.push(bytes);

    sequence++;
  }

  return packets;
}
