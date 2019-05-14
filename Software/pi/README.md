# PiBot on Raspberry Pi 
This folder contains configs and scripts only for Raspbian running on Raspberry Pi.

## Installing dependencies
---
* [Janus WebRTC Gateway](https://github.com/ilyastrodubtsev/janus-gateway/tree/janus):
    1. Follow the instructions to build and install it to the recommended location (`/opt/janus`). Enable only websocket transport and streaming plugin, everything else can be disabled.
    2. Edit [janus.transport.websockets.cfg](https://github.com/PiSupply/PiBot/blob/streaming/Software/pi/opt/janus/etc/janus/janus.transport.websockets.cfg): set SSL cert/key paths under `[certificates]` section.
    3. Edit [janus.cfg](https://github.com/PiSupply/PiBot/blob/streaming/Software/pi/opt/janus/etc/janus/janus.cfg): set SSL cert/key paths under `[certificates]` section.
    4. Copy [configs](https://github.com/PiSupply/PiBot/tree/streaming/Software/pi/opt/janus/etc/janus) to `/opt/janus/etc/janus/`
    5. Copy [systemd startup script](https://github.com/PiSupply/PiBot/tree/streaming/Software/pi/lib/systemd/system) to `lib/systemd/system`

* Python 3:
    ```bash
        # apt install python3 libboost-python-dev
        # pip install websockets
    ```
    Then, follow to the folder [Firmware](https://github.com/PiSupply/PiBot/tree/streaming/Firmware) and following the instructions install [PiBot library](https://github.com/PiSupply/PiBot/tree/streaming/Firmware/lib).
* GStreamer 
    ```bash
    # apt install gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-tools python-gst-1.0
    ```

### Wifi connection
 ###### Install if you need it
 ---
+ Balena.io WiFi Connect:
    Creates an access point on raspberry pi, after connecting to which it will be possible to connect the raspberry to the desired Wi-Fi access point.
    Installation:
```bash
# bash <(curl -L https://github.com/balena-io/wifi-connect/raw/master/scripts/raspbian-install.sh)
```
* launch balena.io:
    To run call the command through the terminal:
```bash
# wifi-connect
```
or run script "start-wifi-connect":
```bash
# ./start-wifi-connect
```
If you run this script, then the main script will start automatically.
### Custom wifi-connection script
---
The script is called wifi.py, to run it, you must enter the command:
```bash
# python3 wifi.py
```
This script differs from Balena in that it has the minimum set of functions we need, as well as in the event of an internet connection break, will automatically raise the Wi-Fi point for reconnection.
### Script autoconfiguration of network configs
---
The script is called check_internet.py, to run it, you must enter the command:
```bash
# python3 check_internet.py
```
This script checks the current IP address and, if necessary, replaces the addresses for the web sockets Joystick and Janus, and then restarts the services.
### Main script
---
You may want to set your own SSL certificate / key paths, for this use the arguments `--ssl-cert` `--ssl-key`
When all dependencies are installed, run in this directory:
```bash
$ ./robot.py
```
### PiBot image 
If you are using a pre-built pibot assembly for raspberry pi, in this case scripts wifi.py, check_internet.py, and robot.py run by default along with the system, their autorun is controlled by systemd services wifi-connect.service, check_internet.service, robot.service. 
If you want to control one of the service manually, turn off the necessary service.
