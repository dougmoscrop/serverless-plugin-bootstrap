'use strict';

const test = require('ava');
const sinon = require('sinon');

const Plugin = require('..');

test.beforeEach(t =>  {
  t.context.serverless ={
    service: {
      service: 'foo-service',
      provider: {}
    },
    getProvider: () => t.context.provider
  };
  t.context.options = {};
  t.context.provider = {};
  t.context.plugin = new Plugin(t.context.serverless, t.context.options);
});

test('check is happy when there are no changes', t => {
  const plugin = t.context.plugin;
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const options = t.context.options;

  serverless.utils = {
    readFileSync: sinon.stub().returns({})
  };

  const mock = provider.request = sinon.mock()
    .withArgs('CloudFormation', 'deleteChangeSet')
    .resolves();

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChangeSetName').returns('changeSetName');
  sinon.stub(plugin, 'createChangeSet').resolves();
  sinon.stub(plugin, 'getChanges').returns([]);

  return plugin.check()
    .then(() => {
      mock.verify();
      t.pass();
    });
});

test('does not call check if there is no config', t => {
  const plugin = t.context.plugin;
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const options = t.context.options;

  const stub = sinon.stub(plugin, 'check').resolves();

  return plugin.beforeDeploy()
    .then(() => {
      t.false(stub.called);
    });
});

test('does not call check if auto is false', t => {
  const plugin = t.context.plugin;
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const options = t.context.options;

  const stub = sinon.stub(plugin, 'check').resolves();

  serverless.service.custom = {
    bootstrap: {
      auto: false
    }
  };

  return plugin.beforeDeploy()
    .then(() => {
      t.false(stub.called);
    });
});

test('calls check when config', t => {
  const plugin = t.context.plugin;
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const options = t.context.options;

  const stub = sinon.stub(plugin, 'check').resolves();

  serverless.service.custom = {
    bootstrap: {}
  };

  return plugin.beforeDeploy()
    .then(() => {
      t.true(stub.called);
    });
});

test('assigns config to options', t => {
  const plugin = t.context.plugin;
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const options = t.context.options;

  const stub = sinon.stub(plugin, 'check').resolves();

  serverless.service.custom = {
    bootstrap: {
      stack: 'test',
      file: 'bootstrap/account.json'
    }
  };

  return plugin.beforeDeploy()
    .then(() => {
      t.deepEqual(plugin.options.stack, 'test');
      t.deepEqual(plugin.options.file, 'bootstrap/account.json');
    });
});
