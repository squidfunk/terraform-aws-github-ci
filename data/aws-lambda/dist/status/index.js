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
/******/ 	return __webpack_require__(__webpack_require__.s = 3);
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
/* 2 */,
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _awsSdk = __webpack_require__(0);

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _github = __webpack_require__(1);

var _github2 = _interopRequireDefault(_github);

var _errored = __webpack_require__(4);

var _errored2 = _interopRequireDefault(_errored);

var _failing = __webpack_require__(5);

var _failing2 = _interopRequireDefault(_failing);

var _passing = __webpack_require__(6);

var _passing2 = _interopRequireDefault(_passing);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

  /**
   * GitHub state to badge mapping
   *
   * @const
   * @type {Object}
   */
}; /*
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

const BADGES = {
  success: _passing2.default,
  failure: _failing2.default,
  error: _errored2.default

  /* ----------------------------------------------------------------------------
   * Variables
   * ------------------------------------------------------------------------- */

  /**
   * S3 client
   *
   * @type {AWS.S3}
   */
};const s3 = new _awsSdk2.default.S3({ apiVersion: "2006-03-01" });

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
 * Update commit SHA with pipeline state
 *
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */

exports.default = (event, context, cb) => {
  const info = event.detail["additional-information"];

  /* Retrieve commit SHA, owner and repository */
  const sha = info["source-version"];
  const [, owner, repo] = /github.com\/([^/]+)\/([^/.]+)/.exec(info.source.location) || [];

  /* Resolve phase and state mapping */
  const phase = PHASES[event.detail["completed-phase"]] || {};
  let [state, description] = phase[event.detail["completed-phase-status"]] || [];

  /* Mark build successful in finalizing phase if no errors occured */
  if (event.detail["completed-phase"] === "FINALIZING") if (!info.phases.find(prev => {
    return prev["phase-type"] !== "COMPLETED" && prev["phase-status"] !== "SUCCEEDED";
  })) [state, description] = ["success", "Build successful"];

  /* Resolve build reference and run URL */
  const ref = info.environment["environment-variables"][0].value;
  const run = event.detail["build-id"].split(":").pop();
  const url = `https://console.aws.amazon.com/codebuild/home?region=${process.env.AWS_REGION}#/builds/${repo}:${run}/view/new`;

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
            Bucket: process.env.CODEBUILD_BUCKET,
            Key: `${repo}/status.svg`,
            Body: BADGES[state],
            ACL: "public-read",
            CacheControl: "no-cache, no-store, must-revalidate",
            ContentType: "image/svg+xml"
          }, err => {
            return err ? reject(err) : resolve();
          });
        } else {
          resolve();
        }
      });
    })

    /* The event was processed */
    .then(data => cb(null, data))

    /* An error occurred */
    .catch(cb);
  }
};

/***/ }),
/* 4 */
/***/ (function(module, exports) {

module.exports = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"88\" height=\"20\"><linearGradient id=\"b\" x2=\"0\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#bbb\" stop-opacity=\".1\"/><stop offset=\"1\" stop-opacity=\".1\"/></linearGradient><clipPath id=\"a\"><rect width=\"88\" height=\"20\" rx=\"3\" fill=\"#fff\"/></clipPath><g clip-path=\"url(#a)\"><path fill=\"#555\" d=\"M0 0h37v20H0z\"/><path fill=\"#e05d44\" d=\"M37 0h51v20H37z\"/><path fill=\"url(#b)\" d=\"M0 0h88v20H0z\"/></g><g fill=\"#fff\" text-anchor=\"middle\" font-family=\"DejaVu Sans,Verdana,Geneva,sans-serif\" font-size=\"110\"><text x=\"195\" y=\"150\" fill=\"#010101\" fill-opacity=\".3\" transform=\"scale(.1)\" textLength=\"270\">build</text><text x=\"195\" y=\"140\" transform=\"scale(.1)\" textLength=\"270\">build</text><text x=\"615\" y=\"150\" fill=\"#010101\" fill-opacity=\".3\" transform=\"scale(.1)\" textLength=\"410\">errored</text><text x=\"615\" y=\"140\" transform=\"scale(.1)\" textLength=\"410\">errored</text></g> </svg>"

/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"80\" height=\"20\"><linearGradient id=\"b\" x2=\"0\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#bbb\" stop-opacity=\".1\"/><stop offset=\"1\" stop-opacity=\".1\"/></linearGradient><clipPath id=\"a\"><rect width=\"80\" height=\"20\" rx=\"3\" fill=\"#fff\"/></clipPath><g clip-path=\"url(#a)\"><path fill=\"#555\" d=\"M0 0h37v20H0z\"/><path fill=\"#e05d44\" d=\"M37 0h43v20H37z\"/><path fill=\"url(#b)\" d=\"M0 0h80v20H0z\"/></g><g fill=\"#fff\" text-anchor=\"middle\" font-family=\"DejaVu Sans,Verdana,Geneva,sans-serif\" font-size=\"110\"><text x=\"195\" y=\"150\" fill=\"#010101\" fill-opacity=\".3\" transform=\"scale(.1)\" textLength=\"270\">build</text><text x=\"195\" y=\"140\" transform=\"scale(.1)\" textLength=\"270\">build</text><text x=\"575\" y=\"150\" fill=\"#010101\" fill-opacity=\".3\" transform=\"scale(.1)\" textLength=\"330\">failing</text><text x=\"575\" y=\"140\" transform=\"scale(.1)\" textLength=\"330\">failing</text></g> </svg>"

/***/ }),
/* 6 */
/***/ (function(module, exports) {

module.exports = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"88\" height=\"20\"><linearGradient id=\"b\" x2=\"0\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#bbb\" stop-opacity=\".1\"/><stop offset=\"1\" stop-opacity=\".1\"/></linearGradient><clipPath id=\"a\"><rect width=\"88\" height=\"20\" rx=\"3\" fill=\"#fff\"/></clipPath><g clip-path=\"url(#a)\"><path fill=\"#555\" d=\"M0 0h37v20H0z\"/><path fill=\"#4c1\" d=\"M37 0h51v20H37z\"/><path fill=\"url(#b)\" d=\"M0 0h88v20H0z\"/></g><g fill=\"#fff\" text-anchor=\"middle\" font-family=\"DejaVu Sans,Verdana,Geneva,sans-serif\" font-size=\"110\"><text x=\"195\" y=\"150\" fill=\"#010101\" fill-opacity=\".3\" transform=\"scale(.1)\" textLength=\"270\">build</text><text x=\"195\" y=\"140\" transform=\"scale(.1)\" textLength=\"270\">build</text><text x=\"615\" y=\"150\" fill=\"#010101\" fill-opacity=\".3\" transform=\"scale(.1)\" textLength=\"410\">passing</text><text x=\"615\" y=\"140\" transform=\"scale(.1)\" textLength=\"410\">passing</text></g> </svg>"

/***/ })
/******/ ]);