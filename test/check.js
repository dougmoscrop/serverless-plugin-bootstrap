'use strict';

const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

test.beforeEach(t =>  {
  t.context.serverless ={
    cli: {
      log: sinon.stub(),
    },
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
});

test('is happy when there are no changes', t => {
  const provider = t.context.provider;
  const serverless = t.context.serverless;

  const Plugin = proxyquire('..', {
    './print': sinon.stub()
  });

  const plugin = new Plugin(t.context.serverless, t.context.options);

  serverless.utils = {
    readFileSync: sinon.stub().returns({}),
  };

  const mock = provider.request = sinon.mock()
    .withArgs('CloudFormation', 'deleteChangeSet')
    .resolves();

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChanges').resolves({ changes: [] })

  return plugin.check()
    .then(() => {
      mock.verify();
      t.pass();
    });
});

test('rejects when there are changes', t => {
  const provider = t.context.provider;
  const serverless = t.context.serverless;

  const Plugin = proxyquire('..', {
    './print': sinon.stub()
  });

  const plugin = new Plugin(t.context.serverless, t.context.options);

  serverless.utils = {
    readFileSync: sinon.stub().returns({}),
  };

  const mock = provider.request = sinon.mock()
    .withArgs('CloudFormation', 'deleteChangeSet')
    .resolves();

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChanges').resolves({ changes: [{}] })

  return plugin.check()
    .then(() => {
        t.fail('should not reach here');
    })
    .catch(e => {
      t.is(mock.callCount, 0);
      t.is(e.message, 'The stackName stack does not match the local template. Use the \'serverless bootstrap\' command to view the diff and either update your source code or apply the changes');
    });
});