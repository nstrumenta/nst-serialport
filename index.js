var SerialPort = require("serialport");
var argv = require('minimist')(process.argv.slice(2));
var port = argv.port || 8080;

var serialDevices = [
  {
    name: "bluecoin",
    vendorId: "0483",
    productId: "5740",
    baudRate: 115200
  },
  {
    name: "nucleo",
    vendorId: "0483",
    productId: "374b",
    baudRate: 9600
  },
  {
    name: "canlogger",
    vendorId: "1cbe",
    productId: "021a",
    baudRate: 115200
  },
  {
    name: "trax",
    vendorId: "0403",
    productId: "6015",
    baudRate: 38600
  },
  {
    name: "teseo",
    vendorId: "067b",
    productId: "2303",
    baudRate: 115200
  }
]

var fs = require("fs");
if (fs.existsSync('nst-serialport-config.json')) {
  console.log('nst-serialport-config.json begin:');
  var config = JSON.parse(fs.readFileSync("nst-serialport-config.json", "utf8"));
  (config.devices).forEach(element => {
    console.dir(element);
    serialDevices.push(element);
  });
  console.log('nst-serialport-config.json end');
}



// TRAX vendor=1027 "FTDI", product=24597 "FT230X Basic UART"

var socket = require('socket.io-client')('http://0.0.0.0:' + port);
socket.on('connect', function () {
  console.log('connected to server');
});
socket.on('disconnect', function () {
  console.log('disconnected from server');
});

var traxData = new Uint8Array(48);
var traxIndex = 0;

var teseoString = "";

function match(port, device){
  var match = false;
  //match on comName from config file
  if (device.comName) {
    match = (device.comName == port.comName)
  }
  //match on vId and pId
  match = (((port.vendorId) && port.vendorId.toLowerCase() == device.vendorId) && (port.productId && (port.productId.toLowerCase() == device.productId)));
  return match;
}

SerialPort.list(function (err, ports) {
  ports.forEach(function (port) {
    console.dir(port);
    //look for device in list
    serialDevices.forEach((device) => {
      var serialDevice = device;
      if (match(port, device)) {
        console.log('connecting to', port.comName);
        var serialPort = new SerialPort(port.comName, {
          baudRate: device.baudRate,
        });

        serialPort.on('open', function () {
          console.log("Open");
          if (serialDevice.name == 'bluecoin') {
            console.log('sending start byte 0x05');

            serialPort.write([0x05]);
          }
        });
        serialPort.on('error', function (err) {
          console.error(err);
        });

        console.log(serialDevice.name);
        serialPort.on('data', function (data) {
          switch (serialDevice.name) {
            case "teseo":
              teseoString += data.toString();
              var teseoSplit = teseoString.split('\r\n');
              for (var i = 0; i < teseoSplit.length - 1; i++) {
                var message = {
                  id: serialDevice.name,
                  comName: port.comName,
                  data: teseoSplit[i]
                }
                // console.log(teseoSplit[i]);
                socket.emit('sensor', message);
              }
              teseoString = teseoSplit[i];

              break;

            case "trax":
              //console.log(data);
              function unaligned() {
                traxIndex = 0;
                console.log(dataIndex);
              }
              for (var dataIndex = 0; dataIndex < data.length; dataIndex++) {
                //00 19 5f
                if ((traxIndex == 0) && (data[dataIndex] != 0x00)) unaligned();
                if ((traxIndex == 1) && (data[dataIndex] != 0x19)) unaligned();
                if ((traxIndex == 2) && (data[dataIndex] != 0x5f)) unaligned();

                traxData[traxIndex++] = data[dataIndex];

                if (traxIndex == 25) {
                  var dataView = new DataView(traxData.buffer);
                  // This unit output SuperEngFrame at power on. You can disable/enable it with commands. Baudrate 38400. Payload 20 bytes with 5 bytes extra, total 25 bytes per package.
                  // typedef struct
                  // {
                  //                 SInt16 magRaw[3];
                  //                 SInt16 accRaw[3];
                  //                 SInt16 gyroRaw[3];
                  //                 UInt16 gTStamp;
                  // }SuperFrame;

                  // Following command to enable/disable it.
                  // Binary command in hex
                  // Enable: 0x00065E018F31
                  //                00 06 – total byte count 6
                  //                5E – SuperFrameRequest
                  //                01 – Enable
                  //                8F 31 – CRC

                  // Disable: 0x00065E009F10
                  //                00 06 – total byte count 6
                  //                5E – SuperFrameRequest
                  //                00 – Disable
                  //                9F 10 – CRC

                  // Output format example
                  // 00 19 5F FF 5A FB 6F 07 87 00 18 00 C3 3F CF FF D9 FF F1 FF FF 2E D5 7E 7E


                  // There are 3 bytes of header:
                  // 00 19 – Total 25 bytes
                  // 5f – SuperFrameResponse

                  // Payload here:
                  // FF 5A – Mag X
                  // FB 6F – Mag Y
                  // 07 87 – Mag Z
                  // 00 18 – Acc X
                  // 00 C3 – Acc Y
                  // 3F CF – Acc Z
                  // FF D9 – Gyro X
                  // FF F1 – Gyro Y
                  // FF FF – Gyro Z
                  // 2E d5 – GyroTimeStamp

                  // End with CRC:
                  // 7E 7E – CRC
                  var timestamp = dataView.getUint16(21);

                  var mag = [];
                  mag.push(dataView.getInt16(3, false));
                  mag.push(dataView.getInt16(5, false));
                  mag.push(dataView.getInt16(7, false));

                  var acc = [];
                  acc.push(dataView.getInt16(9, false));
                  acc.push(dataView.getInt16(11, false));
                  acc.push(dataView.getInt16(13, false));

                  var gyro = [];
                  gyro.push(dataView.getInt16(15, false));
                  gyro.push(dataView.getInt16(17, false));
                  gyro.push(dataView.getInt16(19, false));

                  //console.log(timestamp + ',' + acc[0] + ',' + acc[1] + ',' + acc[2] + ',' + mag[0] + ',' + mag[1] + ',' + mag[2] + ',' + gyro[0] + ',' + gyro[1] + ',' + gyro[2]);

                  traxIndex = 0;
                  var message = {
                    id: serialDevice.name,
                    comName: port.comName,
                    data: {
                      traxTimestamp: timestamp,
                      acc: acc,
                      mag: mag,
                      gyro: gyro
                    }
                  }
                  // console.log(message);                                
                  socket.emit('sensor', message);
                }
              }
              break;

            default:
              // console.log(serialDevice.name);           
              // console.log(data);
              var message = {
                id: serialDevice.name,
                comName: port.comName,
                data: data
              }
              socket.emit('sensor', message);
              break;
          }
        });
      }
    });
  });
});
