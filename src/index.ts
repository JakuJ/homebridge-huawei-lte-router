import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import { Device } from "huawei-lte-api";
import { connect } from "./router";
import {Mutex, MutexInterface, Semaphore, SemaphoreInterface, withTimeout} from 'async-mutex';

let hap: HAP;

export = async (api: API) => {
  hap = api.hap;
  api.registerAccessory("Huawei LTE Router", Router);
};

class Router implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly config: AccessoryConfig;
  
  private device: Device | null = null;
  private info: Record<string, unknown> | null = null;
  private readonly mutex: Mutex;
  
  private readonly switchService: Service;
  private informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.name = config.name;
    this.mutex = new Mutex();

    this.switchService = new hap.Service.Switch(this.name);
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Huawei");

    this.informationService.getCharacteristic(hap.Characteristic.Model).on(hap.CharacteristicEventTypes.GET, async (callback) => {
      
      const value = await this.mutex.runExclusive(async () => await this.getInfo('DeviceName'));
      callback(undefined, value);
    });

    this.informationService.getCharacteristic(hap.Characteristic.SerialNumber).on(hap.CharacteristicEventTypes.GET, async (callback) => {
      const value = await this.mutex.runExclusive(async () => await this.getInfo('SerialNumber'));
      callback(undefined, value);
    });

    this.informationService.getCharacteristic(hap.Characteristic.SoftwareRevision).on(hap.CharacteristicEventTypes.GET, async (callback) => {
      const value = await this.mutex.runExclusive(async () => await this.getInfo('SoftwareVersion'));
      callback(undefined, value);
    });

    this.switchService.getCharacteristic(hap.Characteristic.On)
    .on(hap.CharacteristicEventTypes.GET, callback => {
      this.log.info("State of the router queried");
      callback(undefined, this.device !== null);
    })
    .on(hap.CharacteristicEventTypes.SET, this.setSwitchState.bind(this));
  }

  setSwitchState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const switchOn = value as boolean;
    this.log.info("Router was turned " + (switchOn ? "ON": "OFF"));

    if (!switchOn) {
      // TODO: Restart the router
    }
    
    callback();
  }

  async getDevice() {
    if (this.device === null) {
      this.log.debug("Connecting to the device");
      this.device = await connect(this.config.password);
      this.log.debug("Connected");
    }
    
    return this.device;
  }
  
  async getInfo(key: string) {
    if (this.info === null) {
      this.log.debug("Fetching information");
      this.info = await (await this.getDevice()).information();
      this.log.debug("Information:", this.info);
    }
    
    return this.info[key] as string;
  }

  identify(): void {
    this.log("Identify");
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }

}