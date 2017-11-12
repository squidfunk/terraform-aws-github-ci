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

/* ----------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

/**
 * Code pipeline to GitHub state mapping
 *
 * @const
 * @type {Object}
 */
const STATES = {
  STARTED: "pending",
  SUCCEEDED: "success",
  RESUMED: "pending",
  FAILED: "failure",
  CANCELED: "error",
  SUPERSEDED: "pending"
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
 * Currently, there's one design flaw: when multiple GitHub repositories are
 * built on AWS CodeBuild within the same namespace (default: github-ci),
 * the projects trigger the lambda functions of all other projects. For this
 * reason, there's a check for the name of the pipeline, aborting early.
 *
 * This could, in theory, be fixed, but it's rather complicated. The problem
 * lies in the CloudWatch rule event pattern - it should only trigger events
 * for all pipelines of this project. However, updating the pattern is not
 * atomic (thus maybe resulting in a race condition). Another strategy might
 * be to clone the CloudWatch event rule and target for each pipeline, but now
 * that's even more cleaning up. For this reason we just live with the problem
 * until someone has the time to fix it.
 *
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */
export default (event, context, cb) => {
  new Promise((resolve, reject) => {
    if (event.detail.pipeline.indexOf(process.env.GITHUB_REPOSITORY) === 0) {
      manager.getPipeline({
        name: event.detail.pipeline
      }, (err, data) => {
        return err
          ? reject(err)
          : resolve(data.pipeline)
      })

    /* Wrong pipeline */
    } else {
      resolve()
    }
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
            : resolve(data.pipelineExecution)
        })
      })
    })

    /* Update commit SHA with pipeline state */
    .then(execution => {
      return github.repos.createStatus({
        owner: process.env.GITHUB_ORGANIZATION,
        repo: process.env.GITHUB_REPOSITORY,
        sha: execution.artifactRevisions[0].revisionId,
        state: STATES[event.detail.state],
        description: process.env.GITHUB_BOT_NAME
      })
    })

    /* The event was processed */
    .then(data => cb(null, data))

    /* An error occurred */
    .catch(cb)
}
