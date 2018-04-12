/*
 * Copyright (c) 2017-2018 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import * as GitHub from "github"

import { Callback, Context } from "aws-lambda"
import { S3 } from "aws-sdk"

import * as errored from "../assets/errored.svg"
import * as failing from "../assets/failing.svg"
import * as passing from "../assets/passing.svg"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * CodeBuild phase type
 */
export type CodeBuildPhaseType =
  "SUBMITTED" |                        /* Build submitted */
  "PROVISIONING" |                     /* Provisioning instance */
  "DOWNLOAD_SOURCE" |                  /* Checkout source repository */
  "INSTALL" |                          /* Build phase: install */
  "PRE_BUILD" |                        /* Build phase: pre-build */
  "BUILD" |                            /* Build phase: build */
  "POST_BUILD" |                       /* Build phase: post-build */
  "UPLOAD_ARTIFACTS" |                 /* Upload build artifacts */
  "FINALIZING" |                       /* Finalize build */
  "COMPLETED"                          /* Build completed */

/**
 * CodeBuild phase status
 */
export type CodeBuildPhaseStatus =
  "TIMED_OUT" |                        /* Build timed out */
  "STOPPED" |                          /* Build stopped */
  "FAILED" |                           /* Build failed */
  "SUCCEEDED" |                        /* Build succeeded */
  "FAULT" |                            /* Build system error */
  "CLIENT_ERROR"                       /* Client error */

/**
 * GitHub build status
 */
export type GitHubBuildStatus =
  "pending" |                          /* Build running */
  "success" |                          /* Build successful */
  "failure" |                          /* Build failed */
  "error"                              /* Build system error */

/**
 * GitHub build status to badge mapping
 */
export type GitHubBadgeMapping = {
  [type in GitHubBuildStatus]?: any
}

/**
 * CodeBuild phase type and status to GitHub build status mapping
 */
export type CodeBuildGitHubMapping = {
  [type in CodeBuildPhaseType]?: {
    [status in CodeBuildPhaseStatus]?: [GitHubBuildStatus, string]
  }
}

/* ------------------------------------------------------------------------- */

/**
 * CodeBuild phase change event
 */
export interface CodeBuildPhaseChange {
  "source": [
    "aws.codebuild"
  ],
  "detail-type": [
    "CodeBuild Build Phase Change"
  ],
  "detail": {
    "build-id": string
    "additional-information": {
      "environment": {
        "environment-variables": Array<{
          "name": string
          "value": string
        }>
      }
      "source-version": string
      "source": {
        "location": string
      },
      "phases": Array<{
        "phase-type": CodeBuildPhaseType
        "phase-status": CodeBuildPhaseStatus
      }>
    },
    "completed-phase": CodeBuildPhaseType
    "completed-phase-status": CodeBuildPhaseStatus
  }
}

/* ----------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

/**
 * Map CodeBuild phase type and status to GitHub build status
 */
const mapping: CodeBuildGitHubMapping = {
  SUBMITTED: {
    SUCCEEDED: ["pending", "Provisioning"]
  },
  INSTALL: {
    FAILED: ["error", "Provisioning failed"],
    SUCCEEDED: ["pending", "Build running"]
  },
  BUILD: {
    FAILED: ["failure", "Build failed"],
    FAULT: ["error", "Build errored"],
    STOPPED: ["error", "Build stopped"],
    TIMED_OUT: ["error", "Build timed out"]
  }
}

/**
 * GitHub build status to badge mapping
 */
const badges: GitHubBadgeMapping = {
  success: passing,
  failure: failing,
  error: errored
}

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * S3 client
 */
const s3 = new S3({ apiVersion: "2006-03-01" })

/**
 * GitHub client
 */
const github = new GitHub()
if (process.env.GITHUB_OAUTH_TOKEN)
  github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_OAUTH_TOKEN
  })

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Update commit SHA with pipeline state
 *
 * @param event - CodeBuild phase change event
 * @param context - Context
 * @param cb - Completion callback
 */
export default (event: CodeBuildPhaseChange, _: Context, cb: Callback) => {
  const info = event.detail["additional-information"]

  /* Retrieve commit SHA, owner and repository */
  const sha = info["source-version"]
  const [, owner, repo]: string[] = /github.com\/([^/]+)\/([^/.]+)/
    .exec(info.source.location) || []

  /* Resolve phase and state mapping */
  const phase = mapping[event.detail["completed-phase"]] || {}
  let [state, description] =
    phase[event.detail["completed-phase-status"]] || [undefined, undefined]

  /* Mark build successful in finalizing phase if no errors occured */
  if (event.detail["completed-phase"] === "FINALIZING")
    if (!info.phases.find(prev => {
      return prev["phase-type"]   !== "COMPLETED" &&
             prev["phase-status"] !== "SUCCEEDED"
    }))
      [state, description] = ["success", "Build successful"]

  /* Resolve build reference and run URL */
  const ref = info.environment["environment-variables"][0].value
  const run = event.detail["build-id"].split(":").pop()
  const url = `https://console.aws.amazon.com/codebuild/home?region=${
    process.env.AWS_REGION}#/builds/${repo}:${run}/view/new`

  /* Report current state and phase description, if any */
  if (state && description) {
    github.repos.createStatus({
      owner, repo, sha, state, description,
      target_url: url, // eslint-disable-line camelcase
      context: process.env.GITHUB_REPORTER
    })

      /* Update status badge on S3 */
      .then(() => {
        return new Promise((resolve, reject) => {
          if (ref === "master" && badges[state!]) {
            s3.putObject({
              Bucket: process.env.CODEBUILD_BUCKET!,
              Key: `${repo}/status.svg`,
              Body: badges[state!],
              ACL: "public-read",
              CacheControl: "no-cache, no-store, must-revalidate",
              ContentType: "image/svg+xml"
            }, err => {
              return err
                ? reject(err)
                : resolve()
            })
          } else {
            resolve()
          }
        })
      })

      /* The event was processed */
      .then(data => cb(undefined, data))

      /* An error occurred */
      .catch(cb)
  }
}
