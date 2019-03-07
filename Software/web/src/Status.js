import './Status.css'
import React, { Component } from 'react';

export default class Status extends Component {
    render() {
        return (
            <div id="statusDiv">            
                <span id="videoInfoSpan">{this.props.info}</span>
                <br />
                <span id="videoExtraSpan">{this.props.extra}</span>
            </div>
        );
    }
}
