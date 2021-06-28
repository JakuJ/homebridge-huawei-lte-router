import {Connection, Device } from 'huawei-lte-api';

export function connect(password: string) {
    const connection = new Connection(`http://admin:${password}@192.168.8.1/`, 5000);

    connection.ready.then(() => {
        console.log('Connected to router API');

        const device = new Device(connection);
        device.signal().then(result => {
            console.log(result);
        }).catch(error => {
            console.log(error);
        });

    });

}