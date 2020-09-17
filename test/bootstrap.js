'use strict';

const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

test.beforeEach(t =>  {
  t.context.serverless = {
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
    './print': { printChanges: sinon.stub(), printStackPolicy: sinon.stub() }
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

  return plugin.bootstrap()
    .then(() => {
      mock.verify();
      t.pass();
    });
});

test('is happy when there are changes but does not delete change set', t => {
  const provider = t.context.provider;
  const serverless = t.context.serverless;

  const Plugin = proxyquire('..', {
    './print': { printChanges: sinon.stub(), printStackPolicy: sinon.stub() }
  });

  const plugin = new Plugin(t.context.serverless, t.context.options);

  serverless.utils = {
    readFileSync: sinon.stub().returns({}),
  };

  const mock = provider.request = sinon.mock()
    .never()

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChanges').resolves({ changes: [{}] })

  return plugin.bootstrap()
    .then(() => {
      mock.verify();
      t.pass();
    });
});

test('sets the stack policy when passed', t => {
  const provider = t.context.provider;
  const serverless = t.context.serverless;
  const service = serverless.service;

  const Plugin = proxyquire('..', {
    './print': { printChanges: sinon.stub(), printStackPolicy: sinon.stub() }
  });

  const plugin = new Plugin(t.context.serverless, t.context.options);

  serverless.utils = {
    readFileSync: sinon.stub().returns({}),
  };
  const testStackPolicy = service.custom.bootstrap.stackPolicy = [{
    Effect: 'Deny',
    Principal: '*',
    Action: 'Update:*',
    Resource: '*'
  }];

  const mock = provider.request = sinon.stub().resolves();

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChanges').resolves({ changes: [{}] })

  return plugin.bootstrap()
    .then(() => {
      sinon.assert.calledOnceWithExactly(mock, 'CloudFormation', 'setStackPolicy', {
        StackName: 'stackName',
        StackPolicyBody: JSON.stringify({ Statement: testStackPolicy })
      });
      t.pass();
    });
});
