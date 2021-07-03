import { Mutex } from 'async-mutex';
import { Logger } from 'homebridge';
import { Connection, Device, WLan } from 'huawei-lte-api';
import {SsidFrame, FilterReponse} from './types';

const mutex: Mutex = new Mutex();

function exclusively (target: any, key: string | symbol, descriptor: PropertyDescriptor) {
  const fun = descriptor.value;
  descriptor.value = function (...args: any[]) {
    return mutex.runExclusive(() => {
      return fun.apply(this, args);
    });
  };
  return descriptor;
}

export default class HuaweiApi {
  private readonly log: Logger;
  private readonly url: string;

  constructor(log: Logger, address: string, password: string) {
    this.log = log;
    this.url = `http://admin:${password}@${address}`;
  }

  // Private methods

  private async refreshConnection() {
    const connection = new Connection(this.url, 5000);
    await connection.ready;
    return connection;
  }

  private async getMacFilter(connection: Connection) {
    const wlan = new WLan(connection);
    const response = await wlan.multiMacfilterSettings() as FilterReponse;
    return response.Ssids.Ssid[0];
  }

  private macBlocked(record: SsidFrame, mac: string) {
    return Object.entries(record)
      .filter(([k]) => k.startsWith('WifiMacFilterMac'))
      .map(([, v]) => v)
      .includes(mac);
  }

  // Public methods

  @exclusively
  async reboot() {
    const connection = await this.refreshConnection();
    const device = new Device(connection);
    await device.reboot();
  }

  @exclusively
  async isBlocked(mac: string) {
    const connection = await this.refreshConnection();
    const frame = await this.getMacFilter(connection);
    return this.macBlocked(frame, mac);
  }

  @exclusively
  async blacklist(hostname: string, mac: string) {
    const connection = await this.refreshConnection();
    const frame = await this.getMacFilter(connection);

    if (this.macBlocked(frame, mac)) {
      this.log.warn(`Blacklist: ${hostname} (${mac}) already blocked`);
      return;
    }

    // Update the record to block another device
    let firstEmpty =
      Object.entries(frame)
        .filter(([k, v]) => k.startsWith('WifiMacFilterMac') && !v)
        .map(([k]) => Number.parseInt(k.slice('WifiMacFilterMac'.length)))
        .reduce((a, b) => a <= b ? a : b, 10);

    // 10 is a magic number that will never occur in the response
    if (firstEmpty === 10) {
      firstEmpty = 0;
    }

    frame[`wifihostname${firstEmpty}`] = hostname;
    frame[`WifiMacFilterMac${firstEmpty}`] = mac;

    // Send payload

    const wlan = new WLan(connection);

    try {
      // @ts-ignore
      await wlan.setMultiMacfilterSettings([frame]);

      this.log.info(`${hostname} (${mac}) added to blacklist`);
    } catch (error) {
      this.log.warn(`Couldn't blacklist ${hostname} (${mac})`);
    }
  }

  @exclusively
  async whitelist(mac: string) {
    const connection = await this.refreshConnection();
    const frame = await this.getMacFilter(connection);

    if (!this.macBlocked(frame, mac)) {
      this.log.warn(`Whitelist: ${mac} is not blacklisted`);
      return;
    }

    for(let i = 0; i <= 9; i++) {
      const mac_key = `WifiMacFilterMac${i}`;
      const hostname_key = `wifihostname${i}`;

      const mac_field = frame[mac_key];
      const hostname_field = frame[hostname_key];

      if (mac_field) {
        if (mac_field === mac) {
          // clear this entry
          frame[mac_key] = '';
          frame[hostname_key] = '';

          // entries further up must be moved down a place
          for (let j = i + 1; j <= 9; j++) {
            frame[`wifihostname${j - 1}`] = frame[`wifihostname${j}`];
            frame[`WifiMacFilterMac${j - 1}`] = frame[`WifiMacFilterMac${j}`];
          }

          // send the payload
          const wlan = new WLan(connection);

          // @ts-ignore
          await wlan.setMultiMacfilterSettings([frame]);

          this.log.info(`${hostname_field} (${mac}) removed from blacklist`);
          return;
        }
      }
    }
  }
}