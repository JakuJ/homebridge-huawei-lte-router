import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";
import { connect } from "./router";

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("Huawei LTE Router", Router);
};

class Router implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly config: AccessoryConfig;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.name = config.name;

    this.switchService = new hap.Service.Switch(this.name);
    
    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("State of the router queried");
        
        // Router is always On - otherwise you wouldn't be able to connect to the bridge.
        callback(undefined, true); 
      })
      .on(CharacteristicEventTypes.SET, this.setSwitchState.bind(this));

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Huawei")
      .setCharacteristic(hap.Characteristic.Model, "Dummy model") // TODO
      .setCharacteristic(hap.Characteristic.SerialNumber, "Dummy number"); // TODO

    log.info("Router finished initializing!");
  }

  setSwitchState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const switchOn = value as boolean;
    this.log.info("Router was turned " + (switchOn ? "ON": "OFF"));

    if (!switchOn) {
      // TODO: Restart the router
      connect(this.config.password);
    }
    
    callback();
  }

  identify(): void {
    this.log("Identify!");
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }

}