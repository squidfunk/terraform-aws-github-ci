# Copyright (c) 2017 Martin Donath <martin.donath@squidfunk.com>

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

provider "aws" {}

provider "github" {
  token        = "${var.github_oauth_token}"
  organization = "${var.github_owner}"
}

# -----------------------------------------------------------------------------
# Data: Credentials
# -----------------------------------------------------------------------------

# data.aws_region._
data "aws_region" "_" {
  current = true
}

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
  template = "${file("${path.module}/aws-iam/policies/codebuild.json")}"

  vars {
    bucket = "${aws_s3_bucket.codebuild.arn}"
  }
}

# data.template_file.codebuild_manager_iam_policy.rendered
data "template_file" "codebuild_manager_iam_policy" {
  template = "${file("${path.module}/aws-iam/policies/codebuild-manager.json")}"

  vars {
    bucket = "${aws_s3_bucket.codebuild.arn}"
  }
}

# data.template_file.webhook_iam_policy.rendered
data "template_file" "webhook_iam_policy" {
  template = "${file("${path.module}/aws-iam/policies/webhook.json")}"

  vars {
    topic = "${aws_sns_topic.webhook.arn}"
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
    file("${path.module}/aws-iam/policies/assume-role/codebuild.json")
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
  roles      = ["${aws_iam_role.codebuild.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codebuild_manager
resource "aws_iam_role" "codebuild_manager" {
  name = "${var.namespace}-codebuild-manager"
  path = "/${var.namespace}/codebuild/"

  assume_role_policy = "${
    file("${path.module}/aws-iam/policies/assume-role/codebuild-manager.json")
  }"
}

# aws_iam_policy.codebuild_manager
resource "aws_iam_policy" "codebuild_manager" {
  name = "${var.namespace}-codebuild-manager"
  path = "/${var.namespace}/codebuild/"

  policy = "${data.template_file.codebuild_manager_iam_policy.rendered}"
}

# aws_iam_policy_attachment.codebuild_manager
resource "aws_iam_policy_attachment" "codebuild_manager" {
  name = "${var.namespace}-codebuild-manager"

  policy_arn = "${aws_iam_policy.codebuild_manager.arn}"
  roles      = ["${aws_iam_role.codebuild_manager.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_user.webhook
resource "aws_iam_user" "webhook" {
  name = "${var.namespace}-webhook"
  path = "/${var.namespace}/codebuild/"
}

# aws_iam_access_key.webhook
resource "aws_iam_access_key" "webhook" {
  user = "${aws_iam_user.webhook.name}"
}

# aws_iam_user_policy.webhook
resource "aws_iam_user_policy" "webhook" {
  name = "${var.namespace}-webhook"
  user = "${aws_iam_user.webhook.name}"

  policy = "${data.template_file.webhook_iam_policy.rendered}"
}

# -----------------------------------------------------------------------------
# Resources: S3
# -----------------------------------------------------------------------------

# aws_s3_bucket.codebuild
resource "aws_s3_bucket" "codebuild" {
  bucket = "${coalesce(var.codebuild_bucket, var.namespace)}"
  acl    = "private"
}

# aws_s3_bucket_object.codebuild
resource "aws_s3_bucket_object" "codebuild" {
  bucket        = "${aws_s3_bucket.codebuild.bucket}"
  key           = "${var.github_repository}/status.svg"
  source        = "${path.module}/aws-lambda/src/status/unknown.svg"
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

# aws_codebuild_project.codebuild
resource "aws_codebuild_project" "codebuild" {
  count = "${signum(length(var.codebuild_project))}"

  name = "${var.github_repository}"

  build_timeout = "5"
  service_role  = "${aws_iam_role.codebuild.arn}"

  source {
    type     = "GITHUB"
    location = "${data.template_file.codebuild_source_location.rendered}"

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
    location       = "${aws_s3_bucket.codebuild.bucket}"
    name           = "${var.github_repository}"
    namespace_type = "BUILD_ID"
    packaging      = "ZIP"
  }
}

# -----------------------------------------------------------------------------
# Resources: CloudWatch
# -----------------------------------------------------------------------------

# aws_cloudwatch_event_rule.codebuild
resource "aws_cloudwatch_event_rule" "codebuild" {
  name = "${var.namespace}-codebuild"

  event_pattern = "${
    file("${path.module}/aws-cw/rules/codebuild.json")
  }"
}

# aws_cloudwatch_event_target.webhook_status
resource "aws_cloudwatch_event_target" "webhook_status" {
  rule = "${aws_cloudwatch_event_rule.codebuild.name}"
  arn  = "${aws_lambda_function.webhook_status.arn}"
}

# -----------------------------------------------------------------------------
# Resources: SNS
# -----------------------------------------------------------------------------

# aws_sns_topic.webhook
resource "aws_sns_topic" "webhook" {
  name = "${var.namespace}-webhook"
}

# aws_sns_topic_subscription.webhook
resource "aws_sns_topic_subscription" "webhook" {
  topic_arn = "${aws_sns_topic.webhook.arn}"
  protocol  = "lambda"
  endpoint  = "${aws_lambda_function.webhook_push.arn}"
}

# -----------------------------------------------------------------------------
# Resources: Lambda
# -----------------------------------------------------------------------------

# aws_lambda_function.webhook_push
resource "aws_lambda_function" "webhook_push" {
  function_name = "${var.namespace}-webhook-push"
  role          = "${aws_iam_role.codebuild_manager.arn}"
  runtime       = "nodejs6.10"
  filename      = "${path.module}/aws-lambda/dist/push.zip"
  handler       = "index.default"
  timeout       = 10

  source_code_hash = "${
    base64sha256(file("${path.module}/aws-lambda/dist/push.zip"))
  }"

  environment {
    variables = {
      GITHUB_OAUTH_TOKEN = "${var.github_oauth_token}"
      GITHUB_REPORTER    = "${var.github_reporter}"
    }
  }
}

# aws_lambda_permission.webhook_push
resource "aws_lambda_permission" "webhook_push" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.webhook_push.arn}"
  principal     = "sns.amazonaws.com"
  source_arn    = "${aws_sns_topic.webhook.arn}"
}

# -----------------------------------------------------------------------------

# aws_lambda_function.webhook_status
resource "aws_lambda_function" "webhook_status" {
  function_name = "${var.namespace}-webhook-status"
  role          = "${aws_iam_role.codebuild_manager.arn}"
  runtime       = "nodejs6.10"
  filename      = "${path.module}/aws-lambda/dist/status.zip"
  handler       = "index.default"
  timeout       = 10

  source_code_hash = "${
    base64sha256(file("${path.module}/aws-lambda/dist/status.zip"))
  }"

  environment {
    variables = {
      GITHUB_OAUTH_TOKEN = "${var.github_oauth_token}"
      GITHUB_REPORTER    = "${var.github_reporter}"
      STATUS_BUCKET      = "${aws_s3_bucket.codebuild.bucket}"
    }
  }
}

# aws_lambda_permission.webhook_status
resource "aws_lambda_permission" "webhook_status" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.webhook_status.arn}"
  principal     = "events.amazonaws.com"
  source_arn    = "${aws_cloudwatch_event_rule.codebuild.arn}"
}

# -----------------------------------------------------------------------------
# Resources: GitHub
# -----------------------------------------------------------------------------

# github_repository_webhook.webhook
resource "github_repository_webhook" "webhook" {
  repository = "${var.github_repository}"
  name       = "amazonsns"

  configuration {
    aws_key    = "${aws_iam_access_key.webhook.id}"
    aws_secret = "${aws_iam_access_key.webhook.secret}"
    sns_topic  = "${aws_sns_topic.webhook.arn}"
    sns_region = "${data.aws_region._.name}"
  }

  events = ["push", "pull_request"]
}
