import { Connection, Device } from 'huawei-lte-api';
import { WLan } from 'huawei-lte-api';
import { Mutex } from 'async-mutex';

const mutex = new Mutex();

let cachedAddress = '';
let cachedPassword = '';

let connection: Connection | null = null;

export async function getConnection(address: string, password: string) {
  return await mutex.runExclusive(async () => {
    if (connection === null) {
      connection = new Connection(`http://admin:${password}@${address}`, 5000);
      await connection.ready;
    }
    cachedAddress = address;
    cachedPassword = password;
    return connection;
  });
}

export async function reboot(connection: Connection) {
  const device = new Device(connection);
  await device.reboot();
}

async function safely(fun: any, args: any[]) {
  try{
    return await fun(...args);
  } catch {
    connection = null;
    const [_, ...other] = args;
    return await fun(await getConnection(cachedAddress, cachedPassword), ...other);
  }
}

export async function isBlocked(connection: Connection, mac: string) {
  return await safely(_isBlocked, [connection, mac]);
}

export async function blacklist(connection: Connection, hostname: string, mac: string) {
  return await safely(_blacklist, [connection, hostname, mac]);
}

export async function whitelist(connection: Connection, mac: string) {
  return await safely(_whitelist, [connection, mac]);
}

async function _isBlocked(connection: Connection, mac: string) {
  const wlan = new WLan(connection);

  const current = await wlan.multiMacfilterSettings() as any;

  const currentList = current['Ssids']['Ssid'] as Record<string, string>[];
  const firstWindow = currentList[0];

  for(let i = 0; i <= 9; i++) {
    const mac_key = `WifiMacFilterMac${i}`;
    const mac_field = firstWindow[mac_key];

    if (mac_field === mac) {
      return true;
    }
  }
  return false;
}

async function _blacklist(connection: Connection, hostname: string, mac: string) {
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
      return;
    }
  }
}

async function _whitelist(connection: Connection, mac: string) {
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
        // clear this entry
        firstWindow[mac_key] = '';
        firstWindow[hostname_key] = '';

        currentList[0] = firstWindow;

        // @ts-ignore
        await wlan.setMultiMacfilterSettings(currentList);

        return;
      }
    }
  }
}
