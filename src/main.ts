/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';

import {
  getInput,
  info as logInfo,
  warning as logWarning,
  setFailed,
  setOutput,
} from '@actions/core';
import { getExecOutput } from '@actions/exec';
import { parseDeployResponse } from './output-parser';

import {
  getLatestGcloudSDKVersion,
  isInstalled as isGcloudInstalled,
  installGcloudSDK,
  authenticateGcloudSDK,
  getToolCommand,
} from '@google-github-actions/setup-cloud-sdk';

import {
  errorMessage,
  isPinnedToHead,
  parseBoolean,
  parseFlags,
  pinnedToHeadWarning,
  stubEnv,
} from '@google-github-actions/actions-utils';

// Do not listen to the linter - this can NOT be rewritten as an ES6 import statement.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: appVersion } = require('../package.json');

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  // Register metrics
  const restoreEnv = stubEnv({
    CLOUDSDK_METRICS_ENVIRONMENT: 'github-actions-deploy-appengine',
    CLOUDSDK_METRICS_ENVIRONMENT_VERSION: appVersion,
  });

  // Warn if pinned to HEAD
  if (isPinnedToHead()) {
    logWarning(pinnedToHeadWarning('v0'));
  }

  try {
    // Get action inputs.
    const projectId = getInput('project_id');
    const cwd = getInput('working_directory');
    const deliverables = getInput('deliverables');
    const imageUrl = getInput('image_url');
    const version = getInput('version');
    const promote = parseBoolean(getInput('promote'));
    const flags = getInput('flags');

    // Change working directory
    if (cwd) {
      logInfo(`Changing into working directory: ${cwd}`);
      process.chdir(cwd.trim());
    }

    // Validate deliverables
    const allDeliverables = deliverables.split(' ');
    if (allDeliverables[0] == '') allDeliverables[0] = 'app.yaml';
    for (const deliverable of allDeliverables) {
      if (!fs.existsSync(deliverable)) {
        const message =
          `Deliverable ${deliverable} can not be found. ` +
          'Check `working_directory` and `deliverables` input paths.';
        throw new Error(message);
      }
    }

    // Install gcloud if not already installed.
    if (!isGcloudInstalled()) {
      const gcloudVersion = await getLatestGcloudSDKVersion();
      await installGcloudSDK(gcloudVersion);
    }

    // Authenticate - this comes from google-github-actions/auth.
    const credFile = process.env.GOOGLE_GHA_CREDS_PATH;
    if (credFile) {
      await authenticateGcloudSDK(credFile);
      logInfo('Successfully authenticated');
    } else {
      logWarning(
        'No authentication found for appengine, authenticate with `google-github-actions/auth`.',
      );
    }

    const toolCommand = getToolCommand();

    // Create app engine gcloud cmd.
    let appDeployCmd = ['app', 'deploy', '--quiet', '--format', 'json', ...allDeliverables];

    // Add gcloud flags.
    if (projectId !== '') {
      appDeployCmd.push('--project', projectId);
    }
    if (imageUrl !== '') {
      appDeployCmd.push('--image-url', imageUrl);
    }
    if (version !== '') {
      appDeployCmd.push('--version', version);
    }
    if (promote) {
      appDeployCmd.push('--promote');
    } else {
      appDeployCmd.push('--no-promote');
    }

    // Add optional flags
    if (flags) {
      const flagList = parseFlags(flags);
      if (flagList) appDeployCmd = appDeployCmd.concat(flagList);
    }

    const options = { silent: true, ignoreReturnCode: true };
    const commandString = `${toolCommand} ${appDeployCmd.join(' ')}`;
    logInfo(`Running: ${commandString}`);

    // Get output of gcloud cmd.
    const output = await getExecOutput(toolCommand, appDeployCmd, options);
    if (output.exitCode !== 0) {
      const errMsg = output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
      throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
    }

    // Set url as output.
    const response = parseDeployResponse(output.stdout);
    if (response) {
      setOutput('name', response.name);
      setOutput('serviceAccountEmail', response.serviceAccountEmail);
      setOutput('versionURL', response.versionURL);
      setOutput('url', response.versionURL);
    } else {
      logWarning(`no outputs were set, this usually happens with --no-promote`);
    }
  } catch (err) {
    const msg = errorMessage(err);
    setFailed(`google-github-actions/deploy-appengine failed with: ${msg}`);
  } finally {
    restoreEnv();
  }
}

// Execute this as the entrypoint when requested.
if (require.main === module) {
  run();
}
