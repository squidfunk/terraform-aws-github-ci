# Copyright (c) 2017-2018 Martin Donath <martin.donath@squidfunk.com>

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to
# deal in the Software without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
# sell copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.

# -----------------------------------------------------------------------------
# Data: General
# -----------------------------------------------------------------------------

# data.aws_region._
data "aws_region" "_" {}

# -----------------------------------------------------------------------------
# Data: GitHub
# -----------------------------------------------------------------------------

# data.template_file.codebuild_source_location.rendered
data "template_file" "codebuild_source_location" {
  template = "https://github.com/$${owner}/$${repository}.git"

  vars {
    owner      = "${var.github_owner}"
    repository = "${var.github_repository}"
  }
}

# -----------------------------------------------------------------------------
# Data: IAM
# -----------------------------------------------------------------------------

# data.template_file.codebuild_iam_policy.rendered
data "template_file" "codebuild_iam_policy" {
  template = "${file("${path.module}/iam/policies/codebuild.json")}"

  vars {
    bucket = "${aws_s3_bucket._.bucket}"
  }
}

# -----------------------------------------------------------------------------
# Resources: IAM
# -----------------------------------------------------------------------------

# aws_iam_role.codebuild
resource "aws_iam_role" "codebuild" {
  name = "${var.namespace}-codebuild"
  path = "/${var.namespace}/codebuild/"

  assume_role_policy = "${
    file("${path.module}/iam/policies/assume-role/codebuild.json")
  }"
}

# aws_iam_policy.codebuild
resource "aws_iam_policy" "codebuild" {
  name = "${var.namespace}-codebuild"
  path = "/${var.namespace}/codebuild/"

  policy = "${data.template_file.codebuild_iam_policy.rendered}"
}

# aws_iam_policy_attachment.codebuild
resource "aws_iam_policy_attachment" "codebuild" {
  name = "${var.namespace}-codebuild"

  policy_arn = "${aws_iam_policy.codebuild.arn}"
  roles      = ["${aws_iam_role.codebuild.name}"]
}

# -----------------------------------------------------------------------------
# Resources: S3
# -----------------------------------------------------------------------------

# aws_s3_bucket._
resource "aws_s3_bucket" "_" {
  bucket = "${coalesce(var.codebuild_bucket, var.namespace)}"
  acl    = "private"
}

# aws_s3_bucket_object._
resource "aws_s3_bucket_object" "_" {
  bucket        = "${aws_s3_bucket._.bucket}"
  key           = "${var.github_repository}/status.svg"
  source        = "${path.module}/share/assets/unknown.svg"
  acl           = "public-read"
  cache_control = "no-cache, no-store, must-revalidate"
  content_type  = "image/svg+xml"

  # Ignore, if there already is a status
  lifecycle {
    ignore_changes = ["*"]
  }
}

# -----------------------------------------------------------------------------
# Resources: CodeBuild
# -----------------------------------------------------------------------------

# aws_codebuild_project._
resource "aws_codebuild_project" "_" {
  count = "${length(var.codebuild_project) == 0 ? 1 : 0}"

  name = "${var.github_repository}"

  build_timeout = "5"
  service_role  = "${aws_iam_role.codebuild.arn}"

  source {
    type      = "GITHUB"
    location  = "${data.template_file.codebuild_source_location.rendered}"
    buildspec = "${var.codebuild_buildspec}"

    auth {
      type     = "OAUTH"
      resource = "${var.github_oauth_token}"
    }
  }

  environment {
    compute_type = "${var.codebuild_compute_type}"
    type         = "LINUX_CONTAINER"
    image        = "${var.codebuild_image}"
  }

  artifacts {
    type           = "S3"
    location       = "${aws_s3_bucket._.bucket}"
    name           = "${var.github_repository}"
    namespace_type = "BUILD_ID"
    packaging      = "ZIP"
  }
}

# -----------------------------------------------------------------------------
# Modules
# -----------------------------------------------------------------------------

# module.status
module "status" {
  source = "./modules/status"

  namespace = "${var.namespace}"

  github_owner       = "${var.github_owner}"
  github_repository  = "${var.github_repository}"
  github_oauth_token = "${var.github_oauth_token}"
  github_reporter    = "${var.github_reporter}"

  bucket = "${aws_s3_bucket._.bucket}"
}

# module.webhook
module "webhook" {
  source = "./modules/webhook"

  namespace = "${var.namespace}"

  github_owner       = "${var.github_owner}"
  github_repository  = "${var.github_repository}"
  github_oauth_token = "${var.github_oauth_token}"
  github_reporter    = "${var.github_reporter}"
}
