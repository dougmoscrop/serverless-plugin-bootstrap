# serverless-plugin-bootstrap

This plugin helps with ensuring that CloudFormation stacks that need to exist before your Serverless application are deployed and up-to-date.

## Breaking Changes in 2.0

- The stage name is included in the stack name by default now. You can still use this plugin to bootstrap a stack that is shared between several stacks, by specifying a `stack:` config that uses a name that does not include the stage.
- `noCheck` is now `--no-bootstrap`

## Usage

Within your `serverless.yml` you can configure bootstrap behavior:

```yml
service: foo

custom:
  bootstrap:
    file: "cloudformation/bootstrap.json"
    stackPolicy:
      - Effect: ''
        ...
      - Effect: ''
        ...
```

During a `serverless deploy`, this plugin will ensure that the stack `foo-bootstrap` exists and is up to date. If not, the deploy will fail. Upon failure, a CloudFormation Change Set will be left that you can review in the AWS console and execute. It's also possible your local copy of `bootsrap.json` is out of date, and you need to git pull/rebase.

This plugin also adds a command, `bootstrap`, which does the check without a deploy:

`serverless bootstrap`

The bootstrap command supports an optional `--execute` option, which will immediately apply the changes. This is most useful for the first time you are deploying, the rest of the time you should probably review the change set!

`serverless bootstrap policy`

The bootstrap policy sub command will set the stack policy from `custom.bootstrap.stackPolicy` in your serverless config. Check out AWS [example policies](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/protect-stack-resources.html#stack-policy-intro-example) for supported policy values.

## Options

The bootstrap config block supports the following additional keys as options:

`stack`: this overrides the stack name, which defaults to `${service}-${fileBaseNameWithoutExtension}`

> Note: By default the stack name is once-per-service (across stages - e.g. for API Gateway account level stuff).  This is likely going to change to per-stage in the next major version, but the stack name override will continue to allow per-service bootstraps.

`capabilities`: this is an array of capabilities, such as `CAPABILITY_IAM` or `CAPABILITY_NAMED_IAM` which may be required depending on the resources in your bootstrap template.

## bootstrap.json

The `bootstrap.json` (`yml` is also supported) file referenced above is a regular CloudFormation template. It is not parsed via Serverless, so no variable substitution is performed (you can use Parameters to pass info in to the stack, such as the stage or region).

For example, it might look like (as YAML):

```yml
---
AWSTemplateFormatVersion: "2010-09-09"

Description: >
  Bootstrap stack

Parameters:

  service:
    Description: Name of the service
    Type: String

  stage:
    Description: Usually one of test, stable or prod
    Type: String

Outputs:

  monitoringTopicARN:
      Description: ARN of the monitoring SNS topic
      Value:
        Ref: MonitoringTopic
      Export:
        Name:
          Fn::Sub: ${service}-${stage}-monitoring-topic-arn

Resources:

  MonitoringTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName:
        Fn::Sub: ${service}-${stage}-monitoring

  NestedStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: templates/nested-stack.yml
      Parameters:
        stage:
          Ref: stage
```

As you can see, `NestedStack` is an `AWS::CloudFormation::Stack`, a nested stack that is defined by a local file (relative path to this template file - ./templates/nested-stack)

This plugin will upload that template to S3 and replace the TemplateURL with the S3 URL -- similar to how the AWS CLI supports `aws cloudformation package`
