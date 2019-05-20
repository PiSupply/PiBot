import './Button.css';

import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoffee } from '@fortawesome/free-solid-svg-icons'


async function requestAnimationFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve);
  })
}

const MOBILE = ('ontouchstart' in window );

export default class Button extends Component {
  state = {animationName: ''};

  setStateAsync(state) {
    return new Promise((resolve) => {
      this.setState(state, resolve)
    });
  }

  onClick = (e) => {
    console.log('onClick');
    this.onTouchStart(e);
  }

  onTouchStart = async (e) => {
    console.log('onTouchStart');
    this.props.onClick(e);
    
    await this.setStateAsync({animationName: ''});
    await requestAnimationFrame();
    await requestAnimationFrame();
    await this.setStateAsync({animationName: 'animated'});
  }

  onTouchEnd = (e) => {
    console.log('onTouchEnd');
    if(this.props.embed)
      e.preventDefault();
  }

  render() {
    let onTouchStart, onTouchEnd, onClick;
    
    if(!this.props.canTouch) {
      [onTouchStart, onTouchEnd] = [this.onTouchStart, this.onTouchEnd];
    }
    if(this.props.canTouch || !MOBILE)
      onClick = this.onClick;

    return (
      <div className={this.props.embed? "": "inline-div"}
          id={this.props.id}
          style={ {...this.props.style} } >
        <div className="flex-div">
            <button 
              className={`flex-a flex-animated ${this.props.disabled? "toolButton-disabled": "" }`}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onClick={onClick}
              style={ {animationName: this.state.animationName, ...this.props.buttonStyle} }>
                <FontAwesomeIcon icon={this.props.icon || faCoffee} />
            </button>
        </div>
      </div>
    );
  }
}

