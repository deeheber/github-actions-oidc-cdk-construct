import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { describe, expect, test } from 'vitest'
import {
  GithubActionsAwsAuthCdkStack,
  type GithubActionsAwsAuthCdkStackProps,
} from '../lib/github-actions-aws-auth-cdk-stack'

function templateFor(
  repositoryConfig: GithubActionsAwsAuthCdkStackProps['repositoryConfig'] = [
    { owner: 'example', ownerId: '123' },
  ],
) {
  return Template.fromStack(
    new GithubActionsAwsAuthCdkStack(new App(), 'TestStack', {
      repositoryConfig,
    }),
  )
}

function subjects(template: Template): string[] {
  const [role] = Object.values(template.findResources('AWS::IAM::Role'))
  return role.Properties.AssumeRolePolicyDocument.Statement[0].Condition
    .StringLike['token.actions.githubusercontent.com:sub']
}

test('creates a native GitHub provider and a power-user deployment role', () => {
  const template = templateFor()
  template.resourceCountIs('AWS::IAM::OIDCProvider', 1)
  template.resourceCountIs('AWS::IAM::Role', 1)
  template.resourceCountIs('AWS::Lambda::Function', 0)
  expect(
    Object.values(template.toJSON().Resources).some((resource: any) =>
      resource.Type.startsWith('Custom::'),
    ),
  ).toBe(false)
  template.hasResourceProperties('AWS::IAM::OIDCProvider', {
    Url: 'https://token.actions.githubusercontent.com',
    ClientIdList: ['sts.amazonaws.com'],
  })
  const [providerId] = Object.keys(
    template.findResources('AWS::IAM::OIDCProvider'),
  )
  const [roleId] = Object.keys(template.findResources('AWS::IAM::Role'))
  template.hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'githubActionsDeployRole',
    MaxSessionDuration: 43200,
    ManagedPolicyArns: [
      {
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':iam::aws:policy/PowerUserAccess',
          ],
        ],
      },
    ],
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRoleWithWebIdentity',
          Effect: 'Allow',
          Principal: { Federated: { Ref: providerId } },
          Condition: {
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            },
            StringLike: {
              'token.actions.githubusercontent.com:sub': [
                'repo:example/*',
                'repo:example@123/*',
              ],
            },
          },
        },
      ],
    },
  })
  template.hasOutput('GithubActionOidcIamRoleArn', {
    Value: { 'Fn::GetAtt': [roleId, 'Arn'] },
    Export: { Name: 'GithubActionOidcIamRoleArn' },
  })
})

test('includes both subject formats for every configured owner', () => {
  expect(
    subjects(
      templateFor([
        { owner: 'example', ownerId: '123' },
        { owner: 'another-owner', ownerId: '456' },
      ]),
    ),
  ).toEqual([
    'repo:example/*',
    'repo:example@123/*',
    'repo:another-owner/*',
    'repo:another-owner@456/*',
  ])
})

test('subject patterns cover both formats without admitting other owners or IDs', () => {
  // Exercise the emitted patterns; this is not a live IAM authorization test.
  const patterns = subjects(templateFor()).map(
    (pattern) =>
      new RegExp(
        '^' +
          pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$',
      ),
  )
  const matches = (subject: string) =>
    patterns.some((pattern) => pattern.test(subject))
  for (const repo of ['example/repo', 'example@123/repo@789']) {
    for (const suffix of [
      'ref:refs/heads/main',
      'pull_request',
      'environment:dev',
    ]) {
      expect(matches(`repo:${repo}:${suffix}`)).toBe(true)
    }
  }
  for (const repo of [
    'other/repo',
    'example2/repo',
    'example@124/repo@789',
    'example@1234/repo@789',
  ]) {
    expect(matches(`repo:${repo}:environment:dev`)).toBe(false)
  }
})

describe('configuration validation', () => {
  const invalidConfigs = [
    { name: 'missing list', config: undefined, message: 'repositoryConfig' },
    { name: 'empty list', config: [], message: 'repositoryConfig' },
    { name: 'null entry', config: [null], message: 'repoOwner must' },
    ...[
      undefined,
      '',
      ' ',
      '*',
      'example?',
      'example/repo',
      'example@123',
      'example:repo',
      'a'.repeat(40),
    ].map((owner) => ({
      name: `owner ${JSON.stringify(owner)}`,
      config: [{ owner, ownerId: '123' }],
      message: 'repoOwner must',
    })),
    ...[undefined, '', '0', '-1', '12.3', 'abc', 123].map((ownerId) => ({
      name: `owner ID ${JSON.stringify(ownerId)}`,
      config: [{ owner: 'example', ownerId }],
      message: 'repoOwnerId must',
    })),
  ]

  test.each(invalidConfigs)('rejects $name', ({ config, message }) => {
    expect(
      () =>
        new GithubActionsAwsAuthCdkStack(new App(), 'Invalid', {
          repositoryConfig:
            config as GithubActionsAwsAuthCdkStackProps['repositoryConfig'],
        }),
    ).toThrow(message)
  })
})
