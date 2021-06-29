import {Connection, Device } from 'huawei-lte-api';

export async function connect(password: string) {
  const connection = new Connection(`http://admin:${password}@192.168.8.1`, 5000);
  await connection.ready;
  return new Device(connection);
}
