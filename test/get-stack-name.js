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

test('getStackName generates name', t => {
  const plugin = t.context.plugin;

  plugin.config = {
    file: 'blah/file.json'
  };

  const name = plugin.getStackName();

  t.deepEqual(name, 'foo-service-file');
});

test('getStackName returns custom name', t => {
  const plugin = t.context.plugin;

  plugin.config = {
    file: 'blah/file.json',
    stack: 'bar'
  };

  const name = plugin.getStackName();

  t.deepEqual(name, 'bar');
});
