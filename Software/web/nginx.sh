#!/bin/bash
m4 -D SSL_CERT=$1 -D SSL_KEY=$2 -D PWD=/build etc/nginx/sites-available/robot > /etc/nginx/sites-available/robot
cp etc/nginx/sites-available/http-redirect /etc/nginx/sites-available/http-redirect
ln -s /etc/nginx/sites-available/robot /etc/nginx/sites-enabled/robot
ln -s /etc/nginx/sites-available/http-redirect /etc/nginx/sites-enabled/http-redirect
service nginx reload