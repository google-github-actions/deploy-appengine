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
  exportVariable,
  info as logInfo,
  warning as logWarning,
  setFailed,
  setOutput,
} from '@actions/core';
import { getExecOutput } from '@actions/exec';

import {
  getLatestGcloudSDKVersion,
  isInstalled as isGcloudSDKInstalled,
  installGcloudSDK,
  parseServiceAccountKey,
  authenticateGcloudSDK,
  isAuthenticated,
  getToolCommand,
} from '@google-github-actions/setup-cloud-sdk';

import {
  errorMessage,
  isPinnedToHead,
  parseFlags,
  pinnedToHeadWarning,
} from '@google-github-actions/actions-utils';

export const GCLOUD_METRICS_ENV_VAR = 'CLOUDSDK_METRICS_ENVIRONMENT';
export const GCLOUD_METRICS_LABEL = 'github-actions-deploy-appengine';

export function setUrlOutput(output: string): string | undefined {
  // regex to match Cloud Run URLs
  const urlMatch = output.match(/(?<=target url:\s+\[)(.*?)(?=\])/g);
  //(?<=is \()(.*?)(?=\s*\))
  if (!urlMatch) {
    logWarning('Can not find URL.');
    return undefined;
  }
  // Match "tagged" URL or default to service URL
  const url = urlMatch.length > 1 ? urlMatch[1] : urlMatch[0];
  setOutput('url', url);
  return url;
}

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  try {
    // Register metrics
    exportVariable(GCLOUD_METRICS_ENV_VAR, GCLOUD_METRICS_LABEL);

    // Warn if pinned to HEAD
    if (isPinnedToHead()) {
      logWarning(pinnedToHeadWarning('v0'));
    }

    // Get action inputs.
    let projectId = getInput('project_id');
    const cwd = getInput('working_directory');
    const deliverables = getInput('deliverables');
    const imageUrl = getInput('image_url');
    const version = getInput('version');
    const promote = getInput('promote');
    const credentials = getInput('credentials');
    const flags = getInput('flags');

    // Add warning if using credentials
    if (credentials) {
      logWarning(
        'The "credentials" input is deprecated. ' +
          'Please switch to using google-github-actions/auth which supports both Workload Identity Federation and JSON Key authentication. ' +
          'For more details, see https://github.com/google-github-actions/deploy-appengine#authorization',
      );
    }

    // Change working directory
    if (cwd) process.chdir(cwd.trim());

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
    if (!isGcloudSDKInstalled()) {
      const gcloudVersion = await getLatestGcloudSDKVersion();
      await installGcloudSDK(gcloudVersion);
    }

    // Either credentials or GOOGLE_GHA_CREDS_PATH env var required
    if (credentials || process.env.GOOGLE_GHA_CREDS_PATH) {
      await authenticateGcloudSDK(credentials);
    }
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      throw new Error('Error authenticating the Cloud SDK.');
    }

    // set PROJECT ID
    if (!projectId) {
      if (credentials) {
        logInfo(`Extracting project ID from service account key`);
        const key = parseServiceAccountKey(credentials);
        projectId = key.project_id;
      } else if (process.env.GCLOUD_PROJECT) {
        logInfo(`Extracting project ID $GCLOUD_PROJECT`);
        projectId = process.env.GCLOUD_PROJECT;
      }
    }

    const toolCommand = getToolCommand();

    // Create app engine gcloud cmd.
    let appDeployCmd = ['app', 'deploy', '--quiet', ...allDeliverables];

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
    if (promote === '' || String(promote).toLowerCase() === 'true') {
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
    // TODO: update this to use JSON or YAML machine-readable output instead.
    setUrlOutput(output.stdout + output.stderr);
  } catch (err) {
    const msg = errorMessage(err);
    setFailed(`google-github-actions/deploy-appengine failed with: ${msg}`);
  }
}

// Execute this as the entrypoint when requested.
if (require.main === module) {
  run();
}
