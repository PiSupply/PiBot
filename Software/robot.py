#!/usr/bin/env python3
import asyncio
import json
import websockets
import ssl
import time
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GObject


class RobotCamera(object):
    COMMANDS = ['resolution', 'bitrate']
    HOST = "10.13.37.140"
    LOCALHOST = '127.0.0.1'
    VIDEO_RTP_PORT = 8004
    AUDIO_RTP_PORT = 8006
    AUDIO_RTP_IN_PORT = 8200
    W = 1920
    H = 1080
    CAPS = 'video/x-h264, width={W}, height={H}, framerate=(fraction)30/1, profile=(string)baseline'
    PIPELINE = '''
      sudo 
      alsasrc  device=hw:0,0! queue leaky=2 ! audioconvert ! audio/x-raw, rate=48000, channels=2 ! opusenc bitrate=128000 inband-fec=true frame-size=10 ! opusparse ! rtpopuspay pt=111 perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 ! udpsink host={LOCALHOST} port={AUDIO_RTP_PORT} sync=false async=false
      udpsrc port={AUDIO_RTP_IN_PORT} ! application/x-rtp,media=audio,payload=111,encoding-name=OPUS ! queue leaky=2 ! rtpopusdepay ! opusparse ! opusdec ! alsasink device=hw:0,0
    '''

    def __init__(self):
        Gst.init(None)
        GObject.threads_init()
        self.pipe = Gst.parse_launch(self.PIPELINE.format(
            HOST=self.HOST,
            LOCALHOST=self.LOCALHOST,
            VIDEO_RTP_PORT=self.VIDEO_RTP_PORT,
            AUDIO_RTP_PORT=self.AUDIO_RTP_PORT,
            CAPS=self.CAPS,
            AUDIO_RTP_IN_PORT=self.AUDIO_RTP_IN_PORT).format(W=self.W, H=self.H)
        )
        r = self.pipe.set_state(Gst.State.PLAYING)
        if r != Gst.StateChangeReturn.SUCCESS:
            print('Paying the pipeline returned '+r.value_name)
        self.caps0 = self.pipe.get_by_name('capsfilter0')
        self.src0 = self.pipe.get_by_name('v4l2src0')
        if self.caps0 is None or self.src0 is None:
            print('Could not get self.caps0 or src0')

    def set_v4l_size(self, W, H):
        newcaps = Gst.Caps.from_string(self.CAPS.format(W=W, H=H))
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




class RobotWebsocketServer(object):
    PORT = 8766

    def __init__(self, camera):
        self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
        self.ssl_context.load_cert_chain(
            './ssl/device.crt', './ssl/device.key')
        self.start_server = websockets.serve(
            self.handle_ws, '0.0.0.0', self.PORT, ssl=self.ssl_context)
        self.camera = camera

    def run(self):
        asyncio.get_event_loop().run_until_complete(self.start_server)
        asyncio.get_event_loop().run_forever()

    @asyncio.coroutine
    def handle_ws(self, websocket, path):
        while True:
            msg = yield from websocket.recv()
            obj = json.loads(msg)
            cmd = obj['cmd']
            if cmd == 'hello':
                print('client connected')
            elif cmd in self.camera.commands:
                self.camera.handle(cmd, obj)
            else:
                print(obj)


c = RobotCamera()
srv = RobotWebsocketServer(None, c)
srv.run()
