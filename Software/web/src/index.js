import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import * as serviceWorker from './serviceWorker';
import App from './App';
import ConnectWizard from './ConnectWizard'
import DriveWindow from './DriveWindow'


// document.getElementsByTagName('html')[0].classList.toggle('fullscreen-html', false);
// document.getElementById('root').classList.toggle('fullscreen', false);
// ReactDOM.render(<ConnectWizard />, document.getElementById('root'));

// document.getElementsByTagName('html')[0].classList.toggle('fullscreen-html', true);
// document.getElementById('root').classList.toggle('fullscreen', true);
// ReactDOM.render(<DriveWindow />, document.getElementById('root'));
// document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
