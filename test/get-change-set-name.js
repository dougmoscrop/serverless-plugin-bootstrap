'use strict';

const test = require('ava');

const Plugin = require('..');

test.beforeEach(t =>  {
  t.context.serverless ={
    service: {
      service: 'foo-service',
      provider: {}
    },
    getProvider: () => t.context.provider
  };
  t.context.provider = {};
  t.context.plugin = new Plugin(t.context.serverless);
});

test('getChangeSetName includes hash', t => {
  const plugin = t.context.plugin;

  plugin.config = {};
  plugin.templateBody = JSON.stringify({ test: 'test' });

  const name = plugin.getChangeSetName();

  t.deepEqual(name, 'serverless-bootstrap-828bcef8763c1bc616e25a06be4b90ff');
});

test('getChangeSetName includes parameters in hash', t => {
  const plugin = t.context.plugin;

  plugin.config = {
    parameters: {
      test: 'value'
    }
  };
  plugin.templateBody = JSON.stringify({ test: 'test' });

  const name = plugin.getChangeSetName();

  t.deepEqual(name, 'serverless-bootstrap-fe13da79a72ac59b292bb29c45420511');
});
