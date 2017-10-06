'use strict';

const test = require('ava');

const Plugin = require('..');

test.beforeEach(t =>  {
  t.context.serverless ={
    service: {
      service: 'foo-service',
      provider: {},
      custom: {
        bootstrap: {}
      }
    },
    getProvider: () => t.context.provider
  };
  t.context.provider = {};
  t.context.plugin = new Plugin(t.context.serverless);
  t.context.plugin.config = {};
});

test('getChangeSetParams includes templateBody', t => {
  const plugin = t.context.plugin;

  plugin.templateBody = 'test';

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.TemplateBody, 'test');
});

test('getChangeSetParams includes default (empty) capabilities', t => {
  const plugin = t.context.plugin;

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.Capabilities, []);
});


test('getChangeSetParams includes names', t => {
  const plugin = t.context.plugin;

  plugin.stackName = 'stack';
  plugin.changeSetName = 'changeset';

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.StackName, 'stack');
  t.deepEqual(params.ChangeSetName, 'changeset');
});

test('getChangeSetParams includes capabilities', t => {
  const plugin = t.context.plugin;

  plugin.config.capabilities = [
    'CAPABILITY_IAM',
    'CAPABILITY_NAMED_IAM'
  ];

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.Capabilities, [
    'CAPABILITY_IAM',
    'CAPABILITY_NAMED_IAM'
  ]);
});

test('getChangeSetParams includes parameters', t => {
  const plugin = t.context.plugin;

  plugin.config.parameters = [{
    Key: 'blah',
    Value: 'blah'
  }];

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.Parameters, [{
    Key: 'blah',
    Value: 'blah'
  }]);
});
