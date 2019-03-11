# Web client for PiBot

## How to start the web server
---

1. Install nginx
1. Generate SSL certs if needed

1. Generate web files from the source:
    ```bash
    $ npm install
    $ npm run build
    ```
    The resulting files will be in build/ subdirectory.

1. Create nginx site, enable it and reload :
    just run script with 2 parameters. First path to ssl.crt and second path to ssl.key
    For example:
    ```bush 
    # ./nginx.sh ssl/ssl.crt ssl.ssl.key
    ```
    or manually:
     ```bash 
    # m4 -D SSL_CERT=<ssl_cert> -D SSL_KEY=<ssl_key> -D PWD=<this dir>/build etc/nginx/sites-available/robot > /etc/nginx/sites-available/robot
    # cp etc/nginx/sites-available/http-redirect /etc/nginx/sites-available/http-redirect
    # ln -s /etc/nginx/sites-available/robot /etc/nginx/sites-enabled/robot
    # ln -s /etc/nginx/sites-available/http-redirect /etc/nginx/sites-enabled/http-redirect
    # service nginx reload
    ```
    then open config:
    ```bash
    # nano /etc/nginx/sites-available/robot
    ```
    and specify the path to the certificate and key, as well as to the build folder compiled earlier. And run:
    ```bash
    # service nginx reload
    ```
    
    Make sure no other sites are enabled on port 80. Nginx has a "default" site enabled upon fresh installation, so you may want to disable it:
     ```bash    
    # rm /etc/nginx/sites-enabled/default
    ```
    `http-redirect` is a dummy site which simply redirects clients from http://HOST to https://HOST. It is not required for proper functioning of the main site (`robot`).

