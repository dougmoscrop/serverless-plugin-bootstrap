'use strict';

const crypto = require('crypto');
const path = require('path');

module.exports = class BootstrapPlugin {

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');
    this.commands = {
      bootstrap: {
        usage: 'Create a Change Set for a given CloudFormation template',
        lifecycleEvents: [
          'bootstrap'
        ],
        options: {
          execute: {
            usage: 'Execute the created Change Set',
            default: false
          }
        }
      }
    };
    this.hooks = {
      'bootstrap:bootstrap': () => this.bootstrap(),
      'before:deploy:deploy': () => this.bootstrap()
    };
  }

  bootstrap() {
    const custom = this.serverless.service.custom || {};

    this.config = custom.bootstrap || {};

    if (!this.config.file) {
      throw new Error('serverless-plugin-bootstrap: must specify custom.bootstrap.file');
    }

    const template = this.serverless.utils.readFileSync(this.config.file);

    this.templateBody = JSON.stringify(template);
    this.stackName = this.getStackName();
    this.changeSetName = this.getChangeSetName();
    this.params = this.getChangeSetParams();

    return this.createChangeSet('UPDATE')
      .catch(e => {
        if (e.message.match(/does not exist/)) {
          return this.createChangeSet('CREATE');
        }
        throw e;
      })
      .then(res => {
        return this.getChanges(res);
      })
      .then(changes => {
        if (changes.length) {
          if (this.options.execute) {
            return this.provider.request('CloudFormation', 'executeChangeSet', {
              StackName: this.stackName,
              ChangeSetName: this.changeSetName
            });
          }

          return Promise.reject(
            `The stack ${this.stackName} does not match the local template. Review change set ${this.changeSetName} and either update your source code or execute the change set`
          );
        }

        return this.provider.request('CloudFormation', 'deleteChangeSet', {
          StackName: this.stackName,
          ChangeSetName: this.changeSetName
        });
      });
  }

  getChangeSetParams() {
    const capabilities = this.config.capabilities
      ? this.config.capabilities
      : [];

    const params = {
      StackName: this.stackName,
      ChangeSetName: this.changeSetName,
      Capabilities: capabilities,
      Description: 'Created by the serverless bootstrap plugin',
      RoleARN: this.serverless.service.provider.cfnRole,
      TemplateBody: this.templateBody,
    };

    if (this.config.parameters) {
      params.Parameters = this.config.parameters;
    }

    return params;
  }

  getStackName() {
    if (this.config.stack) {
      return this.config.stack;
    }

    const fileName = path.basename(this.config.file, path.extname(this.config.file));
    const serviceName = this.serverless.service.service;

    return `${serviceName}-${fileName}`;
  }

  getChangeSetName() {
    const parameters = this.config.parameters;

    const md5 = crypto.createHash('md5')
      .update(this.templateBody)
      .update(parameters ? JSON.stringify(parameters) : '')
      .digest('hex');

    return `serverless-bootstrap-${md5}`;
  }

  getChanges(res) {
    if (res.Status === 'FAILED') {
      if (res.StatusReason.match(/The submitted information didn't contain changes/)) {
        return [];
      }

      throw new Error(`createChangeSet FAILED: ${res.StatusReason}`);
    }

    if (res.Status === 'CREATE_COMPLETE') {
      return res.Changes;
    }

    throw new Error(`Expected res.Status to be CREATE_COMPLETE but got ${res.Status}`);
  }

  createChangeSet(changeSetType) {
    const params = Object.assign({}, this.params, { ChangeSetType: changeSetType });

    return this.provider.request('CloudFormation', 'createChangeSet', params)
      .then(res => {
        const credentials = this.provider.getCredentials();
        const cf = new this.provider.sdk.CloudFormation(credentials);

        return cf.waitFor('changeSetCreateComplete', {
          StackName: this.stackName,
          ChangeSetName: this.changeSetName,
          NextToken: res.NextToken
        })
        .promise()
        .catch(e => {
          if (e.message.match(/Resource is not in the state/)) {
            return this.provider.request('CloudFormation', 'describeChangeSet', {
              StackName: this.stackName,
              ChangeSetName: this.changeSetName
            });
          }
          throw e;
        });
      });
  }
};
