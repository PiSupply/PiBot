import './Settings.css'
import React, { Component } from 'react';
import {Dropdown, Form} from 'react-bootstrap';
import Button from './Button'
import { faCog } from '@fortawesome/free-solid-svg-icons'


export default class SettingsDropdown extends Component {
    /** @type {React.RefObject<HTMLDivElement>} */ dd = React.createRef();
  state = {show: false, fit_mode: 'fill', quality: 'quality_hi'}

  
  settingsChanged = (e) => {
    const {name, value} = e.target;
    console.log('[Settings] changed', name, value, this.state);
    this.props.onChange(name, value);
    this.setState({[name]: value});
  }

  render() {
    return ( 
      <Dropdown drop="up" style={{
          position: 'fixed',
          top: 'calc(90% - 3rem)',
          left: '5%'
      }}>
          <Dropdown.Toggle as={Button} icon={faCog} embed></Dropdown.Toggle>
  
          <Dropdown.Menu>
            <Form className="px-1 py-4">
              {/* <Form.Row> */}
                <Form.Group>
                    <Form.Label>Fit mode</Form.Label>
                    <Form.Control as="select" 
                      name="fit_mode"
                      onChange={this.settingsChanged}
                      value={this.state.fit_mode}>
                        <option value="fill">Fill</option>
                        <option value="fit_both">Fit</option>
                        <option value="fit_width">Fit Width</option>
                        <option value="fit_height">Fit Height</option>
                      </Form.Control>
                </Form.Group>
              {/* </Form.Row> */}
              {/* <Form.Row> */}
                <Form.Group>
                    <Form.Label>Quality</Form.Label>
                    <Form.Control as="select"
                      name="quality"
                      value={this.state.quality}
                      onChange={this.settingsChanged}>
                        <option value="quality_low">Low</option>
                        <option value="quality_med">Medium</option>
                        <option value="quality_hi">High</option>
                    </Form.Control>
                </Form.Group>
              {/* </Form.Row> */}
            </Form>
          </Dropdown.Menu>
        </Dropdown>);
  }
}
