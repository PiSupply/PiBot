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
        
       # m4 -D SSL_CERT=<ssl_cert> -D SSL_KEY=<ssl_key> -D PWD=<this dir>/build etc/nginx/sites-available/robot/etc/nginx/sites-available/robot
        # cp etc/nginx/sites-available/http-redirect /etc/nginx/sites-available/http-redirect
        # ln -s /etc/nginx/sites-available/robot /etc/nginx/sites-enabled/robot
        # ln -s /etc/nginx/sites-available/http-redirect /etc/nginx/sites-enabled/http-redirect
        #service nginx reload
    
    Make sure no other sites are enabled on port 80. Nginx has a "default" site enabled upon fresh installation, so you may want to disable it:
        
        rm /etc/nginx/sites-enabled/default

    `http-redirect` is a dummy site which simply redirects clients from http://HOST to https://HOST. It is not required for proper functioning of the main site (`robot`).


