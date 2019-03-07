#!/usr/bin/env python3
import argparse
import asyncio
import json
import websockets
import ssl
import time

import pibot

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GObject


class RobotCamera(object):
    COMMANDS = ['resolution', 'bitrate', 'look'] 
    LOCALHOST = '127.0.0.1'

    CAPS = 'video/x-h264, width={width}, height={height}, framerate=(fraction)30/1, profile=(string)baseline'
    PIPELINE = '''
      v4l2src blocksize=400000  device=/dev/video0 extra-controls="c,rotate=180" !
        {CAPS} !
        queue leaky=2 !
        h264parse !
        rtph264pay config-interval=1 pt=96  perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 !
        udpsink host={LOCALHOST} port={video_rtp_port} buffer-size=32768 sync=false async=false
      alsasrc device=hw:{audio_in_device} buffer-time=40000 !
        queue leaky=2 !
        audioconvert !
        audio/x-raw, rate=48000, channels=2 !
        opusenc bitrate=128000 inband-fec=true frame-size=10 !
        opusparse !
        rtpopuspay pt=111 perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 !
        udpsink host={LOCALHOST} port={audio_rtp_out_port} sync=false async=false
      udpsrc port={audio_rtp_in_port} !
        application/x-rtp,media=audio,payload=111,encoding-name=OPUS !
        queue leaky=2 !
        rtpopusdepay !
        opusparse !
        opusdec !
        alsasink buffer-time=40000 device=hw:{audio_out_device}
    '''

    def __init__(self, kwargs):
        Gst.init(None)
        GObject.threads_init()
        self.pipe = Gst.parse_launch(
            self.PIPELINE.format(**kwargs,
                CAPS=self.CAPS,
                LOCALHOST=self.LOCALHOST)
            .format(**kwargs)
        )
        r = self.pipe.set_state(Gst.State.PLAYING)
        if r != Gst.StateChangeReturn.SUCCESS:
            print('Paying the pipeline returned '+r.value_name)
        self.caps0 = self.pipe.get_by_name('capsfilter0')
        self.src0 = self.pipe.get_by_name('v4l2src0')
        if self.caps0 is None or self.src0 is None:
            print('Could not get self.caps0 or src0')

    def set_v4l_size(self, W, H):
        newcaps = Gst.Caps.from_string(self.CAPS.format(width=W, height=H))
        self.caps0.set_property('caps', newcaps)

    def set_v4l_bitrate(self, kb):
        self.src0.set_property('extra-controls',
                               Gst.Structure.from_string('c,video_bitrate={}'.format(kb*1000))[0])

    def handle(self, cmd, obj):
        if cmd == 'resolution':
            self.set_v4l_size(obj['width'], obj['height'])
        elif cmd == 'bitrate':
            self.set_v4l_bitrate(obj['bitrate'])

    @property
    def commands(self):
        return self.COMMANDS


class RobotJoystick(object):
    COMMANDS = ['move', 'start', 'end', 'look']
    MINTIME = 0.1

    SERVO_H = 1
    SERVO_H_MAX = 170
    SERVO_H_MIN = 10
    
    SERVO_V = 2
    SERVO_V_MAX = 110
    SERVO_V_MIN = 20

    COMMAND_SERVO_PLAIN = {'h': SERVO_H, 'v': SERVO_V}

    def angle_to_t(a):
        tMin = 102.
        tMax = 511.
        t = (a/180.)*(tMax-tMin)+tMin
        return int(t*20000./4096.)

    def __init__(self):
        self.bot = pibot.PiBot()
        self.bot.InitMotorDriver(pibot.DRIVER_M_1_2)
        self.bot.Enable()
        self.bot.SetMotorDrive(pibot.M1, 0)
        self.bot.SetMotorDrive(pibot.M2, 0)
        self.servo_h = 90
        self.servo_v = 90
        self.bot.SetServoControl(self.SERVO_H, RobotJoystick.angle_to_t(self.servo_h))
        self.bot.SetServoControl(self.SERVO_V, RobotJoystick.angle_to_t(self.servo_v))

    def move(self, force, angle):
        if force > 1.0:
            force = 1.0
        if angle == 360:
            angle = 0

        m1 = force
        m2 = force - (force*2)*(angle%90)/90.
        if 0 <= angle < 90:
            M1 = m1
            M2 = m2
        elif 90 <= angle < 180:
            M1 = m2            
            M2 = -m1
        elif 180 <= angle < 270:
            M1 = -m1
            M2 = -m2
        elif 270 <= angle < 360:
            M1 = -m2
            M2 = m1

        M1 = round(M1*255)
        M2 = round(M2*255)
        print('{} {} -> {} {}'.format(force, angle, M1, M2))
        self.bot.SetMotorDrive(pibot.M1, M1)
        self.bot.SetMotorDrive(pibot.M2, M2)

    def look(self, plain, step):
        if plain=='v':
            self.servo_v = self.servo_v + step if self.SERVO_V_MIN <= self.servo_v+step <= self.SERVO_V_MAX else self.servo_v
            servo, angle = self.SERVO_V, self.servo_v            
        elif plain=='h':
            self.servo_h = self.servo_h + step if self.SERVO_H_MIN <= self.servo_h+step <= self.SERVO_H_MAX else self.servo_h
            servo, angle = self.SERVO_H, self.servo_h
        
        print('look: {}={}'.format(plain, angle))
        self.bot.SetServoControl(servo, RobotJoystick.angle_to_t(angle))

    def handle(self, cmd, obj):
        if cmd == 'move':            
            self.move(obj['force'], obj['degree'])            
        elif cmd == 'end':
            self.move(0.0, 0.0)
        elif cmd == 'look':
            self.look(obj['plain'], obj['step'])

    @property
    def commands(self):
        return self.COMMANDS


class RobotWebsocketServer(object):
    JANUS = 'wss://localhost:{janus_ws_port}'
    CLOUD = 'wss://pi-gf.hldns.ru:{ws_port}/janus/pi/web/{id}'
    JOYSTICK = 'wss://pi-gf.hldns.ru:{ws_port}/joystick/pi/web/{id}'

    def __init__(self, joystick, camera, kwargs):
        self.JANUS = self.JANUS.format(**kwargs)
        self.CLOUD = self.CLOUD.format(**kwargs)
        self.JOYSTICK = self.JOYSTICK.format(**kwargs)
        self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
        self.ssl_context.load_cert_chain(kwargs['ssl_cert'], kwargs['ssl_key'])
        self.start_server = websockets.serve(
            self.handle_ws, '0.0.0.0', kwargs['local_ws_port'], ssl=self.ssl_context)
        self.joystick = joystick
        self.camera = camera

        self.client_ssl_context = ssl.SSLContext() #ssl.PROTOCOL_TLS_CLIENT)
        self.client_ssl_context.check_hostname = False
        self.client_ssl_context.verify_mode = ssl.CERT_NONE


    async def run(self):
        # FIXME: this causes "Task was destroyed but it is pending!"
        ws_twoway_task = asyncio.ensure_future(self.ws_2way(self.JANUS, self.CLOUD))
        ws_oneway_task = asyncio.ensure_future(self.ws_1way(self.JOYSTICK))
        done, pending = await asyncio.wait(
            [ws_twoway_task, ws_oneway_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()

    async def handle_ws(self, websocket, path):
        while True:
            msg = await websocket.recv()
            obj = json.loads(msg)
            cmd = obj['cmd']
            # print("< {}".format(obj))
            if cmd == 'hello':
                print('client connected at '+path)
            elif self.joystick and cmd in self.joystick.commands:
                print('joystick: '+cmd)
                self.joystick.handle(cmd, obj)
            elif self.camera and cmd in self.camera.commands:
                print('camera: '+cmd)
                self.camera.handle(cmd, obj)

    async def ws_relay(self, ws_from, ws_to):
        try:
            while True:
                message = await ws_from.recv()
                print('>'+message)
                await ws_to.send(message)
        except:
            print('disconnected')

    async def ws_1way(self, cloud_addr):
        while True:
            try:
                async with  websockets.connect(cloud_addr, ssl=self.client_ssl_context) as cloud_ws:
                    print('1way: connected')
                    await self.handle_ws(cloud_ws, cloud_addr)
            except Exception as e:
                print('1way reconnecting')
                print(e)
                await asyncio.sleep(1)

    async def ws_2way(self, janus_addr, cloud_addr):
        while True:
            try:
                async with  websockets.connect(janus_addr, ssl=self.client_ssl_context, subprotocols=['janus-protocol']) as janus_ws, \
                        websockets.connect(cloud_addr, ssl=self.client_ssl_context) as cloud_ws:
                    print('2way: connected')
                    janus_task = asyncio.ensure_future(self.ws_relay(janus_ws, cloud_ws))
                    cloud_task = asyncio.ensure_future(self.ws_relay(cloud_ws, janus_ws))

                    done, pending = await asyncio.wait(
                        [janus_task, cloud_task],
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for task in pending:
                        task.cancel()
            except Exception as e:
                print('2way reconnecting')
                print(e)
                await asyncio.sleep(1)


parser = argparse.ArgumentParser()
parser.add_argument("--disable-camera", help="Disable camera operation", action="store_true",
    default=False)
parser.add_argument("--disable-joystick", help="Disable joystick opration", action="store_true",
    default=False)
parser.add_argument("--disable-relay", help="Disable websocket relay", action="store_true",
    default=False)
parser.add_argument("--id", help="ID of this device",
    default='MAGIC')
parser.add_argument("--width", help="Camera image width",
    default=1920)
parser.add_argument("--height", help="Camera image height",
    default=1080)
parser.add_argument("--video-rtp-port", help="Video RTP output port (should match Janus input port)",
    default=8004)
parser.add_argument("--audio-rtp-out-port", help="Audio RTP output port (should match Janus input port)",
    default=8006)
parser.add_argument("--audio-rtp-in-port", help="Audio RTP input port (should match Janus output port)",
    default=8200)
parser.add_argument("--audio-in-device", help="ALSA input device number",
    default=1)
parser.add_argument("--audio-out-device", help="ALSA output deivce number",
    default=0)
parser.add_argument("--janus-ws-port", help="Janus control port",
    default=8989)
parser.add_argument("--ws-port", help="Websocket port",
    default=8989)
parser.add_argument("--local-ws-port", help="Websocket port for local server",
    default=8766)
parser.add_argument("--ssl-cert", help="X509 certificate for SSL",
    default='./ssl/ssl.crt')
parser.add_argument("--ssl-key", help="Private key for SSL",
    default='./ssl/ssl.key')
args = parser.parse_args()

if args.disable_camera:
    c = None    
else:
    c = RobotCamera(vars(args))

if args.disable_joystick:
    j = None
else:    
    j = RobotJoystick()

srv = RobotWebsocketServer(j, c, vars(args))
asyncio.get_event_loop().run_until_complete(srv.start_server)
if not args.disable_relay:
    asyncio.ensure_future(srv.run())
asyncio.get_event_loop().run_forever()
