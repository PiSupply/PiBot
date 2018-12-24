var ws = null;
var joystick = null;
var reconnectTimeout = 0;
const RECONNECT_TIMEOUT = 1000, RESIZE_TIMEOUT = 100;
const DW = 21, DH = 16;
const WEBRTC = true;
const MAXW = 1638, MAXH = 1248, MINW = 48, MINH = 36;
var FIT_MODE = 'fill'; //'fit_height', 'fit_both', 'fit_width';
var DR = 1;
const DRs={quality_low: 0.3, quality_med: 0.5, quality_hi: 1};


/* Prevent the dropup form from closing on click. */
$(document).on('click', '#settings-button-dropdown .dropdown-menu', function (e) {
  e.stopPropagation();
});
webrtc = $('#myVideo')[0];
webrtc.onplaying =  () => {
	toggleLoading(false);
	resizeVideo();
// 	displayStatus();
	videoSetTransform(0,0);
}					

function connectJoystick() {
	try {
		console.log('connecting joystick...');
		ws = new WebSocket(`wss://${window.location.hostname}:8766`);
	} catch(e) {
		console.log('connecting joystick: error', e);
		if(!reconnectTimeout)
			reconnectTimeout = setTimeout(connectJoystick, RECONNECT_TIMEOUT);
		return;
	}

	reconnectTimeout = 0;	
	ws.onopen = () => {
		console.log('joystick connected!');
		ws.send(JSON.stringify({cmd: 'hello'}));

		if(joystick)
			return;

		joystick = nipplejs.create({
			zone: document.getElementById('joystick'),
			mode: 'static',
			position: {left: '50%', top: '50%'},
			color: 'black'
		});
		joystick.on('start end', function(evt, data) {
			console.log(evt.type, data);
			ws.send(JSON.stringify({
				cmd: evt.type
			}))
		}).on('move', function(evt, data) {
			console.log(data.angle.degree, data.force);
			ws.send(JSON.stringify({
				cmd: 'move',
				degree: data.angle.degree,
				force: data.force / 4.0
			}))
		})
		
		joystick = nipplejs.create({
			zone: document.getElementById('joystick2'),
			mode: 'static',
			position: {left: '50%', top: '50%'},
			color: 'black'
		});
		joystick.on('start end', function(evt, data) {
			console.log(evt.type, data);
			ws.send(JSON.stringify({
				cmd: evt.type+'2'
			}))
		}).on('move', function(evt, data) {
			console.log(data.angle.degree, data.force);
			ws.send(JSON.stringify({
				cmd: 'move2',
				degree: data.angle.degree,
				force: data.force / 4.0
			}))
		})


	}
	ws.onmessage = (msg) => {
		console.log(msg);
	}
	ws.onerror = (err) => {
		console.log(err);
	}
	ws.onclose = () => {
		if(joystick) {
			joystick.destroy();
			joystick = null;
		}
		console.log('joystick disconnected');
		if(!reconnectTimeout)
			reconnectTimeout = setTimeout(connectJoystick, RECONNECT_TIMEOUT);
	}
}
if(WEBRTC)
	connectJoystick();

var streaming;

function showMessage(msg, cb) {
	$('#modalMessage').text(msg);
	$('#exampleModal').modal().on('hidden.bs.modal', cb);
}

function toggleFS() {
	fullscreen(!isFullscreen());
}

function toggleMic() {
	let e = document.getElementById('iMic');
	let b = e.classList.toggle('fa-microphone-alt');
	e.classList.toggle('fa-microphone-alt-slash');

	if(b)
		streaming.unmuteAudio();
	else
		streaming.muteAudio();
}

function toggleSettings() {
	$('#exampleModal').modal();
}

function toggleLoading(isLoading) {
	let e = document.getElementById('loadingAnim');
	if(isLoading)
		e.classList.remove('animationload-after')
	else
		e.classList.add('animationload-after')
}

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
function onFullscreen(event) {
	let fs = isFullscreen();
	let e = document.getElementById('fullscreen-button');
	e.classList.toggle('fa-expand', !fs);
// 	e.classList.toggle('fa-compress', fs);
}
document.addEventListener("webkitfullscreenchange", onFullscreen);
document.addEventListener("mozfullscreenchange", onFullscreen);

function settingsChanged(sel) {
	let v = sel.selectedOptions[0].attributes['value'].textContent;
	if(sel.id == 'fitSelect') {
		FIT_MODE = v;
		resizeVideo();
	} else if(sel.id == 'qualitySelect') {
		DR = DRs[v];
		resizeVideo();
	} else {
		console.error('unknown element', sel);
	}	
	videoSetTransform(0,0);
}

var statusInterval, decoded=0;
function displayStatus() {
	if(statusInterval)
		return;
	statusInterval = setInterval(() => {
		let bs = document.getElementById('videoInfoSpan'), 
			rs = document.getElementById('videoExtraSpan');
		let b = parseInt(streaming.getBitrate()),
			v = document.getElementById('myVideo'), 
			w = v.videoWidth, 
			h = v.videoHeight;
		if(Janus.webRTCAdapter.browserDetails.browser == 'safari')
			b = Math.round(b / 1000);
		bs.textContent = `${w}x${h} @ ${b} kb/s`;
		if(v.webkitDecodedFrameCount && v.webkitDroppedFrameCount) {
			rs.textContent = `FPS: ${v.webkitDecodedFrameCount-decoded}. Dropped: ${v.webkitDroppedFrameCount}`;
			decoded = v.webkitDecodedFrameCount;
		} else if(v.mozPaintedFrames) {
			rs.textContent = `FPS: ${v.mozPaintedFrames-decoded}.`;
			decoded = v.mozPaintedFrames;
		}
	}, 1000);
}

function resizeVideo() {
	let main = webrtc.parentElement;
    let w = document.documentElement.clientWidth*DR;
    let h = document.documentElement.clientHeight*DR;
    let newW, newH;
    console.log(`${w}x${h}`);
    
    let W, H;

    // fit height, crop width
    H = Math.round(h/DH/2)*DH*2; W = H*DW/DH;
    dh = Math.abs(h-H); dw = Math.abs(w-W);
	console.log(`fit height: ${W}x${H} ${dw}x${dh} ${W/H}`)    
	dw1 = dw; dh1 = dh; W1 = W; H1 = H;

//     // fit width, crop height
    W = Math.round(w/DW/2)*DW*2; H = W*DH/DW;    
    dh = Math.abs(h-H); dw = Math.abs(w-W);
    console.log(`fit width: ${W}x${H} ${dw}x${dh} ${W/H}`)
    dw2 = dw; dh2 = dh; W2 = W; H2 = H;

    switch(FIT_MODE) {
    	case 'fit_width':
    		webrtc.classList.toggle('fit_width', true);
    		webrtc.classList.toggle('fit_height', false);
    		W=W2; H=H2;
    		break;
    	case 'fit_height':
    		webrtc.classList.toggle('fit_width', false);
    		webrtc.classList.toggle('fit_height', true);
    		W=W1; H=H1;
    		break;
    	case 'fit_both':
    		webrtc.classList.toggle('fit_width', true);
    		webrtc.classList.toggle('fit_height', true);
    		if(w/h > DW/DH) {
    			// fit height
    			W = W1; H = H1;
    		} else {
    			// fit width
    			W = W2; H = H2;
    		}
    		break;
    	case 'fill':
    		if(w/h < DW/DH) {
    			webrtc.classList.toggle('fit_width', false);
    			webrtc.classList.toggle('fit_height', true);
    			W=W1; H=H1;
    		} else {
    			webrtc.classList.toggle('fit_width', true);
    			webrtc.classList.toggle('fit_height', false);
    			W=W2; H=H2;
    		}
    		break;
    }
        
    console.log(`best fit: ${W}x${H}`);    
    if(W >= MAXW || H >= MAXH) {
    	W = MAXW; H = MAXH;
    } else if(W <= MINW || H <= MINH) {
    	W = MINW; H = MINH;
    }
    newW = W, newH = H;

	if(ws)
		ws.send(JSON.stringify({cmd: 'resolution', width: newW, height: newH}));
	videoSetTransform(0,0);
}

var resizeTm;
window.onresize = (e) => {
	if(resizeTm) {
    	clearTimeout(resizeTm);
    }
    resizeTm = setTimeout(() => {
    	resizeVideo();
    	resizeTm = null;
    }, RESIZE_TIMEOUT);
};


const SERVER = server = "//" + window.location.hostname + "/janus",
	  STREAM_ID = 1,
	  opaqueId = "streamingtest-"+Janus.randomString(12);

if(WEBRTC)
Janus.init({debug: "warn", callback: function() {
	console.log('Janus inited');

	// Make sure the browser supports WebRTC
	if(!Janus.isWebrtcSupported()) {
		showMessage("No WebRTC support... ");
		return;
	}

	var haveAudio = false;
	// Create session
	janus = new Janus({
		server: SERVER,
		success: function(pluginHandle) {
			console.log('Janus connected');

			janus.attach({
				plugin: "janus.plugin.streaming",
				opaqueId: opaqueId,
				success: function(pluginHandle) {
					console.log('Janus plugin attached');
										

					navigator.mediaDevices.enumerateDevices().then(function(devices) {
						for(let d of devices) {
							if(d.kind == 'audioinput')
								haveAudio = true;
						}
					});
					streaming = pluginHandle;
					pluginHandle.send({
						message: { request: "list" }, 
						success: function(result) {
							if(!result.list || result.list[0].id != STREAM_ID) {
								showMessage(error, () => window.location.reload());
							}
// 							$('#myVideo')[0].onplaying =  () => toggleLoading(false);
							pluginHandle.send({
								message: {
									request: 'watch',
									id: STREAM_ID
								}
							});
						}
					});
				},
				onmessage: function(msg, jsep) {
					Janus.debug(" ::: Got a message :::");
					Janus.debug(msg);
					let result = msg.result;
					if(result && result.status) {
						if(result.status == 'started') {
							console.log('Streaming started!');
							if($('#myVideo')[0].played.length) {
								toggleLoading(false);
								displayStatus();
							}							
						}
					} else if(msg.error) {
						showMessage(msg["error"]);
						return;
					}
					if(jsep) {
						Janus.debug("Handling SDP as well...");
						Janus.debug(jsep);

						// Offer from the plugin, let's answer
						streaming.createAnswer({
							jsep: jsep,
							media: { audioSend: haveAudio, videoSend: false },
							success: function(jsep) {
								Janus.debug("Got SDP!");
								Janus.debug(jsep);
								streaming.send({
									message: { request: 'start' }, 
									jsep: jsep
								});
// 								$('#watch').html("Stop").removeAttr('disabled').click(stopStream);
							},
							error: function(error) {
								console.error("WebRTC error:", error);
								showMessage("WebRTC error... " + error);
							}
						});
					}
				},
				onremotestream: function(stream) {
					Janus.debug(" ::: Got a remote stream :::");
					Janus.debug(stream);
					console.log('Janus remote stream received');
					let vid = $('#myVideo')[0];
					Janus.attachMediaStream(vid, stream);
					vid.muted = false;
				},
				oncleanup: function() {
					Janus.log(" ::: Got a cleanup notification :::");
				}
			});
		},
		error: function(error) {
			Janus.error(error);
			showMessage(error, () => window.location.reload());
		},
		destroyed: function() {
			window.location.reload();
		}
	});
}});


var X=0, Y=0, tX=0, tY=0;
function videoMouseDown(el, ev) {
// 	console.log(el, ev);
	let x = ev.touches? ev.touches[0].pageX: ev.pageX,
		y = ev.touches? ev.touches[0].pageY: ev.pageY;
	X = x - tX;
	Y = y - tY;
}

function videoMouseMove(el, ev) {	
	if(!((ev.type == 'mousemove' && ev.buttons == 1) || ev.type == 'touchmove'))
		return;

	ev.preventDefault();

	let x = ev.touches? ev.touches[0].pageX: ev.pageX,
		y = ev.touches? ev.touches[0].pageY: ev.pageY,
		dx = x - X, dy = y - Y;
	console.debug(el, dx);	

	rect = webrtc.getBoundingClientRect(),
		W = document.documentElement.clientWidth,
		H = document.documentElement.clientHeight;

	maxX = (webrtc.getBoundingClientRect().width-W)/2;
	maxY = (webrtc.getBoundingClientRect().height-H)/2;
	if(maxX >= 0) {
		if(dx > 0 && dx > maxX)
			dx = maxX;		
		else if(dx < 0 && dx < -maxX)
			dx = -maxX;
	}
	if(maxY >= 0) {
		if(dy > 0 && dy > maxY)
			dy = maxY;
		else if(dy < 0 && dy < -maxY)
			dy = -maxY;
	}
	if(maxX >= 0 && maxY >= 0)
		videoSetTransform(dx, dy);	
}

SCALE = 1.0;

function videoSetTransform(dx, dy, scale) {
	tr = `translateX(${dx}px) `;
	if(webrtc.classList.contains('fit_width'))
		tr += `translateY( calc( ${dy}px - 50% ) )`;
	else
		tr += `translateY(${dy}px)`
	if(!scale)
		scale = SCALE;
	tr += ` scale(${scale})`;
	webrtc.style.transform = tr;
	tX = dx; tY = dy;
	
	document.getElementById('minus-button-div').classList.toggle('toolButton-disabled', !(SCALE > 1.0));
}

function zoomIn() {
	SCALE += 0.1;
	videoSetTransform(0,0);
}

function zoomOut() {
	if(SCALE > 1.0)
		SCALE -= 0.1;	
	videoSetTransform(0,0);
}

const isSafari = /iPhone|iPad|iPod/i.test(navigator.userAgent);

function createBtn(id, btn_id, cls, onClick, onTouchStart) {
    tpl = document.getElementById('templateBtnDiv');    
    clon = tpl.content.cloneNode(true);
    btn = clon.getElementById('templateBtn');
    btn.id = btn_id;
    if(Array.isArray(cls)) {
    	for(c of cls) {
    		btn.classList.add(c);
    	}
    } else
    	btn.classList.add(cls);
//     btn.parentElement.setAttribute('onclick', onClick);
	btn.parentElement.my_onclick = onClick;
// 	if(isSafari) {
// 		btn.parentElement.onclick = null;
// 		btn.parentElement.my_onclick = null;
//     	btn.parentElement.ontouchstart = onClick;
// 	}
    document.getElementById(id).appendChild(clon);
    return clon;
}

function touchStart(el, ev) {
    if(isSafari) {
        ev.preventDefault();
        buttonClick(el, ev);
    }
}

function buttonClick(el, ev) {
    ev.preventDefault();
    let p = el, btn = el.firstElementChild;
    if(el.my_onclick)
    	el.my_onclick(ev);

    p.style.animationName = '';
    window.requestAnimationFrame(function(t1) {
        window.requestAnimationFrame(function(t2) {
            p.style.animationName = 'animated';
        });
    });    
}

function onClick(event) {
	console.log(arguments);
	let btn = this.firstElementChild;
	btn.classList.toggle('fa-microphone-alt-slash');
}
createBtn('mic-button-div', 'mic-button', 'fa-microphone', onClick);
createBtn('plus-button-div', 'plus-button', 'fa-plus', zoomIn);
createBtn('minus-button-div', 'minus-button', 'fa-minus', zoomOut);
createBtn('fullscreen-button-div', 'fullscreen-button', ['fa-expand', 'fa-compress'], toggleFS);
createBtn('settings-button-div', 'settings-button', 'fa-cog', () => {
	if(isSafari)
		$('#settings-button-div').dropdown('toggle');
});
