/**************************************************************************************************
 * MIT License
 * Copyright (c) 2016 RedPandaTronics LTD

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 ***************************************************************************************************
 *
 * Virgin SuperHub NO-IP automatic IP update script
 * ================================================
 * 
 * A simple script to update the IP address of of a host configured for a Virgin SuperHub router.
 * This script is useful in the following scenario: You are behind a VPN, your router is a Virgin
 * SuperHub and you want to automatically update your router's IP on NO-IP. The problem is that
 * the Virgin SuperHub does not provide Dynmic DNS service updates and when you are conecting to
 * the internet through a VPN, the 'automatic ip update software', proveded by NO-IP, detects
 * your VPN IP address, instead of the WLAN IP of the router.
 * 
 * Usage
 * =====
 * 
 * Either overwrite the default values in this file or provide them via commandline arguments:
 * 
 * --router-ip:         The IP address of the router (default: '192.168.0.1')
 * --router-password:   The admin password to log into the router (required)
 * --noip-hostname:     The hostname registered to your account on no-ip.com you want to
 *                      update the IP for (required)
 * --noip-username:     Your no-ip.com username (required)
 * --noip-password:     Your no-ip.com password (required)
 * -r:                  Retry on error (default: false)
 * --max-retries:       Number of retries whne there is an error (default: 5)
 * --retry-delay:       The number of seconds to pause between retries (default: 5)
 * --check-frequency:   How frequently (in minutes) to check for WLAN IP changes (default: 5)
 * 
 * Example
 * =======
 * 
 * node . --router-password MyPa$$435 --noip-hostname myhost.ddns.net \
 *        --noip-username me@mail.com --noip-password password! \
 *        -r --max-retries 10 --retry-delay 3 --check-frequency 1
 * 
 * Config File
 * ===========
 * 
 * Configuration parameters can also be provided in a configuration file, although commandline
 * parameters take higher precedence. The config file can be in either JSON, YAML, XML or INI
 * format, should be named config and should have the appropriate filename extension, e.g.
 * 
 * config.json:
 *   { "router-ip": "192.168.1.1", ... }
 * config.yml (or config.yaml):
 *   router-ip: 192.168.1.1
 *   ....
 * config.ini:
 *   router-ip=192.168.1.1
 *   ....
 * config.xml:
 *   <router-ip>
 *     192.168.1.1
 *   </router-ip>
 *   ...
 * 
 * Configuration files are loaded in the following order: json, yml, yaml, ini, xml. It will only
 * load the first file it encounters in the specified order; you should really have only one
 * configuration file anyways, in whatever format you prefer.
 */

const request = require('request');
const cheerio = require('cheerio');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const ini = require('node-ini');
const argv = require('minimist')(process.argv.slice(2));
var CONFIG_FILE = {};

/**
 * Functions to parse different formats into JSON.
 */
const parseFunctions = {
    json: (filename) => {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    },
    yml: (filename) => {
        return yaml.load(fs.readFileSync(filename, 'utf8'));
    },
    ini: (filename) => {
        return ini.parseSync(filename);
    },
    xml: (filename) => {
        $ = cheerio.load(['<config>',fs.readFileSync(filename, 'utf8'),'</config>'].join(''), {
            normalizeWhitespace: true,
            xmlMode: true
        });
        let out = {};
        $('config').children().each((idx, ch) => {
            console.log('ch', ch.name, ch.children[0].data);
            out[ch.name] = ch.children[0].data;
        });
        return out;
    }
};
parseFunctions.yaml = parseFunctions.yml;

// Check for config file and load:
['json', 'yml', 'yaml', 'ini', 'xml'].some((ext) => {
    let fn = path.join(__dirname, './config.' + ext);
    if (fs.existsSync(fn)) {
        CONFIG_FILE = parseFunctions[ext](fn);
        return true;
    }
});

console.log('Loaded configuration from file:\n', CONFIG_FILE);

// Load parameters, command-line parameters have higher precendence than config file:
const ROUTER_IP = argv['router-ip'] || CONFIG_FILE['router-ip'] || '192.168.0.1';
const ROUTER_PASSWORD = argv['router-password'] || CONFIG_FILE['router-password'];
const NOIP_HOSTNAME = argv['noip-hostname'] || CONFIG_FILE['noip-hostname'];
const NOIP_USERNAME = argv['noip-username'] || CONFIG_FILE['noip-username'];
const NOIP_PASSWORD = argv['noip-password'] || CONFIG_FILE['noip-password'];
const RETRY_ON_ERROR = argv.r || CONFIG_FILE.r || false;
const MAX_RETRIES = argv['max-retries'] || CONFIG_FILE['max-retries'] || 5;
const RETRY_DELAY = argv['retry-delay'] || CONFIG_FILE['retry-delay'] || 5;
const CHECK_FREQUENCY = argv['check-frequency'] || CONFIG_FILE['check-frequency'] || 5;

let allGood = true;
let retryCount = 0;
let lastWanIp = '';

// Check if all required parameters are provided:
if ([ROUTER_PASSWORD, NOIP_HOSTNAME, NOIP_USERNAME, NOIP_PASSWORD].indexOf() > -1) {
    allGood = false;
    console.log(chalk.bold.red('\nMissing parameters, check usage:'));
    printHelp();
    console.log(chalk.bold('Or provide configuration in cofiguration file, see config-sample.yaml'));
    setTimeout(process.exit, 1000);
}

/**
 * Print help
 */
function printHelp() {
    const required = chalk.bold.red('required');
    const green = chalk.bold.green;
    console.log(`
    --router-ip:         The IP address of the router (default: ${green('192.168.0.1')})
    --router-password:   The admin password to log into the router (${required})
    --noip-hostname:     The hostname registered to your account on no-ip.com you want to
                         update the IP for (${required})
    --noip-username:     Your no-ip.com username (${required})
    --noip-password:     Your no-ip.com password (${required})
    -r:                  Retry on error (default: ${green('false')})
    --max-retries:       Number of retries whne there is an error (default: ${green(5)})
    --retry-delay:       The number of seconds to pause between retries (default: ${green(5)})
    --check-frequency:   How frequently (in minutes) to check for WLAN IP changes (default: ${green(5)})
    `);
}

/**
 * Extract the WAN IP from the device connection status page.
 */
function extractWanIp(body) {
    return new Promise((resolve, reject) => {
        let wanIP = cheerio.load(body)('#superHubVersion > div > span').html();
        if (wanIP) {
            if (wanIP === lastWanIp.trim()) {
                return reject({ msg: 'No need to update, WAN IP hasn\'t changed' });
            }
            return resolve(wanIP);
        }
        return reject({ msg: 'Error extracting WAN IP from HTML!' });
    });
}

/**
 * Get the device connection status page from the router.
 */
function requestDeviceConnectionStatusPage() {
    return new Promise((resolve, reject) => {
        request(`http://${ROUTER_IP}/device_connection_status.html`, (error, response, body) => {
            if (error || response.statusCode !== 200) {
                return reject({ msg: 'Error retrieving device connection status page failed', err: error });
            }
            return resolve(body);
        });
    });
}

/**
 * Function to loginto the router.
 */
function loginRequest(formName) {
    return new Promise((resolve, reject) => {
        let formData = {};
        formData[formName] = ROUTER_PASSWORD;
        request({
            method: 'POST',
            url: `http://${ROUTER_IP}/cgi-bin/VmLoginCgi`,
            form: formData
        }, (err, httpResponse, body) => {
            if (err || httpResponse.statusCode !== 200) {
                return reject({ msg: 'Error loginto router', err: err });
            }
            resolve();
        });
    });
}

/**
 * Function to call the NO-IP API to update the IP of the host.
 */
function callNoIpApiToUpdateHostIp(ip) {
    console.log('calling', `http://${NOIP_USERNAME}:${NOIP_PASSWORD}@dynupdate.no-ip.com/nic/update?hostname=${NOIP_HOSTNAME}&myip=${ip}`);
    return new Promise((resolve, reject) => {
        request(`http://${NOIP_USERNAME}:${NOIP_PASSWORD}@dynupdate.no-ip.com/nic/update?hostname=${NOIP_HOSTNAME}&myip=${ip}`,
            (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    retryCount = 0;
                    return resolve(body);
                }
                reject({ msg: 'Error calling no-ip.com API', err: error });
            });
    });
}

function getPasswordFieldName(body) {
    return new Promise((resolve, reject) => {
        return resolve(cheerio.load(body)('#password').attr('name'));
    });
}

/**
 *  Function that performs a HTTP request to get the login page, extract the name 
 *  attribute of the password field and returns a Promise with it as a string argument.
*/
function requestLoginPage() {
    return new Promise((resolve, reject) => {
        request('http://192.168.0.1/VmLogin.html', (error, response, body) => {
            if (!error && response.statusCode == 200) {
                return resolve(body);
            }
            return reject({ msg: 'Error retrieving login page from router', err: error });
        });
    });
}

/**
 * Print error messages in red
 */
function printErrorAndMaybeRetry(err) {
    console.error(chalk.bold.red('✘ ' + err.msg), err.err || '');
    if (RETRY_ON_ERROR && retryCount++ <= MAX_RETRIES) {
        setTimeout(run, RETRY_DELAY * 1000);
    }
}

/**
 * Parse the no-ip.com response and set the last ip from it
 */
function setLastWanIpFromNoIpDotComResponse(response) {
    console.log('no-ip.com response', chalk.bold(response));
    lastWanIp = response.split(' ')[1].trim();
}

/**
 * Main function
 */
function run() {
    if (allGood) {
        requestLoginPage()
            .then(getPasswordFieldName)
            .then(loginRequest)
            .then(requestDeviceConnectionStatusPage)
            .then(extractWanIp)
            .then(callNoIpApiToUpdateHostIp)
            .then(setLastWanIpFromNoIpDotComResponse)
            .catch(printErrorAndMaybeRetry);
    }
}
run();

// Run main function periodically:
setInterval(run, CHECK_FREQUENCY * 60000);
