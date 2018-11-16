# nst-serialport
Reads data from the serial port and sends messages to a websocket server.

Intended to be used with the server here:
https://github.com/nstrumenta/nst-websockets.git


## Installation

```bash
npm install -g nst-serialport
```

## How to use

```bash
nst-serialport --port 8080
```

```bash
$ nst-serialport --port 8080
connected to server
{ comName: '/dev/tty.usbmodem141103',
  manufacturer: 'STMicroelectronics',
  serialNumber: '0672FF504955857567203333',
  pnpId: undefined,
  locationId: '14110000',
  vendorId: '0483',
  productId: '374b' }
connecting to /dev/tty.usbmodem141103
nucleo
Open
```
