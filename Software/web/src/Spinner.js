import './Spinner.css'
import React, { Component } from 'react';


export default class Spinner extends Component {

    render() {
        return (
            <div className={`animationload ${this.props.hidden? 'animationload-after': ''}`} id="loadingAnim">
                <div className="osahanloading"></div>
                <h3 className="loadingMessage">Loading</h3>
            </div>
        );
    }
}
