# Contributing

Open an issue for bugs or proposed changes. Include reproduction steps and error output.

For a pull request, keep changes focused and run:

```sh
npm ci
npm run build
npm test
npm run format:check
npm run cdk -- synth -c repoOwner=example -c repoOwnerId=1
```

Update the README and context template when configuration or usage changes. Review synthesized IAM permissions when changing the stack.

Do not post credentials, sensitive account details, or exploit details in public issues. This repository is an independently maintained fork; AWS does not maintain its changes.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [LICENSE](LICENSE).
