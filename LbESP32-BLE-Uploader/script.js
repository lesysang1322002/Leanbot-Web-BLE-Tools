clearTimeout(timeoutCheckMessage);

function logstatusWebName(text){
    logstatus(text + " - Uploader");
}

function resetVariable(){
}

function handleSerialLine(line) {
  console.log("Device -> " + line);
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
// document.getElementById("uploadBtn").addEventListener("click", async () => {
//   if (!selectedFile) {
//     alert("No file selected!");
//     return;
//   }

//   const text = await selectedFile.text();
//   const lines = text.split(/\r?\n/);

//   for (let line of lines) {
//     if (line.trim().length > 0) {
//       await send(line);
//       await new Promise(resolve => setTimeout(resolve, 10));
//     }
//   }

//   alert("Send complete! LbESP32 will process the HEX file.");
// });

async function sendBLE(data) {
  if (!gattCharacteristic) {
      console.log("GATT Characteristic not found.");
      return;
  }
  data += '\n';  // Append newline character to data
  console.log("You -> " + data);
  let start = 0;
  const dataLength = data.length;
  while (start < dataLength) {
    let subStr = data.substring(start, start + 20);
    try {
        let ByteStart = performance.now();
        await gattCharacteristic.writeValueWithoutResponse(str2ab(subStr));
        // await new Promise(resolve => setTimeout(resolve, 10)); // Thêm độ trễ nhỏ để tránh quá tải
        let ByteEnd = performance.now();
        let ByteTime = ByteEnd - ByteStart;
        console.log(`Time ${subStr.length} bytes: ${ByteTime.toFixed(2)} ms`);
    } catch (error) {
        console.error("Error writing to characteristic:", error);
        break;
    }
    start += 20;
  }
}

document.getElementById("uploadBtn").addEventListener("click", async () => {
  if (!selectedFile) {
    alert("No file selected!");
    return;
  }

  await send("START SEND HEX LINES"); // Gửi lệnh bắt đầu
  await new Promise(resolve => setTimeout(resolve, 1000)); // Đợi một chút để thiết bị chuẩn bị
  

  const text = await selectedFile.text();
  const lines = text.split(/\r?\n/);

  let totalStart = performance.now();  // bắt đầu tính tổng thời gian
  let totalLines = 0;

  for (let line of lines) {
    if (line.trim().length > 0) {
      let lineStart = performance.now();
      await sendBLE(line);
      await new Promise(resolve => setTimeout(resolve, 10)); // Độ trễ nhỏ giữa các dòng
      let lineEnd = performance.now();
      let lineTime = lineEnd - lineStart;
      console.log(`Time line: ${lineTime.toFixed(2)} ms`);
      totalLines++;
    }
  }

  let totalEnd = performance.now();
  let totalTime = totalEnd - totalStart;
  let avgLineTime = totalTime / totalLines;

  let report = `Lines sent: ${totalLines}\nTotal time: ${totalTime.toFixed(2)} ms\nAverage per line: ${avgLineTime.toFixed(2)} ms`;

  alert("Send complete! LbESP32 will process the HEX file.\n\n" + report);
  console.log(report);
});

