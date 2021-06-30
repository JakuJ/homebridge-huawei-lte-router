import {Connection, Device } from 'huawei-lte-api';

export async function connect(address: string, password: string) {
  const connection = new Connection(`http://admin:${password}@${address}`, 5000);
  await connection.ready;
  return new Device(connection);
}
