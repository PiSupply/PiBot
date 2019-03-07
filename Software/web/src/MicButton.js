import React, { Component } from 'react';
import Button from './Button'
import { faMicrophoneAlt, faMicrophoneAltSlash } from '@fortawesome/free-solid-svg-icons';


export default class MicButton extends Component {
  state = {icon: faMicrophoneAlt, muted: false};

  buttonClick = (e) => {
    console.log('[Mic] button clicked');      
    this.setState({
        icon: this.state.muted? faMicrophoneAlt: faMicrophoneAltSlash, 
        muted: !this.state.muted
      }, () => {
        this.props.onMute(this.state.muted);
      });
  }

  render() {
    return ( <Button id="mic-button-div"
                style={{
                  top: 'calc(90% - 3rem)',
                  left: 'calc(95% - 3rem)'
                }}
                icon={this.state.icon}
                onClick={this.buttonClick}> 
              </Button> );
  }
}

