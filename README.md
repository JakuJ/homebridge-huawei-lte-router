
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
        "ip": "192.168.8.1",
        "password": "#REDACTED",
        "model": "B535-232",
        "serialNumber": "#REDACTED",
        "accessSwitches": [
            {
                "hostname": "Some device",
                "mac": "11:22:33:44:55:66"
            },
            {
                "hostname": "Some other device",
                "mac": "77:88:99:AA:BB:CC"
            }
        ]
    }
]
```

**Required fields:**
- `name` is the name of your router as it appears in HomeKit
- `ip` is the IP address of the router
- `password` is the router's password, the same as for its web interface

**Optional fields:**
- `model` is the router's model as it appears in HomeKit
- `serialNumber` is the router's serial number as it appears in HomeKit
- `accessSwitches` is a list of hostnames and MAC addresses. For each, a switch will be created, that allows you to turn this device's access to the internet on and off.
    - `hostname` (required) is the name of the switch as it appears in Homekit and your router's device list.
    - `mac` (required) is the MAC address of the corresponding device


**NOTE**: (at least on B535-232) Specifying an access switch for a device with a MAC address that has never been seen by the router will cause the router to reject any requests to blacklist that device.

## Testing

Want to run the test suite?

1. Get a Huawei LTE router
2. Create a `test_secrets.json` file in the root of the repository. Refer to [the test file](src/api.spec.ts) to see which properties must be supplied for the tests to work.
3. Run `npm test`


## Contributing

You are free to submit pull requests to this repository.

For information on how to develop Homebridge plugins, refer to the [template repository](https://github.com/homebridge/homebridge-plugin-template).
