
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# homebridge-huawei-lte-router

HomeBridge plugin for Huawei LTE routers.

Only really tested on a B535-232, but should work with every device that [this API package](https://github.com/Salamek/huawei-lte-api-ts) claims to work with.

**Supports the following functions:**
- Rebooting the router.
- Blacklisting / whitelisting connected devices.

## Installation
- Install Homebridge (e.g. using `npm install -g homebridge`)
- Install this plugin:
  -  from NPM: `npm install homebridge-huawei-lte-router`
  -  manually: download the newest release -> `npm install` -> `npm run build` -> `npm link`
- Configure the plugin settings through config.json or web UI (see below for the options)

## Example config

```
"accessories": [
    {
        "accessory": "Huawei LTE Router",
        "name": "My LTE Router",
        "address": "192.168.8.1",
        "password": "<your password>",
        "model": "B535-232",
        "serialNumber": "<your serial number>",
        "devices": [
            {
                "name": "Some device",
                "mac": "11:22:33:44:55:66"
            },
            {
                "name": "Some other device",
                "mac": "77:88:99:AA:BB:CC"
            }
        ]
    }
],
```

**Required fields:**
- `name` is the name of your router as it appears in HomeKit
- `address` is the IP address of the router
- `password` is the router's password, the same as for its web interface

**Optional fields:**
- `model` is the router's model as it appears in HomeKit
- `serialNumber` is the router's serial number as it appears in HomeKit
- `devices` is a list of names and MAC addresses. For each, a switch will be created, that allows you to turn this device's access to the internet on and off.
    - `name` (required) is the name of the switch as it appears in Homekit.
    - `mac` (required) is the MAC address of the corresponding device


**NOTE**: (at least on B535-232) Specifying a device with a MAC address that has never been seen by the router will crash the plugin :wink:

## Contributing

You are free to submit pull requests to this repository.

For information on how to develop Homebridge plugins, refer to the [template repository](https://github.com/homebridge/homebridge-plugin-template).
