#!/bin/bash

HOST=10.13.37.140
VIDEO_RTP_PORT=8004
AUDIO_RTP_PORT=8006
gst-launch-1.0 -vv \
  v4l2src blocksize=400000  device=/dev/video0 ! "video/x-h264,width=1920,height=1080,framerate=30/1,profile=baseline" ! queue leaky=2 ! h264parse ! rtph264pay config-interval=1 pt=96  perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 ! tee name=t ! udpsink host=127.0.0.1 port=$VIDEO_RTP_PORT buffer-size=32768 sync=false async=false \
  	t. ! udpsink host=$HOST port=$VIDEO_RTP_PORT buffer-size=32768 sync=false async=false sync=false async=false \
  alsasrc  device=hw:1,0 ! queue leaky=2 ! audioconvert ! audio/x-raw, rate=48000, channels=2 ! opusenc bitrate=128000 inband-fec=true frame-size=10 ! opusparse ! rtpopuspay pt=111 perfect-rtptime=true min-ptime=10 seqnum-offset=0 timestamp-offset=0 ! udpsink host=127.0.0.1 port=$AUDIO_RTP_PORT sync=false async=false \
  udpsrc port=8200 ! application/x-rtp,media=audio,payload=111,encoding-name=OPUS ! queue leaky=2 ! rtpopusdepay ! opusparse ! opusdec ! alsasink device=hw:1,0

# gst-launch-1.0 \
#   videotestsrc is-live=true do-timestamp=true ! timeoverlay ! clockoverlay  halignment=right ! avenc_h264_omx bitrate=10000000 rtp-payload-size=10 gop-size=4 ! "video/x-h264,width=1920,height=1080,framerate=30/1,profile=baseline" ! h264parse ! rtph264pay config-interval=1 pt=96 ! udpsink host=$HOST port=$VIDEO_RTP_PORT \
#   audiotestsrc is-live=true ! audioconvert ! audio/x-raw, rate=48000, channels=2 ! opusenc bitrate=128000 inband-fec=true frame-size=10 ! opusparse ! rtpopuspay pt=111 ! udpsink host=$HOST port=$AUDIO_RTP_PORT \
#   udpsrc port=8200 ! application/x-rtp,media=audio,payload=111,encoding-name=OPUS ! rtpopusdepay ! opusparse ! opusdec ! alsasink device=hw:1,0
