'use strict';

const test = require('ava');
const sinon = require('sinon');

const print = require('../print');

test('works (no changes)', t => {
    const log = sinon.stub();
    const consoleLog = sinon.stub();
    const serverless = {
        cli: {
            log,
            consoleLog,
        }
    };

    print(serverless, 'stack-name', 'change-set-name', []);

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

    print(serverless, 'stack-name', 'change-set-name', [{ Type: 'Resource', ResourceChange: { Action: 'Add', From: {}, To: {} } }]);

    t.true(log.callCount > 1);
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
        print(serverless, 'stack-name', 'change-set-name', [{ Type: 'Resource', ResourceChange: { Action: 'Fail', From: {}, To: {} } }])
    );
    t.is(err.message, 'Unknown Action: Fail');
});