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

test('happy path', t => {
  const provider = t.context.provider;
  const serverless = t.context.serverless;

  const Plugin = proxyquire('..', {
    './print': sinon.stub()
  });

  t.context.options['change-set'] = 'test';
  
  const plugin = new Plugin(t.context.serverless, t.context.options);

  serverless.utils = {
    readFileSync: sinon.stub().returns({}),
  };

  const mock = provider.request = sinon.mock()
    .withArgs('CloudFormation', 'executeChangeSet')
    .resolves();

  sinon.stub(plugin, 'getStackName').returns('stackName');
  sinon.stub(plugin, 'getChanges').resolves({ changes: [] })

  return plugin.execute()
    .then(() => {
      mock.verify();
      t.pass();
    });
});

test('throws when missing arg', t => {
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
      .never()
  
    sinon.stub(plugin, 'getStackName').returns('stackName');
    sinon.stub(plugin, 'getChanges').resolves({ changes: [] })
  
    const err = t.throws(() => plugin.execute());

    mock.verify();
    t.is(err.message, 'Bootstrap: You must specify a ChangeSet name (serverless bootstrap execute -c {{changeSetName}})');
  });