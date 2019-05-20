import './Video.css'
import React, { Component } from 'react';
import adapter from 'webrtc-adapter';
import Janus from 'janus-gateway'


const STREAM_ID = 1;
const RESIZE_TIMEOUT = 1000;
const DW = 4, DH = 3, MAXW = 1640, MAXH = 1230, MINW = 48, MINH = 36;
const KEYS = {
    KeyA: 'left',
    KeyD: 'right',
    KeyS: 'down',
    KeyW: 'up'
};
const QUALITY={quality_low: 0.3, quality_med: 0.5, quality_hi: 1};
const MOBILE = ('ontouchstart' in window );

export default class Video extends Component {
    state = {fit_width: false, fit_height: true};

    haveAudio = undefined;
    fitMode = 'fill';
    quality = 1.0;
    resizeTm = 0;
    scale = 1.0;
    tX=0; tY=0; X=0; Y=0;

    /** @type {React.RefObject<HTMLVideoElement>} */video = React.createRef();

    /** @param {React.SyntheticEvent} e */
    touchDown = (e) => {
        if(MOBILE) {
            e.preventDefault();
            e.stopPropagation();
        }

        let ev = e.nativeEvent;

        let x = ev.touches? ev.touches[0].pageX: ev.pageX,
            y = ev.touches? ev.touches[0].pageY: ev.pageY;
        this.X = x - this.tX;
        this.Y = y - this.tY;

    }

    /** @param {React.SyntheticEvent} e */
    touchMove = (e) => {
        if(MOBILE) {
            e.preventDefault();            
            e.stopPropagation();
        }

        let ev = e.nativeEvent, el = e.target;
        if(!((ev.type == 'mousemove' && ev.buttons == 1) || ev.type == 'touchmove'))
            return;

        e.preventDefault();
        let x = ev.touches? ev.touches[0].pageX: ev.pageX,
            y = ev.touches? ev.touches[0].pageY: ev.pageY,
            dx = x - this.X, dy = y - this.Y;
        console.debug(el, dx);	

        let rect = this.video.current.getBoundingClientRect(),
            W = document.documentElement.clientWidth,
            H = document.documentElement.clientHeight;

        let maxX = (rect.width-W)/2;
        let maxY = (rect.height-H)/2;
        if(maxX >= 0) {
            if(dx > 0 && dx > maxX)
                dx = maxX;		
            else if(dx < 0 && dx < -maxX)
                dx = -maxX;
        }
        if(maxY >= 0) {
            if(dy > 0 && dy > maxY)
                dy = maxY;
            else if(dy < 0 && dy < -maxY)
                dy = -maxY;
        }
        if(maxX >= 0 && maxY >= 0)
            this.setTransform(dx, dy);

    }

    playing = (e) => {
        console.log(e);
        if(this.props.muted)
            this.mute(true);
        this.props.onStarted(this.haveAudio);
        this.resize();
    }

    paused = (e) => {
        console.log(e);
    }

    time = (e) => {
        // TODO: detect pauses
        // console.log(e.target.currentTime);
        this.props.onTime(e.target.currentTime);
    }

    componentDidMount() {
        this.connectWebRTC().then(() => {
            this.resize();
        });
        window.addEventListener('resize', (e) => {
            this.resize();
            console.log(e);
        });

        window.addEventListener('keydown', (e) => {
            this.onKeyDown(e);
        })
    }

    componentDidUpdate(prevProps) {
        if(this.props.muted != prevProps.muted) {
            this.mute(this.props.muted);
        }
    }

    async connectWebRTC() {
        if(!this.props.config.janus)
            return;

        let deps = Janus.useDefaultDependencies({adapter});
        await new Promise(resolve => Janus.init({
            debug: 'all',
            dependencies: deps,
            callback: resolve}));
        console.log('Janus inited');

        let showErrorAndReload = async (e) => {
            console.log(e, this.haveAudio);
            if(e.name == 'NotAllowedError' && this.haveAudio) {
                this.haveAudio = false;
            } else if(e == "No capture device found") {
                return;
            } else {
                await this.props.onError(e);
            }
            janus.destroy();
        }
        
        if(!Janus.isWebrtcSupported()) {
            showErrorAndReload("No WebRTC support... ");
        }

        let janus, me=this;
        await new Promise((resolve, reject) => { janus = new Janus({
                server: me.props.config.janus,
                success: resolve,
                error: showErrorAndReload,
                destroyed: () => this.connectWebRTC()
            });
        });
        console.log('Janus connected');

        let opaqueId = "streamingtest-"+Janus.randomString(12);
        let streaming = await new Promise((resolve, reject) => {
            janus.attach({
                plugin: "janus.plugin.streaming",
                opaqueId: opaqueId,
                success: resolve,
                error: showErrorAndReload,
                onmessage: (msg, jsep) => {
                    Janus.debug(" ::: Got a message :::");
                    Janus.debug(msg);
                    let result = msg.result;
                    if(result && result.status) {
                        if(result.status == 'started') {
                            console.log('Streaming started!');
                            
                            // FIXME: update MicButton every time.
                            
                            if(me.video.current.played.length) {
                                me.playing();
                            }							
                        }
                    } else if(msg.error) {
                        showErrorAndReload(msg.error);
                    }
                    if(jsep) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
        
                        streaming.createAnswer({
                            jsep: jsep,
                            media: { audioSend: this.haveAudio, videoSend: false },
                            success: function(jsep) {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                streaming.send({
                                    message: { request: 'start' }, 
                                    jsep: jsep
                                });
        // 								$('#watch').html("Stop").removeAttr('disabled').click(stopStream);
                            },
                            error: showErrorAndReload,
                        });
                    }
                },
                onremotestream: (stream) => {
                    Janus.debug(" ::: Got a remote stream :::");
                    Janus.debug(stream);
                    console.log('Janus remote stream received');
                    let vid = me.video.current;
                    Janus.attachMediaStream(vid, stream);
                    vid.muted = false;
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification :::");
                },
                slowLink: (u,n) => {
                    console.warn('slowlink', u, n);
                }
            })
        });
        this.streaming = streaming;
        console.log('Janus plugin attached');
                                    
        let devices = await navigator.mediaDevices.enumerateDevices();
        
        if(this.haveAudio === undefined) {
            for(let d of devices) {
                if(d.kind == 'audioinput')
                    this.haveAudio = true;
            }
            if(this.haveAudio === undefined)
                this.haveAudio = false;
        }

        let result = await new Promise(resolve => streaming.send({
            message: { request: "list" }, 
            success: resolve
        }));

        if(!result.list || result.list[0].id != STREAM_ID) {
            throw "Wrong stream received";
        }
    // 							$('#myVideo')[0].onplaying =  () => toggleLoading(false);
        streaming.send({
            message: { request: 'watch', id: STREAM_ID }
        });

    }

    resize = (e) => {
        let w = document.documentElement.clientWidth*this.quality,
            h = document.documentElement.clientHeight*this.quality,
            W, H;
        console.log(`${w}x${h}`);

        // fit height, crop width
        H = Math.round(h/DH/2)*DH*2; W = H*DW/DH;
        let dh = Math.abs(h-H), dw = Math.abs(w-W);
        console.log(`fit height: ${W}x${H} ${dw}x${dh} ${W/H}`)    
        let dw1 = dw, dh1 = dh, W1 = W, H1 = H;

        // fit width, crop height
        W = Math.round(w/DW/2)*DW*2; H = W*DH/DW;    
        dh = Math.abs(h-H); dw = Math.abs(w-W);
        console.log(`fit width: ${W}x${H} ${dw}x${dh} ${W/H}`)
        let dw2 = dw, dh2 = dh, W2 = W, H2 = H;

        let fit;
        switch(this.fitMode) {
            case 'fit_width':
                fit = {fit_width: true, fit_height: false};
                W=W2; H=H2;
            break;
            case 'fit_height':
                fit = {fit_width: false, fit_height: true};
                W=W1; H=H1;
            break;
            case 'fit_both':
                fit = {fit_width: true, fit_height: true};
                if(w/h > DW/DH) {
                    // fit height
                    W = W1; H = H1;
                } else {
                    // fit width
                    W = W2; H = H2;
                }
            break;
            case 'fill':
                if(w/h < DW/DH) {
                    fit = {fit_width: false, fit_height: true};
                    W=W1; H=H1;
                } else {
                    fit = {fit_width: true, fit_height: false};
                    W=W2; H=H2;
                }
            break;
        }

        console.log(`best fit: ${W}x${H}`, fit);
        if(W >= MAXW || H >= MAXH) {
            W = MAXW; H = MAXH;
        } else if(W <= MINW || H <= MINH) {
            W = MINW; H = MINH;
        }
        let newW = W, newH = H;
        
        this.setState(fit, () => {
            this.zoom(0.0);
            if(this.resizeTm) {
                clearTimeout(this.resizeTm);
            }
            this.resizeTm = setTimeout(() => {
                this.props.onResize(newW, newH);
                this.resizeTm = null;
            }, RESIZE_TIMEOUT);
        });
    }

    set(name, value) {
        if(name == 'fit_mode') {
            this.fitMode = value;
        } else if(name == 'quality') {
            this.quality = QUALITY[value];
        } else {
            console.error(`Unknown "${name}"`);
            return;
        }
        this.resize();
    }

    setTransform(dx, dy, scale) {
        let tr = `translateX( calc( ${dx}px - 50% ) )`;
        if(this.state.fit_width)
            tr += `translateY( calc( ${dy}px - 50% ) )`;
        else
            tr += `translateY(${dy}px)`
        if(!scale)
            scale = this.scale;
        tr += ` scale(${scale})`;
        this.setState({transform: tr})
        this.tX = dx; this.tY = dy;
    }

    zoom(z) {
        if(z == 0.0)
            this.scale = 1.0;
        else
            this.scale += z;
        this.setTransform(0, 0);
    }

    onKeyDown = (e) => {
        console.log(e.code);
        if(KEYS[e.code])
            this.props.onCameraMove(KEYS[e.code])
    }
    
    mute(b) {
        if(!this.haveAudio)
            return;
        console.log('mute', b);
        if(!this.streaming)
            return;

        if(b) {
            this.streaming.muteAudio();
        } else {
            this.streaming.unmuteAudio();
        }
    }

    /**
     * @returns {string} width, height, bitrate
     */
    status() {
        if(!this.streaming)
            return '<no video>'
        let b = parseInt(this.streaming.getBitrate()),
            v = this.video.current, 
            w = v.videoWidth, 
            h = v.videoHeight;
        if(Janus.webRTCAdapter.browserDetails.browser == 'safari')
            b = Math.round(b / 1000);
        return `${w}x${h} @ ${b} kb/s`;
    }

    render() {
        return (
        <video autoPlay muted playsInline loop 
            id="myVideo"
            className={`${this.state.fit_width? 'fit_width': ''} ${this.state.fit_height? 'fit_height': ''}`}
            style={{transform: this.state.transform}}
            ref={this.video}
            onMouseDown={this.touchDown}
            onMouseMove={this.touchMove}
            onTouchStart={this.touchDown}
            onTouchMove={this.touchMove}
            onKeyDown={this.onKeyDown}
            onPlaying={this.playing} onTimeUpdate={this.time} >
            
            {/* <source src="https://www.w3schools.com/howto/rain.mp4" type="video/mp4"></source> */}
            Your browser does not support HTML5 video.
        </video>)
    }
}
