const bleService        = '0000ffe0-0000-1000-8000-00805f9b34fb';
const bleCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb';

let devices = {};

// Scan và kết nối với device
function scanDevice(id) {
  navigator.bluetooth.requestDevice({ filters: [{ services: [bleService] }] })
    .then(device => device.gatt.connect())
    .then(server => server.getPrimaryService(bleService))
    .then(service => service.getCharacteristic(bleCharacteristic))
    .then(characteristic => {
      devices[id] = characteristic;
      characteristic.addEventListener('characteristicvaluechanged', e => {
        const value = new TextDecoder().decode(e.target.value);
        document.getElementById("text" + id).value += value;
      });
      return characteristic.startNotifications();
    })
    .catch(err => console.error("Device " + id + " error:", err));
}
