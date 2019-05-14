import socket
import json
import os

JANUS_PORT = '8989'
JOYSTICK_PORT = '8766'
PASS_TO_WEB_CONFIG = '/home/pi/web/build/web-config.json'
PASS_TO_IP_CONFIG = '/home/pi/PiBot/Software/pi/current.json'

def checkConnection():
    try:
        host = socket.gethostbyname('www.google.com')
        s = socket.create_connection((host, 80), 2)
        return True
    except:
        pass
        return False


def getIpAddress():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("google.com", 443))
    return s.getsockname()[0]
    # address = socket.gethostbyname(socket.gethostname())
    # return address


def readJson(file):
    with open(file, 'r') as files:
        jsonData = json.load(files)
        return jsonData


def writeJson(file,jsonData):
    with open(file, 'w') as f:
        f.write(json.dumps(jsonData))


def updateConfig():
    config = readJson(PASS_TO_WEB_CONFIG)
    ipAddress = getIpAddress()
    config['janus'] = "wss://%s:%s" % (ipAddress, JANUS_PORT)
    config['joystick'] = "wss://%s:%s" % (ipAddress, JOYSTICK_PORT)
    writeJson(PASS_TO_WEB_CONFIG,config)
    config = readJson(PASS_TO_IP_CONFIG)
    config['ip'] = ipAddress
    writeJson(PASS_TO_IP_CONFIG,config)


def checkCurrentIp():
    config = readJson(PASS_TO_IP_CONFIG)
    currentIp = getIpAddress()
    if config['ip'] == currentIp:
        return True
    else:
        return False


if checkCurrentIp() == False and checkConnection() == True:
    updateConfig()
    os.system('systemctl restart nginx.service')
    os.system('systemctl restart robot.service')
