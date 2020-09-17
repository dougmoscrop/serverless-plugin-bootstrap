'use strict';

const test = require('ava');
const sinon = require('sinon');

const { printChanges, printStackPolicy } = require('../print');

test('works (no changes)', t => {
    const log = sinon.stub();
    const consoleLog = sinon.stub();
    const serverless = {
        cli: {
            log,
            consoleLog,
        }
    };

    printChanges(serverless, 'stack-name', 'change-set-name', []);

    t.true(log.callCount > 1);
});

test('works (resource change)', t => {
    const log = sinon.stub();
    const consoleLog = sinon.stub();
    const serverless = {
        cli: {
            log,
            consoleLog,
        }
    };

    printChanges(serverless, 'stack-name', 'change-set-name', [{ Type: 'Resource', ResourceChange: { Action: 'Add', From: {}, To: {} } }]);

    t.true(log.callCount > 1);
});

test('works (parameter change - missing path)', t => {
  const log = sinon.stub();
  const consoleLog = sinon.stub();
  const serverless = {
      cli: {
          log,
          consoleLog,
      }
  };

  printChanges(serverless, 'stack-name', 'change-set-name', [{ Type: 'Parameter', ParameterChange: { Action: 'Modify', From: 1, To: 2 } }]);

  t.true(log.callCount > 1);
});

test('works (stack policy)', t => {
  const log = sinon.stub();
  const consoleLog = sinon.stub();
  const serverless = {
      cli: {
          log,
          consoleLog,
      }
  };

  printStackPolicy(serverless, 'stack-name', [{ Effect: 'Allow', Action: '*', Principal: '*', Resource: '*' }]);

  t.true(log.callCount > 0);
});

test('throws on unknown action', t => {
    const log = sinon.stub();
    const consoleLog = sinon.stub();
    const serverless = {
        cli: {
            log,
            consoleLog,
        }
    };

    const err = t.throws(() =>
      printChanges(serverless, 'stack-name', 'change-set-name', [{ Type: 'Resource', ResourceChange: { Action: 'Fail', From: {}, To: {} } }])
    );
    t.is(err.message, 'Unknown Action: Fail');
});
