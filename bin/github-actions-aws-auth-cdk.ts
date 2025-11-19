#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { GithubActionsAwsAuthCdkStack } from '../lib/github-actions-aws-auth-cdk-stack'

const app = new cdk.App()

const appEnv = {
  region: app.node.tryGetContext('awsRegion')
    ? app.node.tryGetContext('awsRegion')
    : process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
}

new GithubActionsAwsAuthCdkStack(app, 'GithubActionsAwsAuthCdkStack', {
  description:
    'This stack creates an OIDC provider and IAM roles needed for GitHub Actions to deploy to this AWS account.',
  env: appEnv,
  repositoryConfig: [
    {
      owner: app.node.tryGetContext('repoOwner'),
    },
  ],
})
