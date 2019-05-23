#!/bin/bash
openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout /opt/janus/share/janus/certs/device.key -out /opt/janus/share/janus/certs/device.crt -subj /C=UN/ST=unknown/L=unknown/O=unknown/CN=unknown
mkdir ssl
openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout ssl/ssl.key -out ssl/ssl.crt -subj /C=UN/ST=unknown/L=unknown/O=unknown/CN=unknown