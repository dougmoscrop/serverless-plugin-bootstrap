'use strict';

const assert = require('assert');
const path = require('path');

const pkg = require('@cfn/pkg');
const diff = require('@cfn/diff');

const { printChanges, printStackPolicy } = require('./print');

module.exports = class BootstrapPlugin {

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');
    this.commands = {
      bootstrap: {
        usage: 'Manages a CloudFormation Stack that complements the main Serverless Stack',
        options: {
          execute: {
            usage: 'Auto-execute changes and wait for them to complete',
            type: 'boolean'
          },
        },
        lifecycleEvents: ['bootstrap'],
        commands: {
          remove: {
            usage: 'Remove the bootstrap stack',
            options: {
              wait: {
                usage: 'Wait for the stack to remove',
                type: 'boolean',
              }
            },
            lifecycleEvents: ['remove']
          },
          execute: {
            usage: 'Execute a ChangeSet',
            options: {
              ['change-set']: {
                usage: 'The name of the ChangeSet to execute',
                required: true,
                type: 'string',
              },
              wait: {
                usage: 'Wait for the change set to execute',
                type: 'boolean',
              }
            },
            lifecycleEvents: ['execute']
          },
          policy: {
            usage: 'Applies a policy to the bootstrap stack',
            lifecycleEvents: ['policy']
          }
        }
      },
      deploy: {
        options: {
          bootstrap: {
            usage: 'Whether or not to check the bootstrap stack for changes (default to true, use --no-bootstrap to disable)',
            type: 'boolean'
          },
          execute: {
            usage: 'Auto-execute changes and wait for them to complete',
            type: 'boolean'
          },
        }
      }
    };
    this.hooks = {
      'bootstrap:bootstrap': () => this.bootstrap(),
      'bootstrap:remove:remove': () => this.remove(),
      'bootstrap:execute:execute': () => this.execute(),
      'bootstrap:policy:policy': () => this.updateStackPolicy(),
      'before:deploy:deploy': () => this.check()
    };
  }

  execute() {
    const changeSetName = this.options['change-set'];
    const { wait } = this.getConfig()

    if (typeof changeSetName === 'string') {
      return this.executeChangeSet(changeSetName, wait)
    }

    throw new Error('Bootstrap: You must specify a ChangeSet name (serverless bootstrap execute --change-set {{changeSetName}})');
  }

  async remove() {
    const { provider, serverless } = this;
    const stackName = this.getStackName();

    await provider.request('CloudFormation', 'deleteStack', {
      StackName: stackName,
    })

    const { wait = true } = this.getConfig()

    if (wait) {
      try {
        serverless.cli.log('[serverless-plugin-bootstrap]: Waiting for stack to delete..');
        await this.waitForStack()
      } catch (err) {
        if (err.message.indexOf('does not exist') === -1) {
          throw err;
        }
      }
      serverless.cli.log('[serverless-plugin-bootstrap]: Delete complete.');
    }
  }

  check() {
    const { provider, serverless } = this;
    const { bootstrap = true } = this.options;
    const { execute } = this.getConfig()

    if (bootstrap === false) {
      serverless.cli.log('WARNING: Skipping bootstrap check - your infrastructure might not match your code!');
      return Promise.resolve();
    }

    const stackName = this.getStackName();

    return this.getChanges(stackName)
      .then(({ changeSetName, changes }) => {
        if (changes.length > 0) {
          if (execute) {
            return this.executeChangeSet(changeSetName, true)
          }

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
    const { execute } = this.getConfig()

    return this.getChanges(stackName, true)
      .then(({ changeSetName, changes }) => {
        if (changes.length > 0) {
          if (execute) {
            return this.executeChangeSet(changeSetName, true)
          } else {
            return printChanges(serverless, stackName, changeSetName, changes);
          }
        } else {
          serverless.cli.log('[serverless-plugin-bootstrap]: No changes.');

          return provider.request('CloudFormation', 'deleteChangeSet', {
            StackName: stackName,
            ChangeSetName: changeSetName
          })
        }
      });
  }

  async executeChangeSet(changeSetName, waitForComplete = false) {
    const { provider, serverless } = this;
    const stackName = this.getStackName();

    await provider.request('CloudFormation', 'executeChangeSet', {
      StackName: stackName,
      ChangeSetName: changeSetName
    })

    if (waitForComplete) {
      serverless.cli.log('[serverless-plugin-bootstrap]: Waiting for change set to execute..');
      await this.waitForStack();
    }

    serverless.cli.log('[serverless-plugin-bootstrap]: Execute complete.');
  }

  async waitForStack() {
    const { provider } = this;
    const stackName = this.getStackName();

    let status = ''

    while (status.indexOf('COMPLETE') === -1) {
      await new Promise(resolve => {
        setTimeout(resolve, 5000)
      })

      const { Stacks } = await provider.request('CloudFormation', 'describeStacks', {
        StackName: stackName,
      })

      if (Stacks.length > 0) {
        status = Stacks[0].StackStatus
      }
    }

    if (status.indexOf('ROLLBACK') !== -1) {
      throw new Error(`Stack ${stackName} status is in rollback: ${status}`)
    }
  }

  updateStackPolicy() {
    const { provider, serverless } = this;
    const { service } = serverless;
    const { custom = {} } = service;
    const { bootstrap = {} } = custom;
    const { stackPolicy = null } = bootstrap;
    const stackName = this.getStackName();

    if (!stackPolicy) {
      throw new Error('Must add \'stackPolicy\' to the bootstrap configuration.');
    }

    const statement = [].concat(stackPolicy);

    printStackPolicy(serverless, stackName, statement);

    return provider.request('CloudFormation', 'setStackPolicy', {
      StackName: stackName,
      StackPolicyBody: JSON.stringify({ Statement: statement })
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
    const credentials = this.getCredentials(provider);

    const bucketName = bucket || `${stackName}-resources`;
    const basedir = path.dirname(file);

    const { deploymentBucketObject = {} } = service.provider;
    const { blockPublicAccess } = deploymentBucketObject;

    return pkg({ credentials, template, basedir, bucketName, blockPublicAccess })
      .then(() => {
        const options = {
          credentials, prefix, description, capabilities, stackName, roleArn, template, parameters, detailed
        };
        return diff(options);
      });
  }

  getCredentials(provider) {
    const credentials = provider.getCredentials();
    const region = provider.getRegion();
    credentials.region = region;
    return credentials;
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

  getConfig() {
    const { serverless } = this;
    const { service } = serverless;
    const { custom = {} } = service;
    const { bootstrap = {} } = custom;

    return Object.assign(bootstrap, this.options)
  }

};
