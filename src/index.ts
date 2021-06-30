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

import Connection, { Device } from 'huawei-lte-api';
import { connect, reboot, blacklist } from './router';
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

  private connection: Connection | null = null;

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
      const connection = await this.getConnection();

      const response = await reboot(connection);
      this.log.debug('Reboot reponse: ', response);

      this.connection = null;

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

  async getConnection() {
    if (this.connection === null) {
      this.log.debug('Connecting with the router...');
      this.connection = await connect(this.config.address, this.config.password);
      this.log.debug('Connected!');
    }

    return this.connection;
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