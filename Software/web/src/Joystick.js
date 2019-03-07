import './Joystick.css'
import React, { Component } from 'react';
import nipplejs from 'nipplejs';


const smoothK = 4.0, CAMERA_STEP_INTERVAL = 100;

class Joystick extends Component {
    joystick = React.createRef();
    nipple = null;

    componentDidMount() {
        let nipple = nipplejs.create({
            zone: this.joystick.current,
            mode: 'static',
            position: {left: '50%', top: '50%'},
            color: 'black'
        });
        this.nipple = nipple;

        nipple.on('end', (evt, data) => {
            if(!this.props.onEnd)
                return;

            console.log(evt.type, data);
            if(evt.type == 'end')
                this.props.onEnd(evt.type)
            
        }).on('move', (evt, data) => {
            if(!this.props.onMove)
                return;
            // console.log(data.angle.degree, data.force);
            let a = 90 - data.angle.degree;
            if(a < 0)
                a += 360;
            if(a < 0)
                a += 360;

            this.props.onMove(a, data.force)
        }).on('dir', (evt, data) => {
            if(!this.props.onAngle)
                return;
            console.log(data.direction.angle, data.force);
            this.props.onAngle(data.direction.angle);
        });
    }
    
    render() {
        return (
            <div className='joystick' ref={this.joystick} style={this.props.pos} />
        )
    }
}

export class EngineJoystick extends Component {

    smoothAngle(a, k) {
        return Math.expm1(a/(10.*k))/Math.expm1(9/k)
    }

    onMove = (a, force) => {
        let smoothA = 0;
        if(a < 90.0) {
            smoothA = 90.0*this.smoothAngle(a, smoothK);
            // console.log(`${a} -> ${smoothA} (0-90)`);
        } else if(a >= 90.0 && a < 180.0) {
            smoothA = 90+90.0*(1.0-this.smoothAngle(180-a, smoothK));
            // console.log(`${a} -> ${smoothA} (90-180)`);
        } else if(a >= 180.0 && a < 270.0) {
            smoothA = 180+90.0*this.smoothAngle(a-180, smoothK);
            // console.log(`${a} -> ${smoothA} (180-270)`);
        } else if(a >= 270.0 && a < 360.0) {
            smoothA = 270+90.0*(1.0-this.smoothAngle(360-a, smoothK));
            // console.log(`${a} -> ${smoothA} (270-360)`);
        }

        this.props.onMove(smoothA, force)
    }
    onEnd = () => {
        this.props.onEnd();
    }
    render() {
        return (
            <Joystick onMove={this.onMove} 
                      onEnd={this.onEnd} 
                      pos={{ 
                        left: '30px',
                        top: 'calc(50% - 100px/2)'
                    }}/>
        );
    }
}
export class CameraJoystick extends Component {
    angle = null;
    force = null;
    tm = null;

    onMove = (a, f) => {
        if(!this.angle)
            return;
        let plains = {
            left: ['h', f],
            right: ['h', -f],
            down: ['v', f],
            up: ['v', -f]
        }
        let [angle, force] = plains[this.angle];
        this.props.onMove(angle, force);
        this.force = f;
        
        if(!this.tm) {
            this.tm = setInterval(() => {
                this.onMove(this.angle, this.force);
            }, CAMERA_STEP_INTERVAL);
        }
    }

    onAngle = (a) => {
        this.angle = a;
    }

    onEnd = () => {
        if(this.tm) {
            clearInterval(this.tm);
            this.tm = null;
        }
        this.props.onEnd();
    }

    render() {
        return (
            <Joystick onEnd={this.onEnd} 
                      onMove={this.onMove}
                      onAngle={this.onAngle}
                      pos={{ 
                        right: '30px',
                        top: 'calc(50% - 100px/2)'
                    }} />
        )
    }
}
