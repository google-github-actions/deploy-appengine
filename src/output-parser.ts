/*
 * Copyright 2022 Google LLC
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

import { errorMessage, presence } from '@google-github-actions/actions-utils';

/**
 * DeployResponse is the output from a "gcloud app deploy".
 */
export interface DeployResponse {
  // project is the project ID returned from the deployment.
  project: string;

  // service is the name of the deployed service.
  service: string;

  // versionID is the unique version ID.
  versionID: string;
}

/**
 * parseDeployResponse parses the JSON stdout from a deployment.
 *
 * @param string Standard output in JSON format.
 */
export function parseDeployResponse(stdout: string | undefined): DeployResponse {
  try {
    stdout = presence(stdout);
    if (!stdout) {
      throw new Error(`empty response`);
    }

    const outputJSON = JSON.parse(stdout);
    const version = outputJSON?.versions?.at(0);
    if (!version) {
      throw new Error(`missing or empty "versions"`);
    }

    return {
      project: version['project'],
      service: version['service'],
      versionID: version['id'],
    };
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`failed to parse deploy response: ${msg}, stdout: ${stdout}`);
  }
}

/**
 * DescribeResponse is the response from a "gcloud app versions describe".
 */
export interface DescribeResponse {
  // name is the full resource name of the deployment (e.g.
  // projects/p/services/default/versions/123).
  name: string;

  // runtime is the decided runtime.
  runtime: string;

  // serviceAccountEmail is the email address of the runtime service account for
  // the deployment.
  serviceAccountEmail: string;

  // servingStatus is the current serving status.
  servingStatus: string;

  // id is the unique version ID.
  versionID: string;

  // versionURL is the full HTTPS URL to the version.
  versionURL: string;
}

/**
 * parseDescribeResponse parses the output from a description.
 *
 * @param string Standard output in JSON format.
 */
export function parseDescribeResponse(stdout: string | undefined): DescribeResponse {
  try {
    stdout = presence(stdout);
    if (!stdout || stdout === '{}' || stdout === '[]') {
      throw new Error(`empty response`);
    }

    const version = JSON.parse(stdout);
    if (!version) {
      throw new Error(`empty JSON response`);
    }

    return {
      name: version['name'],
      runtime: version['runtime'],
      serviceAccountEmail: version['serviceAccount'],
      servingStatus: version['servingStatus'],
      versionID: version['id'],
      versionURL: version['versionUrl'],
    };
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`failed to parse describe response: ${msg}, stdout: ${stdout}`);
  }
}
