![VirginSuperHub](http://www.v2studios.com/img/projects/1370010668.jpg "VirginSuperHub")

# VirginSuperHub-NOIP-Autoupdater

[![Greenkeeper badge](https://badges.greenkeeper.io/redpandatronicsuk/VirginSuperHub-NOIP-Autoupdater.svg)](https://greenkeeper.io/)
I don't think too many people find this useful, but I decided to share the code non the less, in case somebody finds themselves in the same situation. If you are a Virgin Broadband customer with a Virgin SuperHub, you are using a VPN and want to use a Dynamic DNS service, such as no-ip.com, then this tool might be exactly what you are looking for. *If you happen to have a spare router that supports DDNS, you could also set your SuperHub to **modem only** mode and configure your spare router accordingly*.

If you are not behind a VPN, you should also be able to use the official no-ip.com tool, available [here](https://www.noip.com/download).

If you are behind a VPN though, the no-ip.com too will pick up the IP address for your VPN connection. If your VPN connection does not support *port forwarding*, then you would notbe able to access your hosted services. VirginSuperHub-NOIP-Autoupdater to the rescue! This tool extracts your routers WAN IP from the router's web-interface.

## Usage
### Beginner
Download the appropiate executable for your environment (vshnoip.exe for Windows, vshnoip-mac for Mac or vshnoip-linux for Linux). Also download *config-sample.yaml*, rename it to *config.yaml* and save it to the same directory as the executable. Open *config.yaml* in a text editor and set your correct values. For more information on configuration check below. Then you can execute the file by double-clicking it. It should open up a terminal window and keep on running until you cloes that window.

### Advanced
1. Install NodeJS
2. Checkout the files index.js and package.json and save them in the same diretory
3. Open up a terminal, go to the location where you saved the files from the previous at a run `npm i` to install the NodeJS dependencies.
4. (*Optional*) Make a configuration file, either in JSON, YAML, XML or INI format and save it as config.{json,yml,xml,ini} accordingly.
5. To run it, type `node .`. If there are required configartion values missing from your configuration file (or commandline arguments), it will print out the help screen with info about the correct commandline argument usage.

### Configuration
#### File
You can make a configuration file, either in JSON, YAML, XML or INI format and save it as config.{json,yml,xml,ini} in the same directory as the executable or NodeJS script. For example configuration files look at config-sample.{json,yml,xml,ini}.
#### Commandline arguments
```
--router-ip:         The IP address of the router (default: '192.168.0.1')
--router-password:   The admin password to log into the router (required)
--noip-hostname:     The hostname registered to your account on no-ip.com you want to
                     update the IP for (required)
--noip-username:     Your no-ip.com username (required)
--noip-password:     Your no-ip.com password (required)
-r:                  Retry on error (default: false)
--max-retries:       Number of retries whne there is an error (default: 5)
--retry-delay:       The number of seconds to pause between retries (default: 5)
 --check-frequency:   How frequently (in minutes) to check for WLAN IP changes (default: 5)
```
