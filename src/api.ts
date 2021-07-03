import { Connection, Device } from 'huawei-lte-api';
import { WLan } from 'huawei-lte-api';
import { Mutex } from 'async-mutex';

let _log: (message: string) => void;
let _url: string;
let _connection: Connection;

// Public functions

export function setupApi(log: (message: string) => void, address: string, password: string) {
  _log = log;
  _url = `http://admin:${password}@${address}`;
}

export async function reboot() {
  return await safely(_reboot);
}

export async function isBlocked(mac: string) {
  return await safely(_isBlocked, mac);
}

export async function blacklist(hostname: string, mac: string) {
  return await safely(_blacklist, hostname, mac);
}

export async function whitelist(mac: string) {
  return await safely(_whitelist, mac);
}

// Helpers

const mutex = new Mutex();

async function refreshConnection() {
  _log('Establishing a connection...');
  _connection = new Connection(_url, 5000);
  await _connection.ready;
  _log('Done');
  return _connection;
}

async function safely(fun: any, ...args: any): Promise<any> {
  return await mutex.runExclusive(async () => {
    await refreshConnection();
    return await fun(...args);
  });
}

// Implementations

async function _reboot() {
  const device = new Device(_connection);
  await device.reboot();
}

async function _isBlocked(mac: string) {
  const wlan = new WLan(_connection);

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

async function _blacklist(hostname: string, mac: string) {
  _log(`Blacklist: Running for ${hostname} (${mac})`);

  const wlan = new WLan(_connection);

  const current = await wlan.multiMacfilterSettings() as any;

  const currentList = current['Ssids']['Ssid'] as Record<string, string>[];
  const firstWindow = currentList[0];

  for(let i = 0; i <= 9; i++) {
    const mac_key = `WifiMacFilterMac${i}`;
    const hostname_key = `wifihostname${i}`;

    const mac_field = firstWindow[mac_key];

    if (mac_field) {
      if (mac_field === mac) {
        _log(`Blacklist: ${hostname} (${mac}) already blocked`);
        return; // already blocked
      }
      continue;
    } else {
      // this is the free spot
      firstWindow[mac_key] = mac;
      firstWindow[hostname_key] = hostname;

      currentList[0] = firstWindow;

      // @ts-ignore
      await wlan.setMultiMacfilterSettings(currentList);
      _log(`Blacklist: ${hostname} (${mac}) added to blacklist`);
      return;
    }
  }

  _log('Blacklist: Nothing to be done');
}

async function _whitelist(mac: string) {
  _log(`Whitelist: Running for MAC ${mac}`);

  const wlan = new WLan(_connection);

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
        _log(`Whitelist: ${hostname_field} (${mac}) removed from blacklist`);
        return;
      }
    }
  }

  _log('Whitelist: Nothing to be done');
}
