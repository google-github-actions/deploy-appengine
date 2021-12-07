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

import {
  getInput,
  exportVariable,
  info as logInfo,
  warning as logWarning,
  setFailed,
  setOutput,
} from '@actions/core';
import { exec } from '@actions/exec';
import {
  getLatestGcloudSDKVersion,
  isInstalled as isGcloudSDKInstalled,
  installGcloudSDK,
  isProjectIdSet,
  setProject,
  authenticateGcloudSDK,
  setProjectWithKey,
  isAuthenticated,
  getToolCommand,
} from '@google-github-actions/setup-cloud-sdk';
import fs from 'fs';

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

export function parseFlags(flags: string): RegExpMatchArray | null {
  return flags.match(/(".*?"|[^"\s=]+)+(?=\s*|\s*$)/g); // Split on space or "=" if not in quotes
}

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  exportVariable(GCLOUD_METRICS_ENV_VAR, GCLOUD_METRICS_LABEL);
  try {
    // Get action inputs.
    let projectId = getInput('project_id');
    const cwd = getInput('working_directory');
    const deliverables = getInput('deliverables');
    const imageUrl = getInput('image_url');
    const version = getInput('version');
    const promote = getInput('promote');
    const serviceAccountKey = getInput('credentials');
    const flags = getInput('flags');

    // Add warning if using credentials
    if (serviceAccountKey) {
      logWarning(
        '"credentials" input has been deprecated. ' +
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

    // set PROJECT ID
    if (projectId) {
      await setProject(projectId);
    } else if (serviceAccountKey) {
      projectId = await setProjectWithKey(serviceAccountKey);
    } else if (process.env.GCLOUD_PROJECT) {
      await setProject(process.env.GCLOUD_PROJECT);
    }
    // Fail if no Project Id is provided if not already set.
    const projectIdSet = await isProjectIdSet();
    if (!projectIdSet) {
      throw new Error(
        'No project Id provided. Ensure you have either project_id and/or credentials inputs are set.',
      );
    }

    // Either serviceAccountKey or GOOGLE_GHA_CREDS_PATH env var required
    if (serviceAccountKey || process.env.GOOGLE_GHA_CREDS_PATH) {
      await authenticateGcloudSDK(serviceAccountKey);
    }
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      throw new Error('Error authenticating the Cloud SDK.');
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

    // Get output of gcloud cmd.
    let output = '';
    const stdout = (data: Buffer): void => {
      output += data.toString();
    };
    let errOutput = '';
    const stderr = (data: Buffer): void => {
      errOutput += data.toString();
    };

    const options = {
      listeners: {
        stderr,
        stdout,
      },
      silent: true,
    };
    logInfo(`running: ${toolCommand} ${appDeployCmd.join(' ')}`);
    // Run gcloud cmd.
    try {
      await exec(toolCommand, appDeployCmd, options);
      // Set url as output.
      setUrlOutput(output + errOutput);
    } catch (err) {
      const msg = errOutput || (err instanceof Error ? err.message : `${err}`);
      throw new Error(msg);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : err;
    setFailed(`google-github-actions/deploy-appengine failed with: ${msg}`);
  }
}
