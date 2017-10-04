# serverless-plugin-bootstrap

This plugin helps bootstrap an AWS account and/or region prior to a serverless deployment. Stages within serverless are great, but there are some things in in AWS that are one per region or (rarely - but it happens) even one per account.

## Usage

Assume you have an `account.json` file which is something that needs to be done once per AWS account.

You could add this to your scripts before `serverless deploy`:

```bash
serverless bootstrap -f account.json
```

This will produce a CloudFormation Change Set of the differences between the local copy of account.json, and what is currently deployed in CloudFormation. If there is a difference, it throws an error (and thus would halt your deployment). This Change Set stays around - and the error message contains the name of the change set - and you can log in to the AWS console and review it. If it's appropriate, you can execute the change set from AWS and then re-run your build. Alternatively, the changes might be incorrect, and you need to pull in the latest version of what was deployed in to your code, so that your CI will proceed without finding any delta.

For account-level bootstrap, make sure you always use the same region. It's probably worth being explicit.

```bash
REGION=us-east-2
serverless bootstrap -f account.json --region=us-east-1 # always us-east-1 for the account
serverless bootstrap -f region/$REGION.json --region=$REGION
serverless deploy --region=$REGION
```

## Options

### Stack Name

The name of the stack defaults to `{serviceName}-{fileName}` but can be overriden with the `--name | -n` option.

### IAM Capability

The `--iam | -i` option adds the CAPABILITY_IAM to the deployed change set, which may be required depending on the resources you include.
