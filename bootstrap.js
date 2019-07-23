'use strict';

const assert = require('assert');
const path = require('path');

const pkg = require('@cfn/pkg');
const diff = require('@cfn/diff');

const print = require('./print');

module.exports = class BootstrapPlugin {

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');
    this.commands = {
      bootstrap: {
        usage: 'Manages a CloudFormation Stack that complements the main Serverless Stack',
        lifecycleEvents: ['bootstrap'],
        commands: {
          execute: {
            usage: 'Execute a ChangeSet',
            options: {
              ['change-set']: {
                usage: 'The name of the ChangeSet to execute',
                required: true,
                shortcut: 'c'
              }
            },
            lifecycleEvents: ['execute']
          }
        }
      },
      deploy: {
        options: {
          bootstrap: {
            usage: 'Whether or not to check the bootstrap stack for changes (default to true, use --no-bootstrap to disable)',
          }
        }
      }
    };
    this.hooks = {
      'bootstrap:bootstrap': () => this.bootstrap(),
      'bootstrap:execute:execute': () => this.execute(),
      'before:deploy:deploy': () => this.check()
    };
  }

  execute() {
    const { provider } = this;
    const changeSetName = this.options['change-set'];

    const stackName = this.getStackName();

    if (typeof changeSetName === 'string') {
      return provider.request('CloudFormation', 'executeChangeSet', {
        StackName: stackName,
        ChangeSetName: changeSetName
      });
    }

    throw new Error('Bootstrap: You must specify a ChangeSet name (serverless bootstrap execute -c {{changeSetName}})');
  }

  check() {
    const { provider, serverless } = this;
    const { bootstrap = true } = this.options;

    if (bootstrap === false) {
      serverless.cli.log('WARNING: Skipping bootstrap check - your infrastructure might not match your code!');
      return Promise.resolve();
    }

    const stackName = this.getStackName();

    return this.getChanges(stackName)
      .then(({ changeSetName, changes }) => {
        if (changes.length > 0) {
          throw new Error(`The ${stackName} stack does not match the local template. Use the 'serverless bootstrap' command to view the diff and either update your source code or apply the changes`);
        }

        return provider.request('CloudFormation', 'deleteChangeSet', {
          StackName: stackName,
          ChangeSetName: changeSetName
        });
      });
  }

  bootstrap() {
    const { provider, serverless } = this;
    const stackName = this.getStackName();

    return this.getChanges(stackName, true)
      .then(({ changeSetName, changes }) => {
        if (changes.length > 0) {
          return print(serverless, stackName, changeSetName, changes);
        } else {
          serverless.cli.log('[serverless-plugin-bootstrap]: No changes.');

          return provider.request('CloudFormation', 'deleteChangeSet', {
            StackName: stackName,
            ChangeSetName: changeSetName
          })
        }
      });
  }

  getChanges(stackName, detailed = false) {
    const { provider, serverless } = this;
    const { service } = serverless;
    const { custom = {} } = service;
    const { bootstrap = {} } = custom;
    const { bucket, file, parameters, capabilities = [] } = bootstrap;

    const roleArn = serverless.service.provider.cfnRole;
    const prefix = 'serverless-bootstrap-';
    const description = 'Created by the Serverless Bootstrap plugin';

    const template = serverless.utils.readFileSync(file);
    const credentials = provider.getCredentials();

    const bucketName = bucket || `${stackName}-resources`;
    const basedir = path.dirname(file);

    return pkg({ credentials, template, basedir, bucketName })
      .then(() => {
        const options = {
          credentials, prefix, description, capabilities, stackName, roleArn, template, parameters, detailed
        };
        return diff(options);
      });
  }

  getStackName() {
    const { serverless } = this;
    const { service } = serverless;
    const { custom = {} } = service;
    const { bootstrap = {} } = custom;
    const { stack, file } = bootstrap;

    assert(file, 'serverless-plugin-bootstrap: must specify custom.bootstrap.file');

    const fileName = path.basename(file, path.extname(file));
    const serviceName = service.service;

    return stack || `${serviceName}-${fileName}`;
  }

};
