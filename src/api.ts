import { Mutex } from 'async-mutex';
import { Connection, Device, WLan } from 'huawei-lte-api';

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
  private readonly log: (message: string) => void;
  private readonly url: string;

  constructor(log: (message: string) => void, address: string, password: string) {
    this.log = log;
    this.url = `http://admin:${password}@${address}`;
  }

  async refreshConnection() {
    const connection = new Connection(this.url, 5000);
    await connection.ready;
    return connection;
  }

  @exclusively
  async reboot() {
    const connection = await this.refreshConnection();
    const device = new Device(connection);
    await device.reboot();
  }

  @exclusively
  async isBlocked(mac: string) {
    const connection = await this.refreshConnection();
    const wlan = new WLan(connection);

    const current = await wlan.multiMacfilterSettings() as any;

    const currentList = current['Ssids']['Ssid'] as Record<string, string>[];
    const firstWindow = currentList[0];

    for (let i = 0; i <= 9; i++) {
      const mac_key = `WifiMacFilterMac${i}`;
      const mac_field = firstWindow[mac_key];

      if (mac_field === mac) {
        return true;
      }
    }
    return false;
  }

  @exclusively
  async blacklist(hostname: string, mac: string) {
    const connection = await this.refreshConnection();
    const wlan = new WLan(connection);

    const current = await wlan.multiMacfilterSettings() as any;

    const currentList = current['Ssids']['Ssid'] as Record<string, string>[];
    const firstWindow = currentList[0];

    for(let i = 0; i <= 9; i++) {
      const mac_key = `WifiMacFilterMac${i}`;
      const hostname_key = `wifihostname${i}`;

      const mac_field = firstWindow[mac_key];

      if (mac_field) {
        if (mac_field === mac) {
          this.log(`Blacklist: ${hostname} (${mac}) already blocked`);
          return;
        }
        continue;
      } else {
        // this is the free spot
        firstWindow[mac_key] = mac;
        firstWindow[hostname_key] = hostname;

        currentList[0] = firstWindow;

        // @ts-ignore
        await wlan.setMultiMacfilterSettings(currentList);

        this.log(`${hostname} (${mac}) added to blacklist`);
        return;
      }
    }
  }

  @exclusively
  async whitelist(mac: string) {
    const connection = await this.refreshConnection();
    const wlan = new WLan(connection);

    const current = await wlan.multiMacfilterSettings() as any;

    const currentList = current['Ssids']['Ssid'] as Record<string, string>[];
    const firstWindow = currentList[0];

    for(let i = 0; i <= 9; i++) {
      const mac_key = `WifiMacFilterMac${i}`;
      const hostname_key = `wifihostname${i}`;

      const mac_field = firstWindow[mac_key];
      const hostname_field = firstWindow[hostname_key];

      if (mac_field) {
        if (mac_field === mac) {
        // clear this entry
          firstWindow[mac_key] = '';
          firstWindow[hostname_key] = '';

          currentList[0] = firstWindow;

          // @ts-ignore
          await wlan.setMultiMacfilterSettings(currentList);

          this.log(`${hostname_field} (${mac}) removed from blacklist`);
          return;
        }
      }
    }

    this.log('Whitelist: Nothing to be done');
  }
}