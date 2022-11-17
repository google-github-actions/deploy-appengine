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

export interface DeployOutput {
  // name is the full resource name of the deployment (e.g.
  // projects/p/services/default/versions/123).
  name: string;

  // serviceAccountEmail is the email address of the runtime service account for
  // the deployment.
  serviceAccountEmail: string;

  // versionURL is the full HTTPS URL to the version.
  versionURL: string;
}

/**
 * parseDeployResponse parses the JSON output from a "gcloud app deploy" output.
 */
export function parseDeployResponse(stdout: string | undefined): DeployOutput | null {
  try {
    stdout = presence(stdout);
    if (!stdout || stdout === '{}' || stdout === '[]') {
      return null;
    }

    const outputJSON = JSON.parse(stdout);
    const version = outputJSON.versions?.at(0)?.version;
    if (!version) {
      return null;
    }

    return {
      name: version.name,
      serviceAccountEmail: version.serviceAccount,
      versionURL: version.versionUrl,
    };
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`failed to parse deploy response: ${msg}, stdout: ${stdout}`);
  }
}
