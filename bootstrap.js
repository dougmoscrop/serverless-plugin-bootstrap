'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

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
          },
          noCheck: {
            usage: 'Skip checking changes',
            default: false
          },
          stackPolicyOverride: {
            usage: 'Path to file containing temporary stack policy to use while executing changes',
            default: null
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

    return this.packageLocalResources(template.Resources)
      .then(() => {
        this.templateBody = JSON.stringify(template);
        this.stackName = this.getStackName();
        this.changeSetName = this.getChangeSetName();
        this.params = this.getChangeSetParams();
        this.stackPolicyOverride = this.getStackPolicyOverride();

        return this.getChanges()
          .then(changes => {
            return this.getStackPolicy()
              .then(originalPolicy => {
                const stackPolicyDiffers = !!(this.config.stackPolicy && !_.isEqual(this.config.stackPolicy, originalPolicy));
                console.log(`Stack changed: ${!!changes}`);
                console.log(`Policy changed: ${stackPolicyDiffers}`);
                if (changes || stackPolicyDiffers) {
                  if (this.options.execute) {
                    if (changes) {
                      const finalStackPolicy = this.config.stackPolicy || originalPolicy;
                      return this.maybeSetStackPolicyOverride()
                        .then(() => this.executeChangeSet()) // TODO: Try restoring (but not setting?) policy if execution fails?
                        .then(() => this.getStackPolicy())
                        .then(currentStackPolicy => {
                            if (!_.isEqual(currentStackPolicy, finalStackPolicy)) {
                              return this.waitForExecuteComplete(changes.changeSetType)
                                .then(() => this.setStackPolicy(finalStackPolicy));
                            } else {
                              console.log('No need to set stack policy after changeset execution.');
                            }
                        });
                    } else {
                      console.log('No changes to stack except for policy');
                      return this.setStackPolicy(this.config.stackPolicy);
                    }
                  }
    
                  if (this.options.noCheck) {
                    return Promise.resolve();
                  }
    
                  const stackMessage = changes ?
                    `The stack ${this.stackName} does not match the local template. Review change set ${this.changeSetName} and either update your source code or execute the change set.` :
                    '';
                  // TODO: Display a diff of the stack policy?
                  const policyMessage = stackPolicyDiffers ?
                    `Stack policy for stack ${this.stackName} does not match the specified policy. Running bootstrap again with --execute will set the new policy (after executing any stack changes).` :
                    '';
                  return Promise.reject([stackMessage, policyMessage].filter(message => message.length).join(' '));
                }
              });
          });
        });
  }

  getChanges() {
    return this.getChangesOfType('UPDATE')
      .catch(e => {
        if (e.message.match(/does not exist/)) {
          return this.getChangesOfType('CREATE');
        }
        throw e;
      });
  }

  getChangesOfType(changeSetType) {
    return this.createChangeSet(changeSetType)
      .then(res => this.extractChanges(res))
      .then(changes =>
        changes.length > 0 ?
          { changes, changeSetType } :
          this.provider.request('CloudFormation', 'deleteChangeSet', {
            StackName: this.stackName,
            ChangeSetName: this.changeSetName
          })
          .then(() => null));
  }

  getStackPolicy() {
    return this.provider.request('CloudFormation', 'getStackPolicy', {
      StackName: this.stackName
    })
    .then(stackPolicyResponse => stackPolicyResponse.StackPolicyBody ? JSON.parse(stackPolicyResponse.StackPolicyBody) : null);
  }

  setStackPolicy(policy) {
    const stackPolicyBody = JSON.stringify(policy, null, 2)
    console.log('Setting stack policy');
    return this.provider.request('CloudFormation', 'setStackPolicy', {
      StackName: this.stackName,
      StackPolicyBody: stackPolicyBody
    });
  }

  maybeSetStackPolicyOverride() {
    if (!this.stackPolicyOverride) {
      console.log('No need to set stack policy override (none specified)')
      return Promise.resolve();
    }

    return this.getStackPolicy()
      .then(currentStackPolicy => {
        if (!currentStackPolicy && !this.config.stackPolicy) {
          throw new Error('Cannot specify stack policy override with no existing or configured stack policy');
        }

        if (!currentStackPolicy || !_.isEqual(currentStackPolicy, this.stackPolicyOverride)) {
          console.log('Setting stack policy override');
          return this.setStackPolicy(this.stackPolicyOverride);
        } else {
          console.log('No need to set stack policy override (same as current)')
          return Promise.resolve();
        }
      });
  }

  executeChangeSet() {
    console.log('Executing changeset...');
    return this.provider.request('CloudFormation', 'executeChangeSet', {
      StackName: this.stackName,
      ChangeSetName: this.changeSetName
    })
    .then(result => {
      console.log('Changeset execution initiated');
      return result;
    });
  }

  waitForExecuteComplete(changeSetType) {
    const waitStateForChangeSetType = {
      CREATE: "stackCreateComplete",
      UPDATE: "stackUpdateComplete"
    };
    const waitForState = waitStateForChangeSetType[changeSetType];
    console.log(`Waiting for changeset execution to complete (${waitForState})...`);
    const credentials = this.provider.getCredentials();
    const cf = new this.provider.sdk.CloudFormation(credentials);
    return cf.waitFor(waitForState, {
      StackName: this.stackName
    })
    .promise()
    .then(result => {
      console.log('Changeset execution complete');
      return result;
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

  getStackPolicyOverride() {
    if (!this.options.stackPolicyOverride) {
      return null;
    }
    const absolutePath = path.resolve(this.options.stackPolicyOverride);
    return require(absolutePath);
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

  extractChanges(res) {
    if (res.Status === 'FAILED') {
      if (res.StatusReason.match(/The submitted information didn't contain changes/)) {
        return [];
      }

      throw new Error(`createChangeSet FAILED: ${res.StatusReason}`);
    }

    if (res.Status === 'CREATE_COMPLETE') {
      return res.Changes.filter(change => {
        if (change.Type === 'Resource') {
          const resourceChange = change.ResourceChange;

          // CloudFormation Nested Stacks seem to always show up as 'Modify'
          // but when nothing has actually changed, Details is an array of Targets with no Name
          if (resourceChange.Action === 'Modify' && resourceChange.ResourceType === 'AWS::CloudFormation::Stack') {
            return resourceChange.Details.some(detail => detail.Target.Name);
          }
        }
        return true;
      });
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
            // TODO: NextToken support for large (> 1MB) changes
            return this.provider.request('CloudFormation', 'describeChangeSet', {
              StackName: this.stackName,
              ChangeSetName: this.changeSetName
            });
          }
          throw e;
        });
      });
  }

  packageLocalResources(resources = {}) {
    const bucket = `${this.config.stack}-resources`;

    const uploads = Object.keys(resources).reduce((memo, logicalId) => {
      const resource = resources[logicalId];
      const properties = resource.Properties;

      if (resource.Type === 'AWS::CloudFormation::Stack') {
        const url = properties.TemplateURL;
        
        if (!this.isRemote(url)) {
          memo.push(() => {
            return this.uploadResource(bucket, url)
              .then(newURL => {
                properties.TemplateURL = newURL;
              });
          });
        }
      }

      return memo;
    }, []);

    if (uploads.length > 0) {
      return this.ensureResourceBucketExists(bucket)
        .then(() => {
          return Promise.all(uploads.map(upload => upload()));
        });
    }
  
    return Promise.resolve();
  }

  isRemote(url) {
    return url && url.indexOf('https://') === 0;
  }

  // TODO: Even for remote resources, we should attach metadata about the template md5
  // to detect if it has changed

  ensureResourceBucketExists(bucket) {
    return this.provider.request('S3', 'headBucket', {
      Bucket: bucket
    })
    .then(() => false)
    .catch(e => {
      if (e.statusCode === 404) {
        return true;
      }
      if (e.providerError && e.providerError.statusCode === 404) {
        return true;
      }
      throw new Error('AWS Request Error determining if bootstrap resources bucket exists');
    })
    .then(create => {
      if (create) {
        return this.provider.request('S3', 'createBucket', {
          Bucket: bucket
        });
      }
    });
  }

  uploadResource(bucket, localFile) {
    const dir = path.dirname(this.config.file);
    const file = path.join(process.cwd(), dir, localFile);

    return new Promise((resolve, reject) => {
      const rs = fs.createReadStream(file);
      const hash = crypto.createHash('md5');

      rs.pipe(hash)
        .on('error', reject)
        .on('finish', () => {
          resolve(hash.read().toString('hex'));
        });
    })
    .then(hash => {
      const name = path.basename(file, path.extname(file));
      const key = `${name}-${hash}`;

      return this.provider.request('S3', 'headObject', {
        Bucket: bucket,
        Key: key
      })
      .then(() => false)
      .catch(e => {
        if (e.statusCode === 404) {
          return true;
        }
        if (e.providerError && e.providerError.statusCode === 404) {
          return true;
        }
        throw new Error('AWS Request Error determining if bootstrap resource already uploaded');
      })
      .then(upload => {
        if (upload) {
          return this.provider.request('S3', 'upload', {
            Bucket: bucket,
            Key: key,
            Body: fs.createReadStream(file)
          })
        }
      })
      .then(() => {
        return `https://s3.amazonaws.com/${bucket}/${key}`;
      });
    });
  }

};
