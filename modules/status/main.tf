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

# -----------------------------------------------------------------------------
# Data: IAM
# -----------------------------------------------------------------------------

# data.template_file.lambda_iam_policy.rendered
data "template_file" "lambda_iam_policy" {
  template = "${file("${path.root}/files/aws-iam/policies/lambda.json")}"

  vars {
    bucket = "${var.bucket}"
  }
}

# -----------------------------------------------------------------------------
# Resources: IAM
# -----------------------------------------------------------------------------

# aws_iam_role.lambda
resource "aws_iam_role" "lambda" {
  name = "${var.namespace}-lambda-cloudwatch"
  path = "/${var.namespace}/lambda/"

  assume_role_policy = "${
    file("${path.root}/files/aws-iam/policies/assume-role/lambda.json")
  }"
}

# aws_iam_policy.lambda
resource "aws_iam_policy" "lambda" {
  name = "${var.namespace}-lambda-cloudwatch"
  path = "/${var.namespace}/lambda/"

  policy = "${data.template_file.lambda_iam_policy.rendered}"
}

# aws_iam_policy_attachment.lambda
resource "aws_iam_policy_attachment" "lambda" {
  name = "${var.namespace}-lambda-cloudwatch"

  policy_arn = "${aws_iam_policy.lambda.arn}"
  roles      = ["${aws_iam_role.lambda.id}"]
}

# -----------------------------------------------------------------------------
# Resources: CloudWatch
# -----------------------------------------------------------------------------

# aws_cloudwatch_event_rule.status
resource "aws_cloudwatch_event_rule" "status" {
  name = "${var.namespace}-status"

  event_pattern = "${
    file("${path.root}/files/aws-cloudwatch/rules/codebuild.json")
  }"
}

# aws_cloudwatch_event_target.status
resource "aws_cloudwatch_event_target" "status" {
  rule = "${aws_cloudwatch_event_rule.status.name}"
  arn  = "${aws_lambda_function.status.arn}"
}

# -----------------------------------------------------------------------------
# Resources: Lambda
# -----------------------------------------------------------------------------

# aws_lambda_function.status
resource "aws_lambda_function" "status" {
  function_name = "${var.namespace}-status"
  role          = "${aws_iam_role.lambda.arn}"
  runtime       = "nodejs6.10"
  filename      = "${path.root}/files/aws-lambda/dist/status.zip"
  handler       = "index.default"
  timeout       = 10

  source_code_hash = "${
    base64sha256(file("${path.root}/files/aws-lambda/dist/status.zip"))
  }"

  environment {
    variables = {
      GITHUB_OAUTH_TOKEN = "${var.github_oauth_token}"
      GITHUB_REPORTER    = "${var.github_reporter}"
      CODEBUILD_BUCKET   = "${var.bucket}"
    }
  }
}

# aws_lambda_permission.status
resource "aws_lambda_permission" "status" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.status.arn}"
  principal     = "events.amazonaws.com"
  source_arn    = "${aws_cloudwatch_event_rule.status.arn}"
}
