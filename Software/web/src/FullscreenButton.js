import React, { Component } from 'react';
import Button from './Button'
import { faCompress, faExpand } from '@fortawesome/free-solid-svg-icons'

function fullscreen(fs) {
  if(fs) {
    let e = document.documentElement;
    (e.mozRequestFullScreen && e.mozRequestFullScreen()) ||
    (e.webkitRequestFullScreen && e.webkitRequestFullScreen());
  } else {
      (document.webkitCancelFullScreen && document.webkitCancelFullScreen()) ||
      (document.mozCancelFullScreen && document.mozCancelFullScreen());
  }
}
function isFullscreen() {
  return !!(document.webkitFullscreenElement || document.mozFullScreenElement);
}

export default class FullscreenButton extends Component {
  state = {icon: faExpand};

  constructor() {
    super();
    document.addEventListener("webkitfullscreenchange", this.onFullscreen);
    document.addEventListener("mozfullscreenchange", this.onFullscreen);
  }

  onFullscreen = () => {
    console.log('fullscreen');
    let fs = isFullscreen();
    this.setState({icon: fs? faCompress: faExpand});
  }

  buttonClick = (e) => {
    console.log('[Fullscreen] button clicked');
    fullscreen(!isFullscreen());
  }

  render() {
    return ( <Button canTouch
                style={{
                  top: '10%',
                  left: '5%'
                }}
                icon={this.state.icon}
                onClick={this.buttonClick} 
                id="fullscreen-button-div" > 
              </Button> );
  }
}
