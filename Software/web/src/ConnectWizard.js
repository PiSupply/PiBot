import './ConnectWizard.css';

import React, { Component } from 'react';
import { Collapse, Fade, Button } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faLockOpen, faSignal, faUnlock, faWifi } from '@fortawesome/free-solid-svg-icons'
import cn from 'classnames';

const MOBILE = ('ontouchstart' in window );


class ListItem extends Component {
  static defaultProps = {
    bars: "5"
  }
  state = {
    active: false
  }
  a = React.createRef();

  onClick = (e) => {
    this.props.onClick && this.props.onClick(this, e);
  }
  
  render() {
    return (
      <a href="#" 
        ref={this.a}
        className={cn("list-group-item", "list-group-item-action", 
                      {"active": this.state.active})}
        onClick={this.props.onClick && this.props.onClick.bind(this, this)}>
          <div className="d-flex my-bg-inherit">
            <div className="p-2 flex-grow-1">{this.props.text}</div>
            <div className="p-2"><FontAwesomeIcon icon={this.props.locked? faLock: faUnlock } /></div>
            <div className="p-2 my-bg-inherit">
              <FontAwesomeIcon icon={faSignal} />
              <div className={"mystencil my-bg-inherit mystencil-"+this.props.bars} />
            </div>
          </div>
      </a>
    );
  }

  activate(b) {
    this.setState({active: b});
  }

  scroll() {
    this.a.current.scrollIntoView();
  }

  get value() {
    return this.props.text;
  }

  get locked() {
    return this.props.locked;
  }
}

class List extends Component {
  state = {
    compact: false,
    items: []
  }
  selected = null;

  async fetchNetworks() {
    let r = await fetch('https://192.168.42.1/networks');  
    let d = await r.body.getReader().read();
    let v = new TextDecoder("utf-8").decode(d.value);
    let networks = JSON.parse(v), items=new Map, items_list = [];
    for(let n of networks) {
        if(items.has(n.ssid) || !n.ssid)
            continue;
        items.set(n.ssid, {locked: n.security!='none', bars: Math.ceil(n.strength/20)});
    }
    for(let kv of items) {
        let [k, v] = kv;
        items_list.push({text: k, ...v});
    }
    this.setState({items: items_list});
  }  

  componentDidMount() {
    this.fetchNetworks();
  }

  onItemClick = (el, e) => {
    if(this.state.compact)
      return;

    console.log(e.currentTarget, el);

    el.activate(true);
    this.selected = el;
    this.setState({compact: true}, () => {
      this.props.onSelect();
      // el.scroll();
    })
  }

  scroll() {
    this.selected.scroll();
  }

  reset() {
    this.setState({compact: false});
    this.selected.activate(false);
  }

  render() {
    return (
      <div className={cn("list-group", "rounded", "border", "mylistgroup",
                      )}>
        {this.state.items.map((i) => <ListItem text={i.text} locked={i.locked} bars={i.bars} key={i.text} onClick={this.onItemClick}/>)}
      </div>
    )
  }

  get selectedName() {
    return this.selected.value;
  }

  get selectedNeedsPassword() {
    return this.selected.locked;
  }
}

class WifiWizard extends Component {
  static defaultState = {
    valid: false,
    showPasswordField: false,
    compact: false,
    headerText: "Choose network",
    password: ""
  }
  state = WifiWizard.defaultState;
  static defaultProps = {
    className: ""
  }
  list = React.createRef();
  passwordField = React.createRef();
  passwordDiv = React.createRef();
  wrapper = React.createRef();

  onSelect = () => {
    this.setState({
      showPasswordField: this.list.current.selectedNeedsPassword,
      valid: !this.list.current.selectedNeedsPassword,
      compact: true,
      headerText: "Enter password"}, 
      () => {
        setTimeout(() => {
          this.passwordField.current.select();
          this.list.current.scroll();
        }, 0);
        
        // this.passwordDiv.current.scrollIntoView(true);
    });
  }

  onBack = () => {
    if(this.state.compact) {
      this.setState(WifiWizard.defaultState);
      this.list.current.reset();
    } else {
      this.props.onBack();
    }
  }

  onPasswordChange = (e) => {
    console.log(e.target.value.length);
    this.setState({
      valid: e.target.value.length >= 8,
      password: e.target.value
    });
  }

  onSubimt = (e) => {
    e.preventDefault();
    if(this.state.valid)
      this.props.onSubmit(this.list.current.selectedName, this.state.password);
  }

  render() {
    return (
      <div className={cn(
        "mylist d-flex flex-column border rounded shadow mx-auto  p-3 mb-5 bg-white", 
        this.props.className,
        {"mylist-compact": this.state.compact})}>
        <nav className="navbar navbar-dark bg-secondary flex-shrink-0">
          <span className="navbar-brand" style={{width: '100%'}}>
            <div className="d-flex">
              <div className="p-2 flex-grow-1 bd-highlight">
                {this.state.headerText}
              </div>
              <div className="p-2 bd-highlight">
                <FontAwesomeIcon icon={faWifi} />
              </div>
            </div>
          </span>
        </nav>
        <List 
          onSelect={this.onSelect} 
          className="flex-shrink-1"
          ref={this.list}/>
        <Collapse in={this.state.showPasswordField}>
          <form ref={this.passwordDiv} className={cn("flex-shrink-0", "form-group", "my-1", "fade", {
            // "show": this.state.showPasswordField,
            // "mypasswordfield": !this.state.showPasswordField
          })} onSubmit={this.onSubimt}>
            <input type="password" 
                  className="form-control" 
                  placeholder="Password"
                  onChange={this.onPasswordChange}
                  value={this.state.password}
                  ref={this.passwordField} />
            {/* <input type="submit" style={{visibility: 'hidden'}}/> */}
          </form>
        </Collapse>
        <div className="d-flex flex-shrink-0 justify-content-end my-3">
          <Button type="submit" variant="secondary" className="mx-2" onClick={this.onBack}>
            Back
          </Button>
          <Button type="submit" variant={this.state.compact? "primary": "secondary"} onClick={this.onSubimt} disabled={this.state.valid? false: true}>
            Connect
          </Button>
        </div>
      </div>
    )
  }
}

class Success extends Component {
  render() {
    return (
      <div className={cn(
        "mylist d-flex flex-column border rounded shadow mx-auto  p-3 mb-5 bg-white mylist-compact", 
        this.props.className)}>
        <div className="alert alert-success" role="alert">
          <h4 className="alert-heading">Done</h4>
          <p>Raspberry Pi is trying to connect to the chosen WiFi network now.</p>
          <hr />
          <p className="mb-0">If it fails to do so, this page will be available again soon.</p>
        </div>
      </div>
    )
  }
}

class Start extends Component {
  render() {
    return(
      <div className={cn(
        "mylist border rounded shadow mx-auto  p-3 mb-5 bg-white mylist-compact", 
        this.props.className)}>
        <div className="jumbotron">
          <h1 className="display-5">Pi Robot</h1>
          <p className="lead">Chooose what to do now:</p>
          <hr className="my-3" />
          <p>Try to connect to a WiFi network.</p>
          <Button variant="primary" size="lg" onClick={this.props.onSubmit}>Connect!</Button>
          <hr className="my-3" />
          <p>Launch the driving interface.</p>
          <Button variant="primary" size="lg" onClick={this.props.onDrive}>Drive!</Button>
        </div>
      </div>
    )
  }
}

export default class ConnectWizard extends Component {
  state = {
    successVisible: false,
    successCollapsed: false,
    wifiWizardVisible: false,
    wifiWizardCollapsed: false,
    startVisible: true,
    startCollapsed: false,
    next: 'wifiwizard'
  }

  onWifiSubmit = (name, passphrase) => {
    console.log(name, passphrase);
    let d = JSON.stringify({name, passphrase});
    fetch('https://192.168.42.1/connect', {method: "POST", body: d}).then(() => {
        this.setState({
            wifiWizardCollapsed: true
          });
    });
    
  }

  onWifiBack = () => {
    this.setState({
      wifiWizardCollapsed: true,
      next: 'start'
    });
  }

  onWifiWizardHidden = (e) => {
    console.log(e);
    if(this.state.next == 'wifiwizard')
      this.setState({
        wifiWizardVisible: false,
        successVisible: true,
        next: 'success'
      });
    else {
      this.setState({
        wifiWizardVisible: false,
        startVisible: true,
        startCollapsed: false,
        next: 'wifiwizard'
      });
    }
  }

  onStartSubmit = (e) => {
    this.setState({
      startCollapsed: true
    })
  }

  onStartHidden = (e) => {
    this.setState({
      startVisible: false,
      wifiWizardCollapsed: false,
      wifiWizardVisible: true
    });
  }

  render() {
    return (
      <>
      {this.state.startVisible && 
      <Fade appear in={!this.state.startCollapsed} onExited={this.onStartHidden}>
        <Start onSubmit={this.onStartSubmit} onDrive={this.props.onDrive} />
      </Fade> }
      {this.state.successVisible && 
      <Fade appear in={!this.state.successCollapsed}>
        <Success />
      </Fade> }
      { this.state.wifiWizardVisible &&
      <Fade appear in={!this.state.wifiWizardCollapsed} onExited={this.onWifiWizardHidden}>
        <WifiWizard onSubmit={this.onWifiSubmit} onBack={this.onWifiBack} />
      </Fade> }
      </>
    )
  }
}
