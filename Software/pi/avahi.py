import logging
import socket
import sys
import fcntl
import struct
import simplejson as json
from time import sleep

from zeroconf import ServiceInfo, Zeroconf

PASS = '/home/pi/PiBot/Software/pi/current.json'

def readJson(file):
    with open(file, 'r') as files:
        jsonData = json.load(files)
        return jsonData
        
if len(sys.argv) <= 1:
    serviceName = "PiBot Web Site"
else:
    serviceName = sys.argv[1]

if __name__ == '__main__':
    '''
    logging.basicConfig(level=logging.DEBUG)
    if len(sys.argv) > 1:
        assert sys.argv[1:] == ['--debug']
        logging.getLogger('zeroconf').setLevel(logging.DEBUG)
    '''

    desc = {'path': '/~paulsm/'}
    config = readJson(PASS)
    info = ServiceInfo("_pibot._tcp.local.",
                       serviceName + "._pibot._tcp.local.",
                       socket.inet_aton(config['ip']), 80, 0, 0,
                       desc, "ash-3.local.")

    zeroconf = Zeroconf()
    print("Registration of a service, press Ctrl-C to exit...")
    zeroconf.register_service(info)
    try:
        while True:
            sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        print("Unregistering...")
        zeroconf.unregister_service(info)
zeroconf.close()
