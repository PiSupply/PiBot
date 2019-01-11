#!/bin/bash
pkexec apt-get install lirc liblircclient-dev libboost-python-dev
git clone git://git.drogon.net/wiringPi
cd wiringPi
git pull origin
./build
cd /usr/lib/arm-linux-gnueabihf/
sudo mv libboost_python.so libboost_python2.so
sudo ln -s  libboost_python-py35.so libboost_python.so
cd
cd pibot/lib
python3 setup.py build
sudo python3 setup.py install