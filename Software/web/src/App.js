import 'bootstrap/dist/css/bootstrap.css';
import './App.css';

import React, { Component } from 'react';
import ConnectWizard from './ConnectWizard'
import DriveWindow from './DriveWindow'


export default class App extends Component {
    state = {
        showDrive: false
    }

    onDrive = () => {
        this.setState({showDrive: true});
    }

    render() {
        if(this.state.showDrive) {
            document.getElementsByTagName('html')[0].classList.toggle('fullscreen-html', true);
            document.getElementById('root').classList.toggle('fullscreen', true);            
            document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
            return <DriveWindow />;
        } else {
            return <ConnectWizard onDrive={this.onDrive} />
        }
    }
}