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

test('getStackName generates name', t => {
  const plugin = t.context.plugin;

  t.context.options.file = 'blah/file.json';

  const name = plugin.getStackName();

  t.deepEqual(name, 'foo-service-file');
});

test('getStackName returns custom name', t => {
  const plugin = t.context.plugin;

  t.context.options.file = 'blah/file.json';
  t.context.options.name = 'bar';

  const name = plugin.getStackName();

  t.deepEqual(name, 'bar');
});
