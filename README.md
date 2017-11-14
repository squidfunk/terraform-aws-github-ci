[![Travis][travis-image]][travis-link]

  [travis-image]: https://travis-ci.org/squidfunk/terraform-aws-github-ci.svg?branch=master
  [travis-link]: https://travis-ci.org/squidfunk/terraform-aws-github-ci

# Terraform AWS GitHub CI

A Terraform module to setup a GitHub CI server with pull request and build
status support using AWS CodeBuild.

## Architecture

![Architecture][1]

  [1]: assets/architecture.png

This module registers a GitHub webhook which is triggered for `push` and
`pull_request` events and starts the build for the respective branch. All
builds run in parallel. The build progress and status for a respective commit
is reported back to GitHub. Furthermore, a badge for the status of `master` is
generated and hosted on S3.

## Usage

Include and configure this module in your Terraform configuration:

``` hcl
module "github_ci" {
  source = "git::https://github.com/squidfunk/terraform-aws-github-ci.git"

  codebuild_bucket  = "github-ci"
  github_owner      = "squidfunk"
  github_repository = "mkdocs-material"
}
```

After applying your configuration, a status badge can be added to your project's
README using the `codebuild_badge` and `codebuild_url` outputs printed to the
terminal.

## Configuration

The following parameters can be configured:

### Required

#### `github_owner`

- **Description**: GitHub repository owner
- **Default**: `none`

#### `github_repository`

- **Description**: GitHub repository name
- **Default**: `none`

#### `codebuild_bucket`

- **Description**: S3 bucket to store status badge and artifacts
- **Default**: `none`

### Optional

#### `github_reporter`

- **Description**: GitHub commit status reporter
- **Default**: `"AWS CodeBuild"`

#### `github_oauth_token`

- **Description**: GitHub OAuth token for repository access
- **Default**: `""`


#### `codebuild_compute_type`

- **Description**: Compute resources used by the build
- **Default**: `"BUILD_GENERAL1_SMALL"`

#### `codebuild_image`

- **Description**: Base image for provisioning (AWS Registry, Docker)
- **Default**: `"aws/codebuild/ubuntu-base:14.04"`

#### `namespace`

- **Description**: AWS resource namespace/prefix
- **Default**: `"github-ci"`

## License

**MIT License**

Copyright (c) 2017 Martin Donath

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
