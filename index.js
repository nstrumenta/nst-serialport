import SerialPort from "serialport";
import minimist from "minimist";
import { NstrumentaClient } from "nstrumenta";
import ws from "ws";
import fs from "fs";

const argv = minimist(process.argv.slice(2));
const wsUrl = argv.wsUrl;

const debug = argv.debug ? argv.debug : false;

let serialPort = undefined;

const nst = wsUrl ? new NstrumentaClient({ wsUrl }) : null;
if (nst) {
  console.log("nst wsUrl:", wsUrl)
}

nst?.addListener("open", () => {
  console.log("nstrumenta open");
  scan();
});
//start scan if nst not set
if (!nst) {
  scan();
}

nst?.init(ws);

var serialDevices = [
  {
    name: "trax2",
    vendorId: "0403",
    productId: "6015",
    baudRate: 38600,
  },
];

if (fs.existsSync("nst-serialport-config.json")) {
  console.log("nst-serialport-config.json begin:");
  var config = JSON.parse(
    fs.readFileSync("nst-serialport-config.json", "utf8")
  );
  config.devices.forEach((element) => {
    console.dir(element);
    serialDevices.push(element);
  });
  console.log("nst-serialport-config.json end");
}


function match(devicePort, device) {
  var match = false;
  //match on path from config file
  if (device.path) {
    match = device.path == devicePort.path;
  }
  //match on vId and pId
  match =
    devicePort.vendorId &&
    devicePort.vendorId.toLowerCase() == device.vendorId &&
    devicePort.productId &&
    devicePort.productId.toLowerCase() == device.productId;
  return match;
}

const scan = () => {
  SerialPort.list().then((devicePorts) => {
    devicePorts.forEach(function (devicePort) {
      console.dir(devicePort);
      //look for device in list
      serialDevices.forEach((device) => {
        const serialDevice = device;
        if (match(devicePort, device)) {
          console.log("connecting to", devicePort.path, serialDevice.name);
          serialPort = new SerialPort(devicePort.path, {
            baudRate: device.baudRate,
          });

          serialPort.on("open", function () {
            nst?.send("serialport-events", { "type": "open", serialDevice });
            nst?.subscribe("trax-in", (message) => {
              const bytes = new Uint8Array(message);
              console.log("trax-in", bytes)
              serialPort.write(bytes);
            });
          });
          serialPort.on("error", function (err) {
            console.error(err);
          });

          serialPort.on("data", function (data) {
            switch (serialDevice.name) {
              default:
                nst?.send(serialDevice.name, data);
                break;
            }
          });
        }
      });
    });
  });
}

