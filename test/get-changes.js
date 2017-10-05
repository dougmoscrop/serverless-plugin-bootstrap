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

test('throws when status is not CREATE_COMPLETE', t => {
  const plugin = t.context.plugin;

  const e = t.throws(() => plugin.getChanges({
    Status: 'BAD'
  }));

  t.deepEqual(e.message, 'Expected res.Status to be CREATE_COMPLETE but got BAD');
});

test('throws when status is FAILED but not because of no changes', t => {
  const plugin = t.context.plugin;

  const e = t.throws(() => plugin.getChanges({
    Status: 'FAILED',
    StatusReason: 'S3 is down again'
  }));

  t.deepEqual(e.message, 'createChangeSet FAILED: S3 is down again');
});

test('returns no changes when failure was because of no changes', t => {
  const plugin = t.context.plugin;

  const changes = plugin.getChanges({
    Status: 'FAILED',
    StatusReason: `asdf The submitted information didn't contain changes fdsa`
  });

  t.deepEqual(changes, []);
});

test('returns changes when there are some', t => {
  const plugin = t.context.plugin;

  const changes = plugin.getChanges({
    Status: 'CREATE_COMPLETE',
    Changes: [{
      test: 'test'
    }]
  });

  t.deepEqual(changes, [{ test: 'test' }]);
});
