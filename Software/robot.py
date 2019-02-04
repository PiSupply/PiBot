#!/usr/bin/env python3
import asyncio
import json
import websockets
import ssl
import time
import gi
import pibot
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GObject


class RobotCamera(object):
    COMMANDS = ['resolution', 'bitrate']
    LOCALHOST = '127.0.0.1'
    VIDEO_RTP_PORT = 8004
    AUDIO_RTP_PORT = 8006
    AUDIO_RTP_IN_PORT = 8200
    W = 1280
    H = 720
    JPEG_CAPS = 'image/jpeg, width={W}, height={H}, framerate=(fraction)30/1'
    CAPS = 'video/x-h264, width={W}, height={H}, framerate=(fraction)30/1, profile=(string)baseline'
    PIPELINE = '''
      v4l2src device=/dev/video0 ! {JPEG_CAPS} ! jpegdec ! avenc_h264_omx bitrate=10000000 rtp-payload-size=10 gop-size=4 ! {CAPS} ! queue leaky=2 ! h264parse ! rtph264pay config-interval=1 pt=96  perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 ! tee name=t ! udpsink host={LOCALHOST} port={VIDEO_RTP_PORT} buffer-size=32768 sync=false async=false
      alsasrc  device=hw:1,0 ! queue leaky=2 ! audioconvert ! audio/x-raw, rate=48000, channels=2 ! opusenc bitrate=128000 inband-fec=true frame-size=10 ! opusparse ! rtpopuspay pt=111 perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 ! udpsink host={LOCALHOST} port={AUDIO_RTP_PORT} sync=false async=false
      udpsrc port={AUDIO_RTP_IN_PORT} ! application/x-rtp,media=audio,payload=111,encoding-name=OPUS ! queue leaky=2 ! rtpopusdepay ! opusparse ! opusdec ! alsasink device=hw:1,0
    '''
    
    
    def __init__(self):
        Gst.init(None)
        GObject.threads_init()
        self.pipe = Gst.parse_launch(self.PIPELINE.format(
            LOCALHOST=self.LOCALHOST,
            VIDEO_RTP_PORT=self.VIDEO_RTP_PORT,
            AUDIO_RTP_PORT=self.AUDIO_RTP_PORT,
            CAPS=self.CAPS,
            JPEG_CAPS=self.JPEG_CAPS,
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
        return
        if cmd == 'resolution':
            self.set_v4l_size(obj['width'], obj['height'])
        elif cmd == 'bitrate':
            self.set_v4l_bitrate(obj['bitrate'])

    @property
    def commands(self):
        return self.COMMANDS
    
  
class Robot():
    def __init__(self):
        self.robot = pibot.PiBot()
        self.motion = Motion(self.robot)
        self.cameraMotion = CameraMotion(self.robot)
    

class CameraMotion(object):
    def __init__(self,robot):
        self.robot = robot
        self.robot.Enable()
        self.currentAngleX = 90; 
        self.currentAngleY = 90;
        self.defaultPosition(self.currentAngleX,self.currentAngleY)
        
    def defaultPosition(self, X,Y):
        self.robot.SetServoControl(14,int(self.angleConversion(X)))
        self.robot.SetServoControl(16,int(self.angleConversion(Y)))
	
    def angleConversion(self,angle):
        tMin = 102
        tMax = 511
        t = (angle/180)*(tMax-tMin)+tMin
        return t*20000/4096
  	
    def limiterAngle(self,angle):
        lowerLimit=45
        upperLimit=135
        if lowerLimit >= angle:
            angle = lowerLimit
            return angle
        elif upperLimit <= angle:
            angle = upperLimit
            return angle
        else:
            return angle    


    def motionCamera(self,angle,force):
        maxShiftPerStep = 10
        if 45 <= angle < 135:
            self.currentAngleY = self.currentAngleY + maxShiftPerStep*force
            self.currentAngleY = self.limiterAngle(self.currentAngleY)
            self.robot.SetServoControl(15,int(self.angleConversion(self.currentAngleY)))
        elif 135 <= angle < 225:
            self.currentAngleX = self.currentAngleX - maxShiftPerStep*force
            self.currentAngleX = self.limiterAngle(self.currentAngleX)
            self.robot.SetServoControl(16,int(self.angleConversion(self.currentAngleX)))
        elif 225 <= angle < 315:
            self.currentAngleY = self.currentAngleY - maxShiftPerStep*force
            self.currentAngleY = self.limiterAngle(self.currentAngleY)
            self.robot.SetServoControl(15,int(self.angleConversion(self.currentAngleY)))
        else:
            self.currentAngleX = self.currentAngleX + maxShiftPerStep*force
            self.currentAngleX = self.limiterAngle(self.currentAngleX)
            self.robot.SetServoControl(16,int(self.angleConversion(self.currentAngleX)))
            
        print('X:{} Y:{}'.format(int(self.currentAngleX),int(self.currentAngleY)))


class Motion(object):
	
    def __init__(self,robot):
        self.robot  = robot
        self.robot.InitMotorDriver(pibot.DRIVER_M_1_2)
        self.robot.Enable()
        self.stopVehicle()
        print("initialized")
        
    def stopVehicle(self):
        self.robot.SetMotorDrive(pibot.M1,0)
        self.robot.SetMotorDrive(pibot.M2,0)

    def motionVehicle(self, angle, force):
        
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
        self.robot.SetMotorDrive(pibot.M1, M1)
        self.robot.SetMotorDrive(pibot.M2, M2)


class RobotWebsocketServer(object):
    PORT = 8766

    def __init__(self, joystick, camera):
        self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
        self.ssl_context.load_cert_chain(
            './ssl/device.crt', './ssl/device.key')
        self.start_server = websockets.serve(
            self.handle_ws, '0.0.0.0', self.PORT, ssl=self.ssl_context)
        self.joystick = joystick
        self.camera = camera
        self.robot = Robot()
        #self.motion = self.robot.motion
        #self.cameraMotion = self.robot.cameraMotion

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
            elif self.joystick and cmd in self.joystick.commands:
                self.joystick.handle(cmd, obj)
            elif cmd in self.camera.commands:
                self.camera.handle(cmd, obj)
            elif cmd == 'move2':
                self.robot.cameraMotion.motionCamera(obj['degree'], obj['force'])
            elif cmd == 'move':
                self.robot.motion.motionVehicle(obj['degree'], obj['force'])
            elif cmd == 'end':
                self.robot.motion.stopVehicle()
            else:
                print(obj['cmd'])


c = RobotCamera()
srv = RobotWebsocketServer(None, c)
srv.run()
