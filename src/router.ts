import {Connection, Device } from 'huawei-lte-api';
import { WLan } from 'huawei-lte-api';

export async function connect(address: string, password: string) {
  const connection = new Connection(`http://admin:${password}@${address}`, 5000);
  await connection.ready;
  return connection;
}

export async function reboot(connection: Connection) {
  const device = new Device(connection);
  await device.reboot();
}

export async function blacklist(connection: Connection, hostname: string, mac: string) {
  const wlan = new WLan(connection);

  const current = await wlan.multiMacfilterSettings() as any;

  const currentList = current['Ssids']['Ssid'] as [Record<string, string>];
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
