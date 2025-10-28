// leanbot_utils.js
export const delay = ms => new Promise(r => setTimeout(r, ms));

/* Truy cập nhanh phần tử DOM qua ID */
export function UI(id) {
  return document.getElementById(id);
}

/* Ghi log ra console và lên giao diện. */
export function log(msg) {
  console.log(`[Web] ${msg}`);

  const logBox = UI("log");
  if (!logBox) return;

  logBox.textContent += msg + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

export function parseHexLine(line) {
  if (!line.startsWith(":")) return null;
  const hex = line.slice(1);
  const length = parseInt(hex.substr(0, 2), 16);
  const address = parseInt(hex.substr(2, 4), 16);
  const recordType = hex.substr(6, 2);
  const data = hex.substr(8, length * 2);
  const checksum = parseInt(hex.substr(8 + length * 2, 2), 16);
  return { length, address, recordType, data, checksum, hex };
}

export function verifyChecksum(parsed) {
  const { hex, length, checksum } = parsed;
  const allBytes = [];
  for (let i = 0; i < 4 + length; i++) {
    allBytes.push(parseInt(hex.substr(i * 2, 2), 16));
  }
  const sum = allBytes.reduce((a, b) => a + b, 0);
  const calcChecksum = ((~sum + 1) & 0xFF);
  return calcChecksum === checksum;
}

export function hexLineToBytes(block) {
  const bytes = [];
  for (let i = 0; i < block.length; i += 2) {
    const b = parseInt(block.substr(i, 2), 16);
    if (!isNaN(b)) bytes.push(b);
  }
  return new Uint8Array(bytes);
}
