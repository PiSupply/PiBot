import React, { Component } from 'react';
import Button from './Button'
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';


class ZoomButton extends Component {
    onClick = (e) => {
      if(this.props.disabled)
        return;
      this.props.onClick(e);
    }

    render() {
      return ( <Button disabled={this.props.disabled}
                  style={this.props.style}
                  buttonStyle={{
                    width: '2rem',
                    height: '2rem',
                    fontSize: '1rem'
                  }}
                  icon={this.props.icon}
                  onClick={this.onClick} 
                  id={this.props.id}> 
                </Button> );
    }
  }

class PlusButton extends ZoomButton {
    render() {
        return ( <ZoomButton disabled={this.props.disabled}
                    style={{
                      top: 'calc(10% - .5rem)',
                      left: 'calc(95% - 3rem)'
                    }}
                    icon={faPlus}
                    onClick={this.props.onClick} 
                    id="plus-button-div"> 
                  </ZoomButton> );
      }
}

class MinusButton extends Component {
    render() {
        return ( <ZoomButton disabled={this.props.disabled}
                    style={{
                      top: 'calc(10% + 2rem)',
                      left: 'calc(95% - 3rem)'
                    }}
                    icon={faMinus}
                    onClick={this.props.onClick} 
                    id="minus-button-div"> 
                  </ZoomButton> );
      }
}

export { PlusButton, MinusButton };
