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

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '../setupGcloudSDK/src/';
import fs from 'fs';

export const GCLOUD_METRICS_ENV_VAR = 'CLOUDSDK_METRICS_ENVIRONMENT';
export const GCLOUD_METRICS_LABEL = 'github-actions-deploy-appengine';

export function setUrlOutput(output: string): string | undefined {
  // regex to match Cloud Run URLs
  const urlMatch = output.match(/(?<=target url:\s+\[)(.*?)(?=\])/g);
  //(?<=is \()(.*?)(?=\s*\))
  if (!urlMatch) {
    core.warning('Can not find URL.');
    return undefined;
  }
  // Match "tagged" URL or default to service URL
  const url = urlMatch!.length > 1 ? urlMatch![1] : urlMatch![0];
  core.setOutput('url', url);
  return url;
}

export function parseFlags(flags: string): RegExpMatchArray {
  return flags.match(/(".*?"|[^"\s=]+)+(?=\s*|\s*$)/g)!; // Split on space or "=" if not in quotes
}

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  core.exportVariable(GCLOUD_METRICS_ENV_VAR, GCLOUD_METRICS_LABEL);
  try {
    // Get action inputs.
    let projectId = core.getInput('project_id');
    const cwd = core.getInput('working_directory');
    const deliverables = core.getInput('deliverables');
    const imageUrl = core.getInput('image_url');
    const version = core.getInput('version');
    const promote = core.getInput('promote');
    const serviceAccountKey = core.getInput('credentials');
    const flags = core.getInput('flags');

    // Change working directory
    if (cwd) process.chdir(cwd.trim());

    // Validate deliverables
    const allDeliverables = deliverables.split(' ');
    if (allDeliverables[0] == '') allDeliverables[0] = 'app.yaml';
    for (const deliverable of allDeliverables) {
      if (!fs.existsSync(deliverable)) {
        core.error(deliverable + ' is not in path.');
        const message =
          'Deliverables can not be found. ' +
          'Check `working_directory` and `deliverables` input paths.';
        throw new Error(message);
      }
    }

    // Install gcloud if not already installed.
    if (!setupGcloud.isInstalled()) {
      const gcloudVersion = await setupGcloud.getLatestGcloudSDKVersion();
      await setupGcloud.installGcloudSDK(gcloudVersion);
    }

    // Fail if no Project Id is provided if not already set.
    const projectIdSet = await setupGcloud.isProjectIdSet();
    if (!projectIdSet && projectId === '' && serviceAccountKey === '') {
      throw new Error(
        'No project Id provided. Ensure you have either project_id and/or credentials inputs are set.',
      );
    }

    // Authenticate gcloud SDK.
    if (serviceAccountKey) {
      await setupGcloud.authenticateGcloudSDK(serviceAccountKey);
      // Set and retrieve Project Id if not provided
      if (projectId === '') {
        projectId = await setupGcloud.setProjectWithKey(serviceAccountKey);
      }
    }
    const authenticated = await setupGcloud.isAuthenticated();
    if (!authenticated) {
      throw new Error('Error authenticating the Cloud SDK.');
    }

    const toolCommand = setupGcloud.getToolCommand();

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
    core.info(`running: ${toolCommand} ${appDeployCmd.join(' ')}`);
    // Run gcloud cmd.
    try {
      await exec.exec(toolCommand, appDeployCmd, options);
      // Set url as output.
      setUrlOutput(output + errOutput);
    } catch (error) {
      if (errOutput) {
        throw new Error(errOutput);
      } else {
        throw new Error(error);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
