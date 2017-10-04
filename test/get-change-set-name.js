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
  t.context.options = {};
  t.context.provider = {};
  t.context.plugin = new Plugin(t.context.serverless, t.context.options);
});

test('getChangeSetName includes hash', t => {
  const plugin = t.context.plugin;

  plugin.templateBody = JSON.stringify({ test: 'test' });

  const name = plugin.getChangeSetName();

  t.deepEqual(name, 'serverless-bootstrap-828bcef8763c1bc616e25a06be4b90ff');
});
