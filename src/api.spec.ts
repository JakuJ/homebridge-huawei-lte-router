/* eslint-disable no-console */
import { describe, it } from 'mocha';
import _config from '../test_secrets.json';
import HuaweiApi from './api';
import chai from 'chai';
import {expect} from 'chai';
import as_promised from 'chai-as-promised';
import * as sinon from 'sinon';
import { Logger } from 'homebridge/lib/logger';

chai.use(as_promised);

type TestConfig = {
  address: string;
  password: string;
  hostname: string;
  mac: string;
  hostname2: string;
  mac2: string;
};

const config = _config as TestConfig;

let logger: sinon.SinonStubbedInstance<Logger>;
let api: HuaweiApi;

beforeEach(() => {
  logger = sinon.createStubInstance(Logger);
  api = new HuaweiApi(logger, config.address, config.password);
});

after(() => {
  api.whitelist(config.mac);
  api.whitelist(config.mac2);
});

describe('HuaweiApi', () => {
  describe('blacklisting', () => {
    it('adds devices to the blacklist', async () => {
      await expect(api.blacklist(config.hostname, config.mac)).to.be.fulfilled;
      await expect(api.isBlocked(config.mac)).to.eventually.equal(true);
    });

    it('removes devices from the blocklist', async () => {
      await expect(api.whitelist(config.mac)).to.be.fulfilled;
      await expect(api.isBlocked(config.mac)).to.eventually.equal(false);
    });

    it('whitelisting reverses blacklisting', async () => {
      await expect(api.blacklist(config.hostname, config.mac)).to.be.fulfilled;
      await expect(api.whitelist(config.mac)).to.be.fulfilled;
      await expect(api.isBlocked(config.mac)).to.eventually.equal(false);
    });

    it('blacklisting twice works as expected', async () => {
      await expect(api.blacklist(config.hostname, config.mac)).to.be.fulfilled;
      await expect(api.blacklist(config.hostname, config.mac)).to.be.fulfilled;
      await expect(api.isBlocked(config.mac)).to.eventually.equal(true);
    });

    it('can blacklist two devices at the same time', async () => {
      const p1 = api.blacklist(config.hostname, config.mac);
      const p2 = api.blacklist(config.hostname2, config.mac2);
      await expect(Promise.all([p1, p2])).to.be.fulfilled;

      await expect(api.isBlocked(config.mac)).to.eventually.equal(true, 'Device 1 blacklisted');
      await expect(api.isBlocked(config.mac2)).to.eventually.equal(true, 'Device 2 blacklisted');
    });

    it('whitelisting preserves other devices 1', async () => {
      await expect(api.blacklist(config.hostname, config.mac)).to.be.fulfilled;
      await expect(api.blacklist(config.hostname2, config.mac2)).to.be.fulfilled;

      await expect(api.whitelist(config.mac)).to.be.fulfilled;

      await expect(api.isBlocked(config.mac)).to.eventually.equal(false, 'Device 1 not blacklisted');
      await expect(api.isBlocked(config.mac2)).to.eventually.equal(true, 'Device 2 blacklisted');
    });

    it('whitelisting preserves other devices 2', async () => {
      await expect(api.blacklist(config.hostname, config.mac)).to.be.fulfilled;
      await expect(api.blacklist(config.hostname2, config.mac2)).to.be.fulfilled;

      await expect(api.whitelist(config.mac2)).to.be.fulfilled;

      await expect(api.isBlocked(config.mac)).to.eventually.equal(true, 'Device 1 blacklisted');
      await expect(api.isBlocked(config.mac2)).to.eventually.equal(false, 'Device 2 not blacklisted');
    });

    it('does not fail with unseen MAC address', async () => {
      const dummyMAC = '11:22:33:44:55:66';

      // it doesn't throw...
      await expect(api.blacklist('dummy', dummyMAC)).to.be.fulfilled;
      sinon.assert.calledOnce(logger.warn);

      // ...but it doesn't work either
      await expect(api.isBlocked(dummyMAC)).to.eventually.equal(false);
    });
  });
});
