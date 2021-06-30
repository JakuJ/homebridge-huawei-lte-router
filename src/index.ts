import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import { Device } from 'huawei-lte-api';
import { connect } from './router';
import isOnline from 'is-online';

let hap: HAP;

export = async (api: API) => {
  hap = api.hap;
  api.registerAccessory('Huawei LTE Router', Router);
};

class Router implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly config: AccessoryConfig;

  private device: Device | null = null;

  private readonly switchService: Service;
  private informationService: Service;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.name = config.name;

    this.switchService = new hap.Service.Switch(this.name);
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Huawei')
      .setCharacteristic(hap.Characteristic.Model, this.config.model)
      .setCharacteristic(hap.Characteristic.SerialNumber, this.config.serialNumber);

    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(hap.CharacteristicEventTypes.GET, async (callback) => {
        callback(undefined, await isOnline());
      })
      .on(hap.CharacteristicEventTypes.SET, this.setSwitchState.bind(this));
  }

  async setSwitchState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const switchOn = value as boolean;
    this.log.info(`Router turned ${switchOn ? 'ON': 'OFF'} by the user`);

    if (switchOn) {
      this.switchService.updateCharacteristic(hap.Characteristic.On, await isOnline());
    } else {
      const device = await this.getDevice();

      const response = await device.reboot();
      this.log.debug('Reboot reponse: ', response);

      this.device = null;

      const handle = setInterval(async () => {
        this.log.debug('Ping...');
        if (await isOnline({timeout: 9000})) {
          this.switchService.updateCharacteristic(hap.Characteristic.On, true);
          this.log.info('Router back online');
          clearInterval(handle);
        }
      }, 10000);
    }

    callback();
  }

  async getDevice() {
    if (this.device === null) {
      this.log.debug('Connecting with the router...');
      this.device = await connect(this.config.address, this.config.password);
      this.log.debug('Connected!');
    }

    return this.device;
  }

  identify(): void {
    this.log.debug('Identify');
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }

}