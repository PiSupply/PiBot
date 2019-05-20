import './JoystickBase.css'
import React, { Component } from 'react';


const R = 50, R2 = R/2, 
    initialTransform=`translateX(${R2}px) translateY(${R2}px)`,
    directions = {0: 'up', 1: 'right', 2: 'down', 3: 'left'};

export default class Joystick extends Component {
    wrapperRef = React.createRef();
    innerRef = React.createRef();
    outerRef = React.createRef();
    state = {
        outerPressed: false,
        innerTransform: initialTransform
    }

    onMouseDown = (e) => {
        console.log(e);
    }

    onOuterDown = (e) => {
        console.log('onOuterDown');
        e.preventDefault();
        this.setState({outerPressed: true});
        this.onWrapperMove(e, true);
    }

    onOuterTouch = (e) => {
        console.log('onOuterTouch');
        console.log(e.touches, e.targetTouches);
        this.setState({outerPressed: true});
        this.onWrapperMove(e, true);
    }

    onWrapperUp = (e) => {
        if(!this.state.outerPressed)
            return;

        console.log('onWrapperUp');
        this.setState({
            outerPressed: false,
            innerTransform: initialTransform
        });
        this.props.onEnd && this.props.onEnd();
    }

    onWrapperMove = (e, b) => {
        if(!(b || this.state.outerPressed))
            return;

        e.preventDefault();

        let ev = e.nativeEvent, el = e.target;

        let x = ev.targetTouches? ev.targetTouches[0].pageX: ev.pageX,
            y = ev.targetTouches? ev.targetTouches[0].pageY: ev.pageY;
        if(ev.targetTouches) {
            // console.log(ev.targetTouches[0].radiusX, ev.targetTouches[0].radiusY);
            y -= ev.targetTouches[0].radiusY/2;
        }
        this.move(x, y);
    }

    move(x, y) {
        let r = this.outerRef.current.getBoundingClientRect(),
            ix = r.x, iy = r.y;
        let dx=x-R2-ix, dy=y-R2-iy;
        // console.log(x, y, dx, dy);

        let outerCenter = {x: r.x + r.width/2, y: r.y + r.height/2},
            innerCenter = {x: x, y: y},
            distance = Math.sqrt(Math.pow(outerCenter.x-innerCenter.x, 2)+
                                Math.pow(outerCenter.y-innerCenter.y, 2));
        let a = Math.acos((outerCenter.x-innerCenter.x)/distance),
            ddd = a*180./Math.PI, nx, ny;
        if(outerCenter.y-innerCenter.y < 0) {
            ddd = 360 - ddd;
            nx = Math.cos(Math.PI-a)*R+R2;
            ny = Math.sin(a)*R+R2;
        } else {
            nx = Math.cos(Math.PI-a)*R+R2;
            ny = Math.sin(-a)*R+R2;
        }
        ddd = (ddd+270)%360;
        let dir = (Math.floor((ddd-45.)/90.)+1)%4;
        console.log(distance/R, ddd, dir);
        if(distance > R)
            [dx, dy] = [nx, ny];

        this.setState({innerTransform: `translateX(${dx}px) translateY(${dy}px)`})
        if(!directions[dir])
            console.error('invalid dir: '+dir);
        this.props.onMove && this.props.onMove(ddd, distance/R, directions[dir]);
    }

    onWrapperOut = (e) => {
        if(e.target == this.wrapperRef.current) {
            console.log('onWrapperOut', e.target);
            this.onWrapperUp(e);
        }
    }

    render() {
        return (
            <div className={"joystick-wrapper fullscreen"}
                onMouseMove={this.onWrapperMove}
                onMouseUp={this.onWrapperUp}
                onMouseLeave={this.onWrapperOut}
                onTouchMove={this.onWrapperMove}
                onTouchEnd={this.onWrapperUp}
                ref={this.wrapperRef}
                style={{
                    visibility: this.state.outerPressed? 'visible': 'hidden',
                    cursor: this.state.outerPressed? 'grabbing': 'auto',
                    // zIndex: this.state.outerPressed? 999: 'unset',
                }}
                >

                <div className={`joystick-outer ${this.state.outerPressed? "joystick-active": ""} ${this.props.className}`}
                    onMouseDown={this.onOuterDown}
                    onTouchStart={this.onOuterTouch}
                    ref={this.outerRef}
                    style={{
                        cursor: this.state.outerPressed? 'grabbing': 'grab'
                    }}>
                    <div className="joystick-inner"
                        ref={this.innerRef}
                        style={{
                            transform: this.state.innerTransform
                        }}
                    >
                    </div>
                </div>

            </div>
        );
    }
}