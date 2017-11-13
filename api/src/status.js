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
 * Target URL for CodePipeline
 *
 * @type {string}
 */
const TARGET = "https://console.aws.amazon.com/codepipeline/home"

/**
 * CodePipeline to GitHub state mapping
 *
 * @const
 * @type {Object}
 */
const STATES = {
  STARTED: "pending",
  SUCCEEDED: "success",
  RESUMED: "pending",
  FAILED: "failure",
  CANCELED: "error"
}

/**
 * Descriptions for states
 *
 * @const
 * @type {Object}
 */
const DESCRIPTIONS = {
  STARTED: "Build running",
  SUCCEEDED: "Build successful",
  RESUMED: "Build resumed",
  FAILED: "Build failed",
  CANCELED: "Build errored"
}

/**
 * Badges for states
 *
 * @const
 * @type {Object}
 */
const BADGES = {
  SUCCEEDED: passing,
  FAILED: failing,
  CANCELED: errored
}

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * Pipeline manager
 *
 * @type {AWS.CodePipeline}
 */
const manager = new AWS.CodePipeline({ apiVersion: "2015-07-09" })

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
  new Promise((resolve, reject) => {
    manager.getPipeline({
      name: event.detail.pipeline
    }, (err, data) => {
      return err
        ? reject(err)
        : resolve(data.pipeline)
    })
  })

    /* Get pipeline execution to retrieve commit SHA */
    .then(pipeline => {
      return new Promise((resolve, reject) => {
        manager.getPipelineExecution({
          pipelineName: pipeline.name,
          pipelineExecutionId: event.detail["execution-id"]
        }, (err, data) => {
          return err
            ? reject(err)
            : resolve({ pipeline, execution: data.pipelineExecution })
        })
      })
    })

    /* Update commit SHA with pipeline state */
    .then(({ pipeline, execution }) => {
      const url = `${TARGET}?region=${process.env.AWS_REGION}`
      return github.repos.createStatus({
        owner: pipeline.stages[0].actions[0].configuration.Owner,
        repo: pipeline.stages[0].actions[0].configuration.Repo,
        sha: execution.artifactRevisions[0].revisionId,
        state: STATES[event.detail.state],
        target_url: `${url}#/view/${pipeline.name}`, // eslint-disable-line
        context: process.env.GITHUB_REPORTER,
        description: DESCRIPTIONS[event.detail.state]
      })

        /* Pass branch to next task */
        .then(() => pipeline.stages[0].actions[0].configuration.Repo)
    })

    /* Update status badge on S3 */
    .then(branch => {
      return new Promise((resolve, reject) => {
        if (branch === "master" && BADGES[event.detail.state]) {
          s3.putObject({
            Bucket: process.env.STATUS_BUCKET,
            Key: `status/${event.detail.pipeline}.svg`,
            Body: BADGES[event.detail.state],
            ACL: "public-read",
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
