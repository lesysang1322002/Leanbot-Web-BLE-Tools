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
