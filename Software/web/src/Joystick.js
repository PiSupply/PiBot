import './Joystick.css'
import React, { Component } from 'react';
import Joystick from './JoystickBase'


const smoothK = 4.0;

export class CameraJoystick extends Component {
    angle = null;
    force = null;
    tm = null;

    move() {
        console.log(this.angle, this.force);
        this.props.onMove(this.angle, this.force);
    }
    onMove = (a, f, d) => {
        if(!d)
            return console.error('direction is invalid');
            
        let plains = {
            left: ['h', f],
            right: ['h', -f],
            down: ['v', f],
            up: ['v', -f]
        }

        let [angle, force] = plains[d];
        this.angle = angle; this.force = force;
        this.move();        
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
                      className="right-joystick" />
        )
    }
}

export class EngineJoystick extends Component {
    step_left = null;
    step_right = null;

    smoothAngle(a, k) {
        return Math.expm1(a/(10.*k))/Math.expm1(9/k)
    }

    onMove = (a, force) => {
        let f = force;
        if(f > 1.0)
            f = 1.0;

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
    
        console.log('smoothA:', smoothA);
        this.props.onMove(f, smoothA)
    }

    onEnd = () => {        
        this.props.onEnd();
    }

    render() {
        return (
            <Joystick onMove={this.onMove} 
                      onEnd={this.onEnd} 
                      className="left-joystick" />
        );
    }
}