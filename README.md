# serverless-plugin-bootstrap

This plugin ensures that an additional CloudFormation stack has been configured before your serverless deploy. It does so using CloudFormation Change Sets, which let you review changes before applying them. The intention is that this is for things that need to be done once per region, as separate stacks are *not* created per stage.

## Usage

Assume you have an `account.json` file.

You could add this to your scripts before `serverless deploy`:

```bash
serverless bootstrap -f account.json
```

This will produce a CloudFormation Change Set of the differences between the local copy of account.json, and what is currently deployed in CloudFormation. If there is a difference, it throws an error (and thus would halt your deployment). This Change Set stays around - and the error message contains the name of the change set - and you can log in to the AWS console and review it. If it's appropriate, you can execute the change set from AWS and then re-run your build. Alternatively, the changes might be incorrect, and you need to pull in the latest version of what was deployed in to your code, so that your CI will proceed without finding any delta.

```bash
REGION=us-east-2
serverless bootstrap -f region/$REGION.json --region=$REGION
serverless deploy --region=$REGION
```

You can also configure bootstrap via `serverless.yml` which takes the same options as the command line. If this configuration is present, the bootstrap check will run `before:deploy:deploy`. You can disable this with `auto: false`.

## Options

### Stack Name

The name of the stack defaults to `{serviceName}-{fileName}` but can be overriden with the `--stack | -s` option.

### Capabilities

The `--iam` option adds the CAPABILITY_IAM to the deployed change set, which may be required depending on the resources you include.

The `--named_iam` option adds the CAPABILITY_NAMED_IAM to the deployed change set, which may be required depending on the resources you include.
