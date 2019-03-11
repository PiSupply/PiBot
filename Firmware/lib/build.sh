#!/bin/bash
pkexec apt-get install WiringPi lirc liblircclient-dev libboost-python-dev
sudo mv /usr/lib/arm-linux-gnueabihf/libboost_python.so /usr/lib/arm-linux-gnueabihf/libboost_python2.so
sudo ln -s  /usr/lib/arm-linux-gnueabihf/libboost_python-py35.so /usr/lib/arm-linux-gnueabihf/libboost_python.so
sudo python3 setup.py install