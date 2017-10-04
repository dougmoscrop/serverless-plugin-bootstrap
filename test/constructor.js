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

test('it has the right hooks', t => {
  const plugin = t.context.plugin;

  t.true(typeof plugin.hooks === 'object');
  t.true(typeof plugin.hooks['bootstrap:check'] === 'function');
  t.true(typeof plugin.hooks['before:deploy:deploy'] === 'function');
});
