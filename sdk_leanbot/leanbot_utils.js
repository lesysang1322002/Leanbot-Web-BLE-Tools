// leanbot_utils.js
export const delay = ms => new Promise(r => setTimeout(r, ms));

export function log(msg) {
  console.log(`[Leanbot] ${msg}`);
  const el = document.getElementById("log");
  if (el) {
    el.textContent += msg + "\n";
    el.scrollTop = el.scrollHeight;
  }
}