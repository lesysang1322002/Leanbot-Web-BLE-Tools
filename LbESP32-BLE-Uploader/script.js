clearTimeout(timeoutCheckMessage);

function logstatusWebName(text){
    logstatus(text + " - Uploader");
}

function resetVariable(){
}

function handleSerialLine(line) {
    
}

let device, server, service, characteristic;
let selectedFile = null;

// --- Display full file content ---
function previewFile(file) {
  document.getElementById("fileName").textContent = selectedFile.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = new TextDecoder().decode(e.target.result);
    // Show full content (no truncation)
    document.getElementById("fileContent").textContent = text;
  };
  reader.readAsArrayBuffer(file);
}

// --- Handle file input selection ---
document.getElementById("fileInput").addEventListener("change", (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile) previewFile(selectedFile);
});

// --- Drag & Drop ---
const dropZone = document.getElementById("dropZone");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.name.toLowerCase().endsWith(".hex")) {
      selectedFile = file;
      previewFile(selectedFile);
      document.getElementById("fileName").textContent = "Selected file: " + file.name;
    } else {
      alert("Please drop a valid HEX File (.hex)");
    }
  }
});

// Upload bằng hàm send()
document.getElementById("uploadBtn").addEventListener("click", async () => {
  if (!selectedFile) {
    alert("No file selected!");
    return;
  }

  const text = await selectedFile.text();
  const lines = text.split(/\r?\n/);

  for (let line of lines) {
    if (line.trim().length > 0) {
      await send(line);
    }
  }

  alert("Send complete! ESP32 will process the HEX file.");
});