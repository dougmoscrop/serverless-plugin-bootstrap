'use strict';

const test = require('ava');
const sinon = require('sinon');

const Plugin = require('..');

test.beforeEach(t =>  {
  t.context.serverless ={
    service: {
      service: 'foo-service',
      provider: {},
      custom: {
        bootstrap: {
          file: 'foo/file.json'
        }
      }
    },
    getProvider: () => t.context.provider
  };
  t.context.options = {};
  t.context.provider = {};
  t.context.plugin = new Plugin(t.context.serverless, t.context.options);
});

test('is happy when there are no changes', t => {
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

  return plugin.bootstrap()
    .then(() => {
      mock.verify();
      t.pass();
    });
});

test('rejects when there are changes and execute is not true', t => {
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
  sinon.stub(plugin, 'getChanges').returns([{}]);

  return plugin.bootstrap()
    .then(() => {
      t.fail();
    })
    .catch(e => {
      t.deepEqual(e,'The stack stackName does not match the local template. Review change set changeSetName and either update your source code or execute the change set');
    });
});

test('resolves when there are changes and execute is true', t => {
  const plugin = t.context.plugin;
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const options = t.context.options;

  options.execute = true;

  serverless.utils = {
    readFileSync: sinon.stub().returns({})
  };

  const mock = provider.request = sinon.mock()
    .withArgs('CloudFormation', 'executeChangeSet')
    .resolves();

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChangeSetName').returns('changeSetName');
  sinon.stub(plugin, 'createChangeSet').resolves();
  sinon.stub(plugin, 'getChanges').returns([{}]);

  return plugin.bootstrap()
    .then(() => {
      mock.verify();
      t.true(mock.calledOnce);
    });
});
