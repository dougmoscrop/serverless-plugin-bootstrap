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
                usage: 'The ID (ARN) of the ChangeSet to execute',
                required: true,
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
    const changeSetId = this.options['change-set'];

    if (typeof changeSetId === 'string') {
      return provider.request('CloudFormation', 'executeChangeSet', {
        ChangeSetName: changeSetId
      });
    }

    throw new Error('Bootstrap: You must specify a ChangeSet ID/ARN (serverless bootstrap execute --change-set {{changeSetId}})');
  }

  async check() {
    const { provider, serverless } = this;
    const { bootstrap = true } = this.options;

    if (bootstrap === false) {
      serverless.cli.log('WARNING: Skipping bootstrap check - your infrastructure might not match your code!');
      return Promise.resolve();
    }

    for await (const stack of this.stacks) {
      const stackName = this.getStackName(stack);

      const { changeSetName, changes } = await this.getChanges(stackName);

      if (changes.length > 0) {
        throw new Error(`The ${stackName} stack does not match the local template. Use the 'serverless bootstrap' command to view the diff and either update your source code or apply the changes`);
      }

      return provider.request('CloudFormation', 'deleteChangeSet', {
        StackName: stackName,
        ChangeSetName: changeSetName
      });
    }
  }

  async bootstrap() {
    const { provider, serverless } = this;

    for await (const stack of this.stacks) {
      const stackName = this.getStackName(stack);

      const { changeSetId, changes } = await this.getChanges(stackName, stack, true);

      if (changes.length > 0) {
        print(serverless, stackName, changeSetId, changes);
        return;
      } else {
        await provider.request('CloudFormation', 'deleteChangeSet', {
          StackName: stackName,
          ChangeSetName: changeSetId
        });
      }
    }

    serverless.cli.log('[serverless-plugin-bootstrap]: No changes.');
  }

  async getChanges(stackName, stack, detailed = false) {
    const { provider, serverless } = this;
    const { bucket, file, region, parameters, capabilities = [] } = stack;

    const roleArn = serverless.service.provider.cfnRole;
    const prefix = 'serverless-bootstrap-';
    const description = 'Created by the Serverless Bootstrap plugin';

    const template = serverless.utils.readFileSync(file);
    const credentials = this.getCredentials(provider);

    const bucketName = bucket || `${stackName}-resources`;
    const basedir = path.dirname(file);

    await pkg({ credentials, template, basedir, bucketName });

    return await diff({
      credentials, prefix, description, capabilities, stackName, roleArn, template, parameters, detailed
    });
  }

  getCredentials(provider, region = provider.getRegion()) {
    return { ...provider.getCredentials(), region };
  }

  getStackName({ stack, file }) {
    const { serverless } = this;
    const { service } = serverless;

    assert(file, 'serverless-plugin-bootstrap: must specify bootstrap file');

    const fileName = path.basename(file, path.extname(file));
    const serviceName = service.service;

    return stack || `${serviceName}-${fileName}`;
  }

  get stacks() {
    const { serverless } = this;
    const { service } = serverless;
    const { custom = {} } = service;
    const { bootstrap = {} } = custom;

    if (bootstrap) {
      return [].concat(bootstrap);
    } else {
      throw new Error('serverless-plugin-bootstrap: no bootstrap config in custom.bootstrap');
    }
  }

};
