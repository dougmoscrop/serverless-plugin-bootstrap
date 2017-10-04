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

test('getChangeSetParams includes iam capabilities', t => {
  const plugin = t.context.plugin;

  t.context.options.iam = true;

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.Capabilities, ['CAPABILITY_IAM']);
});

test('getChangeSetParams includes named iam capabilities', t => {
  const plugin = t.context.plugin;

  t.context.options.named_iam = true;

  const params = plugin.getChangeSetParams();

  t.deepEqual(params.Capabilities, ['CAPABILITY_NAMED_IAM']);
});
