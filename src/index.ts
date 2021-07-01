import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';

import { getConnection, reboot, blacklist, whitelist, isBlocked } from './api';
import isOnline from 'is-online';
import { HAP } from 'homebridge/lib/api';

export = async (api: API) => {
  api.registerAccessory('Huawei LTE Router', Router);
};

class Router implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly hap: HAP;

  private readonly switchService: Service;
  private readonly accessSwitches: Service[] = [];
  private informationService: Service;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    const hap = this.hap = api.hap;

    // Information service
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Huawei')
      .setCharacteristic(hap.Characteristic.Model, this.config.model || 'LTE Router')
      .setCharacteristic(hap.Characteristic.SerialNumber, this.config.serialNumber || 'Unknown');

    // Router reset switch
    this.switchService = new hap.Service.Switch('Reset', 'Main');

    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(hap.CharacteristicEventTypes.GET, async (callback) => {
        callback(undefined, await isOnline());
      })
      .on(hap.CharacteristicEventTypes.SET, this.setResetSwitch.bind(this));

    // Device access switches
    for (const {hostname, mac} of this.config.devices || []) {
      const _switch = new hap.Service.Switch(hostname, mac);

      _switch.getCharacteristic(hap.Characteristic.On)
        .on(hap.CharacteristicEventTypes.GET, async (callback) => {
          const connection = await getConnection(this.config.address, this.config.password);
          callback(undefined, !await isBlocked(connection, mac));
        })
        .on(hap.CharacteristicEventTypes.SET, async (value, callback) => {
          await this.setAccessSwitch(hostname, mac, value);
          callback(undefined);
        });

      this.accessSwitches.push(_switch);
    }
  }

  /**
   * Handles flicking the reset switch.
   * @param value     Whether the switch was turned on or off.
   * @param callback  Callback provided by the API.
   */
  async setResetSwitch(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const switchOn = value as boolean;
    this.log.info(`Router turned ${switchOn ? 'ON': 'OFF'}`);

    if (switchOn) {
      this.switchService.updateCharacteristic(this.hap.Characteristic.On, await isOnline());
    } else {
      const connection = await getConnection(this.config.address, this.config.password);

      const response = await reboot(connection);
      this.log.debug('Reboot reponse: ', response);

      const handle = setInterval(async () => {
        this.log.debug('Ping...');
        if (await isOnline({timeout: 9000})) {
          this.switchService.updateCharacteristic(this.hap.Characteristic.On, true);
          this.log.info('Router back online');
          clearInterval(handle);
        }
      }, 10000);
    }

    callback();
  }

  /**
   * Handles flicking the access switch for a device.
   * @param hostname  Device hostname.
   * @param mac       Device MAC address.
   * @param value     Whether the switch was turned on or off.
   * @param callback  Callback provided by the API.
   */
  async setAccessSwitch(hostname: string, mac:string, value: CharacteristicValue) {
    const block = !(value as boolean);
    this.log.info(`${hostname} was ${block ? 'blacklisted': 'whitelisted'}`);

    const connection = await getConnection(this.config.address, this.config.password);

    if (block) {
      await blacklist(connection, hostname, mac);
    } else {
      await whitelist(connection, mac);
    }
  }

  identify(): void {
    this.log.debug('Identify');
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
      ...this.accessSwitches,
    ];
  }

}