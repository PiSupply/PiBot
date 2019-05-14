import NetworkManager
from aiohttp import web
import dbus
import json
import subprocess
import time
import threading
import dbus.mainloop.glib
from gi.repository import GObject
import asyncio
from os import system


HOTSPOT_TIME = 30
GATEWAY = '192.168.42.1'
DHCP_RANGE = '192.168.42.2,192.168.42.254'
IFACE = 'wlan0'
DNSMASQ = '/usr/sbin/dnsmasq'
REDIR = True

class TestDaemon(threading.Thread):
    def run(self):
        self.__loop = GObject.MainLoop()
        self.__loop.run()

    def __init__(self):
        GObject.threads_init()
        dbus.mainloop.glib.threads_init()
        dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

        threading.Thread.__init__(self)
        self.setDaemon(True)


class WifiConnector():

    def __init__(self):
        dbus.mainloop.glib.threads_init()
        dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
        # NetworkManager.NetworkManager.OnPropertiesChanged(nmHandler)
        print('running main loop')
        self.daemon = TestDaemon()
        self.daemon.start()

        self._hotspotTimer = None
        self._hotspotActive = False
        NetworkManager.NetworkManager.OnStateChanged(self._onStateChanged)
        if NetworkManager.NetworkManager.State != NetworkManager.NM_STATE_CONNECTED_GLOBAL:
            self._startHotspotTimer()

    def scan(self):
        wireless = NetworkManager.NetworkManager.GetDeviceByIpIface(IFACE)
        # wireless.OnPropertiesChanged(nmHandler)
        # wireless.OnAccessPointAdded(nmHandler)
        print('scanning APs...')
        try:
            wireless.RequestScan({})
        except dbus.exceptions.DBusException as e:
            print('RequestScan failed', e)
        aps = wireless.AccessPoints
        access_points = []
        objects = []
        print('wireless.AccessPoints: {}'.format(len(aps)))
        i = 1
        for a in aps:                                                                                            
            try:                                                                                                 
                print("{}. {}: {} {} {} {} flags={:#x} wpa={:#x} rsn={:#x}"
                    .format(i, a.Ssid, a.Frequency, a.HwAddress, a.Strength, a.Mode, a.Flags, a.WpaFlags, a.RsnFlags))
                if a.Flags & NetworkManager.NM_802_11_AP_FLAGS_PRIVACY \
                    and a.WpaFlags == NetworkManager.NM_802_11_AP_SEC_NONE \
                    and a.RsnFlags == NetworkManager.NM_802_11_AP_SEC_NONE:
                    security = 'wep'
                elif a.WpaFlags & NetworkManager.NM_802_11_AP_SEC_KEY_MGMT_802_1X \
                    or a.WpaFlags & NetworkManager.NM_802_11_AP_SEC_KEY_MGMT_802_1X:
                    security = 'enterprise'
                elif a.WpaFlags != NetworkManager.NM_802_11_AP_SEC_NONE or a.RsnFlags != NetworkManager.NM_802_11_AP_SEC_NONE:
                    security = 'wpa'
                else:
                    security = 'none'

                access_points.append({
                    'ssid': a.Ssid,
                    'strength': a.Strength,
                    'security': security,
                    'frequency': a.Frequency,
                    'hwaddress': a.HwAddress,
                    'mode': {
                        NetworkManager.NM_802_11_MODE_INFRA: 'infra', 
                        NetworkManager.NM_802_11_MODE_ADHOC: 'adhoc',
                        NetworkManager.NM_802_11_MODE_UNKNOWN: 'unknown'}[a.Mode]
                })                
                i += 1
            except NetworkManager.ObjectVanished:                                                         
                pass
        self.access_points = access_points
        return self.access_points

    def _startHotspotTimer(self):
        if self._hotspotActive:
            return

        print('*** STARTING HOTSPOT TIMER ***')
        if self._hotspotTimer:            
            self._hotspotTimer.cancel()
        self._hotspotTimer = threading.Timer(HOTSPOT_TIME, self._hotspot)
        self._hotspotTimer.start()    
    
    def _hotspot(self, b=True):
        if b == self._hotspotActive:
            return

        if b:
            print('*** ACTIVATING HOTSPOT ***')
            if self._hotspotTimer:
                self._hotspotTimer.cancel()
            self._hotspotTimer = None
            self._hotspotActive = True
            self._startHotspot()
        else:
            print('*** DEACTIVATING HOTSPOT ***')
            self._hotspotActive = False
            self._stopHotspot()
    
    def _hotspotActiveConnectionOnPropertiesChanged(self, *args, **kwargs):
        print('_hotspotActiveConnectionOnPropertiesChanged: {} {}'.format(args, kwargs))

    def _startHotspot(self):
        wireless = NetworkManager.NetworkManager.GetDeviceByIpIface(IFACE)
        self.scan()
        settings={
            '802-11-wireless': {
                'ssid': 'MyAccessPoint', 
                'band': 'bg', 
                'hidden': False, 
                'mode': 'ap'
            }, 
            'connection': {
                'type':'802-11-wireless', 
                'interface-name': IFACE
            }, 
            'ipv4': {
                'method': 'manual',
                'address-data': [{"address": GATEWAY, "prefix": 24}]
            }
        }
        self._hotspotConnection, self._hotspotActiveConnection = NetworkManager.NetworkManager.AddAndActivateConnection(settings, wireless, "/")
        self._hotspotActiveConnection.OnPropertiesChanged(self._hotspotActiveConnectionOnPropertiesChanged)
        # r1.OnPropertiesChanged(nmHandler)
        # r0.OnUpdated(nmHandler)
        # r0.OnPropertiesChanged(nmHandler)
        print('AP is up state='+str(self._hotspotActiveConnection.State))
        time.sleep(1)
        self.dnsmasq = subprocess.Popen([DNSMASQ, 
            '--address=/#/'+GATEWAY, 
            '--dhcp-range='+DHCP_RANGE,
            '--dhcp-option=option:router,'+GATEWAY,
            '--interface='+IFACE, 
            '--keep-in-foreground', 
            '--bind-interfaces', 
            '--except-interface=lo',
            '--conf-file', 
            '--no-hosts', 
            '--dhcp-authoritative', 
            '--log-dhcp'
        ])
    
    def _stopHotspot(self):
        print('deactivating AP...')
        try:
            NetworkManager.NetworkManager.DeactivateConnection(self._hotspotActiveConnection)
        except NetworkManager.ObjectVanished as e:
            print('Failed to deactivate AP', e)
        print('deleting AP...')
        self._hotspotConnection.Delete()
        print('killing dnsmasq...')
        self.dnsmasq.kill()
        self.dnsmasq.wait()
        print('done')
        self._hotspotActiveConnection.OnPropertiesChanged(None)
        self._hotspotConnection, self._hotspotActiveConnection, self.dnsmasq = None, None, None

    def _onUpdated(self, arg, *args, **kwargs):
        print('onUpdated: {} {} {} {}'.format(arg, args, kwargs, kwargs['signal']))        
        try:
            print(arg.GetSettings())
            r1 = self._activeConnection
            if not r1:
                activeConnections = NetworkManager.NetworkManager.ActiveConnections
                for c in activeConnections:
                    print('activeConnection {} {}'.format(c.Id, c.Uuid, c.Connection))
                return
            try:
                print('onUpdated connection state: {}'.format(r1.State))
                if r1.State not in [NetworkManager.NM_ACTIVE_CONNECTION_STATE_ACTIVATED, NetworkManager.NM_ACTIVE_CONNECTION_STATE_ACTIVATING]:
                    print('invalid cpnnection state!')
                    self._activeConnection = None
                    arg.Delete()
                    self._hotspot()
                else:
                    self._lastState = r1.State
                    if self._lastState == NetworkManager.NM_ACTIVE_CONNECTION_STATE_ACTIVATED and \
                        NetworkManager.NetworkManager.State == NetworkManager.NM_STATE_CONNECTED_GLOBAL:
                        self._connected()
            except NetworkManager.ObjectVanished:
                # The AP disappeared
                # TODO: start hostspot if activeConnection has never been in NM_ACTIVE_CONNECTION_STATE_ACTIVATED
                print('connection failed: activeConnection vanished lastState={}'.format(self._lastState))                
                self._activeConnection = None
                if self._lastState != NetworkManager.NM_ACTIVE_CONNECTION_STATE_ACTIVATED:
                    arg.Delete()
                    self._hotspot()
                # arg.Delete()
        except NetworkManager.ObjectVanished:
            print('connection failed: connection vanished')
            self._activeConnection = None
    
    def _connected(self):
        print('*** CONNECTED TO INTERNET ***')
        self._hotspot(False)
        if self._hotspotTimer:
            self._hotspotTimer.cancel()
        self._hotspotTimer = None
        
    def _onSignal(self, arg, *args, **kwargs):
        print('onSignal {}: {} {} {}'.format(kwargs['signal'], arg, args, kwargs))

    def _onStateChanged(self, arg, *args, **kwargs):
        print('onStateChanged: {} {}'.format(args, kwargs))
        if kwargs['state'] == NetworkManager.NM_STATE_CONNECTED_GLOBAL:
            self._connected()
        else:
            # TODO: start hotspot timer
            self._startHotspotTimer()

    def connect(self, ssid, password):
        self._hotspot(False)
        time.sleep(10)

        settings={
            '802-11-wireless': {
                'ssid': ssid, 
            }, 
            # TODO: remove this when connecting to an open network
            '802-11-wireless-security': {
                'key-mgmt': 'wpa2-psk',
                'psk': password
            }
        }
        wireless = NetworkManager.NetworkManager.GetDeviceByIpIface(IFACE)
        try:
            wireless.RequestScan({"ssids": [ssid]})
        except dbus.exceptions.DBusException as e:
            print('RequestScan failed', e)
        ap = None
        for o in wireless.AccessPoints:
            try:
                if o.Ssid == ssid:
                    if ap==None or ap.Strength < o.Strength:
                        ap = o
            except NetworkManager.ObjectVanished:
                pass
        
        
        print('RELOADING NETWORK-MANAGER')
        system("x-terminal-emulator -e rm -rf /etc/NetworkManager/system-connections/*")
        #system("x-terminal-emulator -e systemctl restart network-manager.service")
        #time.sleep(8)
        print('selected AP: {}'.format(ap))
        print('connecting...')        
        r0 = NetworkManager.NetworkManager.AddAndActivateConnection(settings, wireless, ap)
        r1 = NetworkManager.NetworkManager.AddAndActivateConnection(settings, wireless, ap)
        r0.OnPropertiesChanged(self._onSignal)
        r0.OnUpdated(self._onUpdated)
        r0.OnRemoved(self._onSignal)
        r1.OnPropertiesChanged(self._onSignal)
        print('done.')
        try:
            print('connection state: {}'.format(r1.State))
        except NetworkManager.ObjectVanished:
            print('connection failed!')
            r0.Delete()
            self._hotspot()
            return
        self._activeConnection = r1
        self._connection = r0
        self._lastState = None
    
    def disconnect(self):
        NetworkManager.NetworkManager.DeactivateConnection(self._activeConnection)
        self._connection.Delete()


@web.middleware
async def redir_middleware(request, handler):    
    print("{} {} {}".format(request.scheme, request.host, request.rel_url))
    if REDIR:
        try:
            res = await handler(request)
            # TODO: if res.status == 404:
            return res
        except web.HTTPException as ex:
            print('exception status='+str(ex.status))
            if ex.status == 404:
                print('return 302')
                raise web.HTTPFound('https://{}/index.html'.format(GATEWAY))
            else:
                raise
    else:
        raise web.HTTPFound('https://{}{}'.format(request.host, request.rel_url))

async def get_networks(request):
    global wifi
    print('get_networks')
    return web.Response(text=json.dumps(wifi.access_points))

async def post_connect(request):
    global wifi
    d = await request.json()
    request.loop.call_later(1, wifi.connect, d['name'], d['passphrase'])
    return web.Response()

async def on_shutdown(app):
    global wifi
    wifi._hotspot(False)

wifi = WifiConnector()
app = web.Application(middlewares=[redir_middleware])
app.add_routes([
    web.get('/networks', get_networks), 
    web.post('/connect', post_connect)
])
app.on_shutdown.append(on_shutdown)
web.run_app(app, port=80)
