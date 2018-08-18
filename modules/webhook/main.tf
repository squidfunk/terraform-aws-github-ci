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

provider "github" {
  version      = "< 1.0.0"
  organization = "${var.github_owner}"
  token        = "${var.github_oauth_token}"
}

# -----------------------------------------------------------------------------
# Data: General
# -----------------------------------------------------------------------------

# data.aws_region._
data "aws_region" "_" {}

# -----------------------------------------------------------------------------
# Data: IAM
# -----------------------------------------------------------------------------

# data.template_file.lambda_iam_policy.rendered
data "template_file" "lambda_iam_policy" {
  template = "${file("${path.module}/iam/policies/lambda.json")}"
}

# data.template_file.webhook_iam_policy.rendered
data "template_file" "webhook_iam_policy" {
  template = "${file("${path.module}/iam/policies/webhook.json")}"

  vars {
    topic_arn = "${aws_sns_topic._.arn}"
  }
}

# -----------------------------------------------------------------------------
# Resources: IAM
# -----------------------------------------------------------------------------

# aws_iam_role.lambda
resource "aws_iam_role" "lambda" {
  name = "${var.namespace}-webhook-lambda"
  path = "/${var.namespace}/lambda/"

  assume_role_policy = "${
    file("${path.module}/iam/policies/assume-role/lambda.json")
  }"
}

# aws_iam_policy.lambda
resource "aws_iam_policy" "lambda" {
  name = "${var.namespace}-webhook-lambda"
  path = "/${var.namespace}/lambda/"

  policy = "${data.template_file.lambda_iam_policy.rendered}"
}

# aws_iam_policy_attachment.lambda
resource "aws_iam_policy_attachment" "lambda" {
  name = "${var.namespace}-webhook-lambda"

  policy_arn = "${aws_iam_policy.lambda.arn}"
  roles      = ["${aws_iam_role.lambda.name}"]
}

# -----------------------------------------------------------------------------

# aws_iam_user._
resource "aws_iam_user" "_" {
  name = "${var.namespace}-webhook"
  path = "/${var.namespace}/"
}

# aws_iam_access_key._
resource "aws_iam_access_key" "_" {
  user = "${aws_iam_user._.name}"
}

# aws_iam_user_policy._
resource "aws_iam_user_policy" "_" {
  name = "${var.namespace}-webhook"
  user = "${aws_iam_user._.name}"

  policy = "${data.template_file.webhook_iam_policy.rendered}"
}

# -----------------------------------------------------------------------------
# Resources: SNS
# -----------------------------------------------------------------------------

# aws_sns_topic._
resource "aws_sns_topic" "_" {
  name = "${var.namespace}-webhook"
}

# aws_sns_topic_subscription._
resource "aws_sns_topic_subscription" "_" {
  topic_arn = "${aws_sns_topic._.arn}"
  protocol  = "lambda"
  endpoint  = "${aws_lambda_function._.arn}"
}

# -----------------------------------------------------------------------------
# Resources: Lambda
# -----------------------------------------------------------------------------

# aws_lambda_function._
resource "aws_lambda_function" "_" {
  function_name = "${var.namespace}-webhook"
  role          = "${aws_iam_role.lambda.arn}"
  runtime       = "nodejs8.10"
  filename      = "${path.module}/lambda/dist.zip"
  handler       = "index.default"
  timeout       = 10

  source_code_hash = "${
    base64sha256(file("${path.module}/lambda/dist.zip"))
  }"

  environment {
    variables = {
      GITHUB_OAUTH_TOKEN = "${var.github_oauth_token}"
      GITHUB_REPORTER    = "${var.github_reporter}"
    }
  }
}

# aws_lambda_permission._
resource "aws_lambda_permission" "_" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function._.arn}"
  principal     = "sns.amazonaws.com"
  source_arn    = "${aws_sns_topic._.arn}"
}

# -----------------------------------------------------------------------------
# Resources: GitHub
# -----------------------------------------------------------------------------

# github_repository_webhook._
resource "github_repository_webhook" "_" {
  repository = "${var.github_repository}"
  name       = "amazonsns"

  configuration {
    aws_key    = "${aws_iam_access_key._.id}"
    aws_secret = "${aws_iam_access_key._.secret}"
    sns_topic  = "${aws_sns_topic._.arn}"
    sns_region = "${data.aws_region._.name}"
  }

  events = ["push", "pull_request"]

  # Ignore, if the webhook already exists
  lifecycle {
    ignore_changes = ["*"]
  }
}
