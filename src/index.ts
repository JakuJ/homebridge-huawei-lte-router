import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';
import { HAP } from 'homebridge/lib/api';
import isOnline from 'is-online';
import HuaweiApi from './api';


export = async (api: API) => {
  api.registerAccessory('Huawei LTE Router', Router);
};

class Router implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly hap: HAP;
  private readonly huawei: HuaweiApi;

  private readonly switchService: Service;
  private readonly accessSwitches: Service[] = [];
  private informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.huawei = new HuaweiApi((msg) => this.log.info(msg), this.config.address, this.config.password);

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
          callback(undefined, !await this.huawei.isBlocked(mac));
        })
        .on(hap.CharacteristicEventTypes.SET, async (value, callback) => {
          await this.setAccessSwitch(hostname, mac, value);
          callback(undefined);
        });

      this.accessSwitches.push(_switch);
    }
  }

  async setResetSwitch(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const switchOn = value as boolean;
    this.log.info(`Router turned ${switchOn ? 'ON': 'OFF'}`);

    if (switchOn) {
      this.switchService.updateCharacteristic(this.hap.Characteristic.On, await isOnline());
    } else {
      const response = await this.huawei.reboot();
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

  async setAccessSwitch(hostname: string, mac:string, value: CharacteristicValue) {
    const block = !(value as boolean);

    if (block) {
      await this.huawei.blacklist(hostname, mac);
    } else {
      await this.huawei.whitelist(mac);
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