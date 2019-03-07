import 'bootstrap/dist/css/bootstrap.css';
import './App.css';

import React, { Component } from 'react';
import MicButton from './MicButton';
import FullscreenButton from './FullscreenButton';
import {PlusButton, MinusButton} from './ZoomButton';
import SettingsButton from './SettingsButton';
import {CameraJoystick, EngineJoystick} from './Joystick';
import Video from './Video';
import { RetryReload } from './Dialog';
import Status from './Status';
import Spinner from './Spinner';


const RECONNECT_TIMEOUT = 1000,
        CAMERA_MOVE_STEP = 0.5;

export default class App extends Component {
    state = {
        joystickConnected: false, 
        plusDisabled: true, 
        minusDisabled: true,
        statusText: "",
        loading: true
    };
    config = null;
    reconnectTimeout = 0;

    /** @type {WebSocket} */ ws = null;
    /** @type {React.RefObject<Video>} */ video = React.createRef();
    /** @type {React.RefObject<RetryReload>} */ modal = React.createRef();
    /** @type {React.RefObject<PlusButton>} */ plus = React.createRef();
    /** @type {React.RefObject<MinusButton>} */ minus = React.createRef();
    /** @type {React.RefObject<Status>} */ status = React.createRef();
    /** @type {React.RefObject<Spinner>} */ spinner = React.createRef();
    
    connectJoystick() {
        if(!this.state.config.joystick) {
            this.setState({joystickConnected: true});
            return;
        }
        /** @type {WebSocket} */ let ws = null;
        try {
            console.log('connecting joystick...');
            this.reconnectTimeout = 0;
            if(this.state.config.joystick)
                ws = new WebSocket(this.state.config.joystick);
        } catch(e) {
            console.log('connecting joystick: error', e);
            if(!this.reconnectTimeout)
                this.reconnectTimeout = setTimeout(() => this.connectJoystick(), RECONNECT_TIMEOUT);
            else
                console.log('timeout already started')
            return;
        }
        if(!ws)
            return;

        ws.onopen = () => {
            console.log('joystick connected!');
            this.ws = ws;
            this.ws.send(JSON.stringify({cmd: 'hello'}));
            this.setState({joystickConnected: true});
        }
        ws.onmessage = (msg) => {
            console.log(msg);
        }
        ws.onerror = (err) => {
            // console.log(err);
        }
        ws.onclose = () => {
            this.ws = null;
            this.setState({joystickConnected: false});
            console.log('joystick disconnected');
            if(!this.reconnectTimeout) {
                this.reconnectTimeout = setTimeout(() => this.connectJoystick(), RECONNECT_TIMEOUT);
            } else
                console.log('timeout already started')
        }
    }

    constructor() {
        super();
        this.fetchConfig().then(() => this.connectJoystick());
    }

    sendCommand(cmd) {
        if(this.ws) {
            this.ws.send(JSON.stringify(cmd));
        }
    }

    onJoystickMove = (a, force) => {
        console.log(a, force);
        this.sendCommand({
            cmd: 'move',
            degree: a,
            force: force
        });
    }

    onJoystickEnd = (t) => {
        console.log('engine joystick: end');
        this.sendCommand({
            cmd: 'end'
        });
    }

    onSettingsChanged = (name, value) => {
        console.log(`${name} = ${value}`, this.video);
        this.video.current.set(name, value);
        // TODO: update Video element
    }

    onVideoError = async (e) => {
        console.error(e);
        let res = await this.modal.current.show(
            {header: 'Warning!', text: 'Cannot connect to server'});
        console.log(res);
        if(res == 'reload')
            window.location.reload();
        else
            this.setState({loading: true});
    }

    onVideoStarted = () => {
        console.log('VIDEO STARTED');
        this.setState({loading: false});
        this.updateScaleButtons();
        if(this.statusInterval)
            return;
        this.statusInterval = setInterval(() => {
            this.setState({statusText: this.video.current.status()});
        }, 1000);
    }

    onVideoTime = (t) => {
        this.setState({statusExtra: t.toFixed(1)});
    }

    onVideoSize = (newW, newH) => {
        this.sendCommand({
            cmd: 'resolution', 
            width: newW, 
            height: newH
        });
        this.updateScaleButtons();
    }

    updateScaleButtons() {
        this.setState({
            minusDisabled: this.video.current.scale <= 1.0,
            plusDisabled: false
        });
    }

    onZoomIn = () => {
        this.video.current.zoom(0.1);
        this.updateScaleButtons();
    }

    onZoomOut = () => {
        this.video.current.zoom(-0.1);
        this.updateScaleButtons();
    }

    onCameraMove = (d) => {
        console.log(d);
        let plains = {
            left: ['h', CAMERA_MOVE_STEP],
            right: ['h', -CAMERA_MOVE_STEP],
            down: ['v', CAMERA_MOVE_STEP],
            up: ['v', -CAMERA_MOVE_STEP]
        }
        let [plain, step] = plains[d];
        this.sendCommand({
            cmd: 'look',
            plain,
            step
        });
    }

    onCameraJoystickEnd = () => {
        console.log('camera joystick: end');
    }

    onCameraJoystickMove = (plain, step) => {
        console.log(plain, step);
        this.sendCommand({
            cmd: 'look',
            plain,
            step
        });
    }
    
    onMute = (b) => {
        this.video.current.mute(b);
    }

    async fetchConfig () {
        let response = await fetch("web-config.json");
        let data = await response.json();
        let cfg = data;
        console.log(cfg);
        let config = cfg;
        config.janus = cfg.janus && cfg.janus.replace(/{HOST}/g, document.location.host)
        config.joystick = cfg.joystick && cfg.joystick.replace(/{HOST}/g, document.location.host)
        this.setState({config});
    }    

    render() {
        return (<>
            <Spinner ref={this.spinner} hidden={!this.state.loading}/>
            { this.state.config && <Video 
                                    ref={this.video} 
                                    config={this.state.config} 
                                    onStarted={this.onVideoStarted}
                                    onError={this.onVideoError}
                                    onResize={this.onVideoSize}
                                    onCameraMove={this.onCameraMove}
                                    onResize={this.onVideoSize}
                                    onTime={this.onVideoTime}/> }
            <MicButton onMute={this.onMute} />
            <FullscreenButton />
            { this.state.joystickConnected && <EngineJoystick 
                                                onEnd={this.onJoystickEnd} 
                                                onMove={this.onJoystickMove} /> }
            { this.state.joystickConnected && <CameraJoystick 
                                                onEnd={this.onCameraJoystickEnd} 
                                                onMove={this.onCameraJoystickMove}/> }
            <SettingsButton onChange={this.onSettingsChanged} />
            <PlusButton  onClick={this.onZoomIn} ref={this.plus} disabled={this.state.plusDisabled}/>
            <MinusButton onClick={this.onZoomOut} ref={this.minus} disabled={this.state.minusDisabled}/>
            <RetryReload ref={this.modal}/>
            <Status ref={this.status} info={this.state.statusText} extra={this.state.statusExtra}/>
        </>)
    }
}

