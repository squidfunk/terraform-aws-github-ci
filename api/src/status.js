/*
 * Copyright (c) 2017 Martin Donath <martin.donath@squidfunk.com>
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

import AWS from "aws-sdk"
import GitHub from "github"

import errored from "./status/errored.svg"
import failing from "./status/failing.svg"
import passing from "./status/passing.svg"

/* ----------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

/**
 * Status transitions for phases
 *
 * @type {Object}
 */
const PHASES = {
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
 * GitHub state to badge mapping
 *
 * @const
 * @type {Object}
 */
const BADGES = {
  success: passing,
  failure: failing,
  error: errored
}

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * S3 client
 *
 * @type {AWS}
 */
const s3 = new AWS.S3({ apiVersion: "2006-03-01" })

/**
 * GitHub client
 *
 * @type {AWS.GitHub}
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
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */
export default (event, context, cb) => {
  const info = event.detail["additional-information"]

  /* Retrieve commit SHA, owner and repository */
  const sha = info["source-version"]
  const [, owner, repo] = /github.com\/([^/]+)\/([^/.]+)/
    .exec(info.source.location) || []

  /* Resolve phase and state mapping */
  const phase = PHASES[event.detail["completed-phase"]] || {}
  let [state, description] =
    phase[event.detail["completed-phase-status"]] || []

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
          if (ref === "master" && BADGES[state]) {
            s3.putObject({
              Bucket: process.env.STATUS_BUCKET,
              Key: `${repo}/status.svg`,
              Body: BADGES[state],
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
      .then(data => cb(null, data))

      /* An error occurred */
      .catch(cb)
  }
}
