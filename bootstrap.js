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
        usage: 'Calculate a Change Set for a given bootstrap template and error if it has any changes for review',
        lifecycleEvents: [
          'check'
        ],
        options: {
          file: {
            shortcut: 'f',
            usage: 'JSON file that contains the CloudFormation template for the bootstrap stack',
            required: true
          },
          iam: {
            shortcut: 'i',
            usage: 'Include CAPABILITY_IAM on the Change Set',
            default: false
          },
          name: {
            shortcut: 'n',
            usage: 'Override the name of the CloudFormation stack being bootstrapped'
          }
        }
      }
    };
    this.hooks = {
      'bootstrap:check': () => this.check()
    };
  }

  check() {
    const template = this.serverless.utils.readFileSync(this.options.file);

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
          throw new Error(`The stack ${this.stackName} does not match the local template. Review change set ${this.changeSetName} and either update your source code or execute the change set`);
        }

        return this.provider.request('CloudFormation', 'deleteChangeSet', {
          StackName: this.stackName,
          ChangeSetName: this.changeSetName
        });
      });
  }

  getChangeSetParams() {
    const capabilities = [];

    if (this.options.iam) {
      capabilities.push('CAPABILITY_IAM');
    }

    return {
      StackName: this.stackName,
      ChangeSetName: this.changeSetName,
      Capabilities: capabilities,
      Description: 'Created by the serverless bootstrap plugin',
      RoleARN: this.serverless.service.provider.cfnRole,
      TemplateBody: this.templateBody
    };
  }

  getStackName() {
    if (this.options.name) {
      return this.options.name;
    }

    const fileName = path.basename(this.options.file, path.extname(this.options.file));
    const serviceName = this.serverless.service.service;

    return `${serviceName}-${fileName}`;
  }

  getChangeSetName() {
    const md5 = crypto.createHash('md5')
      .update(this.templateBody)
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
