module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = require("aws-sdk");

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = require("github");

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _awsSdk = __webpack_require__(0);

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _github = __webpack_require__(1);

var _github2 = _interopRequireDefault(_github);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * Build manager
 *
 * @type {AWS.CodeBuild}
 */
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

const codebuild = new _awsSdk2.default.CodeBuild({ apiVersion: "2016-10-06" });

/**
 * GitHub client
 *
 * @type {GitHub}
 */
const github = new _github2.default();
if (process.env.GITHUB_OAUTH_TOKEN) github.authenticate({
  type: "oauth",
  token: process.env.GITHUB_OAUTH_TOKEN
});

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Run build on source change
 *
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */

exports.default = (event, context, cb) => {
  event.Records.reduce((promise, record) => {
    const type = record.Sns.MessageAttributes["X-Github-Event"].Value;
    const message = JSON.parse(record.Sns.Message);

    /* Retrieve commit SHA and reference */
    const [sha, ref] = type === "pull_request" ? [message.pull_request.head.sha, message.pull_request.head.ref] : [message.after, message.ref.replace("refs/heads/", "")];

    /* Return promise chain */
    return promise.then(() => {

      /* Start build for open pull request or master branch */
      if (type === "pull_request" && message.pull_request.state !== "closed" || type === "push" && ref === "master") {
        return new Promise((resolve, reject) => {
          codebuild.startBuild({
            projectName: message.repository.name,
            sourceVersion: sha,
            environmentVariablesOverride: [{
              name: "GIT_BRANCH",
              value: ref
            }, {
              name: "GIT_COMMIT",
              value: sha
            }]
          }, err => {
            return err ? reject(err) : resolve();
          });
        })

        /* Update commit SHA with pipeline state */
        .then(() => {
          return github.repos.createStatus({
            owner: message.repository.owner.login,
            repo: message.repository.name,
            sha,
            state: "pending",
            context: process.env.GITHUB_REPORTER,
            description: "Waiting for status to be reported"
          });
        });
      }
    });
  }, Promise.resolve())

  /* The event was processed */
  .then(data => cb(null, data))

  /* An error occurred */
  .catch(cb);
};

/***/ })
/******/ ]);