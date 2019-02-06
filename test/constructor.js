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

test('it has the right hooks', t => {
  const plugin = t.context.plugin;

  const bootstrap = sinon.stub(plugin, 'bootstrap').resolves();
  const execute = sinon.stub(plugin, 'execute').resolves();
  const check = sinon.stub(plugin, 'check').resolves();

  t.true(typeof plugin.hooks === 'object');
  t.true(typeof plugin.hooks['bootstrap:bootstrap'] === 'function');
  t.true(typeof plugin.hooks['bootstrap:execute:execute'] === 'function');
  t.true(typeof plugin.hooks['before:deploy:deploy'] === 'function');

  plugin.hooks['bootstrap:bootstrap']();

  t.true(bootstrap.calledOnce);

  plugin.hooks['before:deploy:deploy']();

  t.true(check.calledOnce);

  plugin.hooks['bootstrap:execute:execute']();

  t.true(execute.calledOnce);
});
