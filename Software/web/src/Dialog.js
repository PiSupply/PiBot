import './Dialog.css'
import React, { Component } from 'react';
import {Modal, Button} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';


export class RetryReload extends Component {
    state = {
        show: false, 
        message: {
            header: '',
            text: ''
        }
    };

    async show(message) {
        return new Promise((resolve) => {
            this.setState({show: true, message: message}, () => {
                this.onClose = resolve;
            });
        })
    }

    handleClose = (e) => {
        let name = e && e.target.name;
        this.setState({ show: false }, () => {
            if(name && this.onClose)
                this.onClose(name);
        });
    }

    render() {
        return (
            <Modal show={this.state.show} onHide={this.handleClose}  dialogClassName="dialog-div">
                <Modal.Header closeButton>
                    <FontAwesomeIcon icon={this.props.icon || faExclamationTriangle} className="dialog-icon" />
                    <Modal.Title>{this.state.message.header}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{this.state.message.text}</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={this.handleClose} name="retry">
                        Retry
                    </Button>
                    <Button variant="primary" onClick={this.handleClose} name="reload">
                        Reload
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
