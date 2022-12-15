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

import 'mocha';
import { expect } from 'chai';

import {
  parseDeployResponse,
  DeployResponse,
  parseDescribeResponse,
  DescribeResponse,
} from '../src/output-parser';

describe('#parseDeployResponse', () => {
  const cases: {
    only?: boolean;
    name: string;
    stdout: string | undefined;
    error?: string;
    expected?: DeployResponse | null;
  }[] = [
    {
      name: 'with promote',
      stdout: `
        {
          "configs": [],
          "versions": [
            {
              "environment": null,
              "id": "20221117t121206",
              "last_deployed_time": null,
              "project": "my-project",
              "service": "default",
              "service_account": null,
              "traffic_split": null,
              "version": {
                "createTime": "2022-11-17T17:14:10Z",
                "createdBy": "foo@bar.com",
                "deployment": {
                  "files": {
                    ".gcloudignore": {
                      "sha1Sum": "8c826ff92b4fb4374cd1f482438a2492a7b62444",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/8c826ff92b4fb4374cd1f482438a2492a7b62444"
                    },
                    "app.yaml": {
                      "sha1Sum": "84a6883be145d40d7f34901050f403f51faba608",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/84a6883be145d40d7f34901050f403f51faba608"
                    },
                    "index.js": {
                      "sha1Sum": "4314a54ca7a14bc00f48959c620dc784c87d1c11",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/4314a54ca7a14bc00f48959c620dc784c87d1c11"
                    },
                    "package-lock.json": {
                      "sha1Sum": "4e28e642ad76490edd5a9c390557dc3319f59f8e",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/4e28e642ad76490edd5a9c390557dc3319f59f8e"
                    },
                    "package.json": {
                      "sha1Sum": "c5ad06c6ba994ae32e2ba71c9d5c861f6ff12389",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/c5ad06c6ba994ae32e2ba71c9d5c861f6ff12389"
                    },
                    "source-context.json": {
                      "sha1Sum": "0f90a4df44bdad2786bbd635b25c70faf2b8bc8f",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/0f90a4df44bdad2786bbd635b25c70faf2b8bc8f"
                    }
                  }
                },
                "diskUsageBytes": "4180802",
                "env": "standard",
                "handlers": [
                  {
                    "authFailAction": "AUTH_FAIL_ACTION_REDIRECT",
                    "login": "LOGIN_OPTIONAL",
                    "script": {
                      "scriptPath": "auto"
                    },
                    "securityLevel": "SECURE_OPTIONAL",
                    "urlRegex": ".*"
                  }
                ],
                "id": "20221117t121206",
                "instanceClass": "F1",
                "name": "apps/my-project/services/default/versions/20221117t121206",
                "network": {},
                "runtime": "nodejs16",
                "runtimeChannel": "default",
                "serviceAccount": "my-project@appspot.gserviceaccount.com",
                "servingStatus": "SERVING",
                "threadsafe": true,
                "versionUrl": "https://20221117t121206-dot-my-project.appspot.com"
              }
            }
          ]
        }
      `,
      expected: {
        project: 'my-project',
        service: 'default',
        versionID: '20221117t121206',
      },
    },
    {
      name: 'with --version',
      stdout: `
        {
          "configs": [],
          "versions": [
            {
              "environment": null,
              "id": "123",
              "last_deployed_time": null,
              "project": "my-project",
              "service": "default",
              "service_account": null,
              "traffic_split": null,
              "version": {
                "createTime": "2022-11-17T17:18:16Z",
                "createdBy": "foo@bar.com",
                "deployment": {
                  "files": {
                    "app.yaml": {
                      "sha1Sum": "84a6883be145d40d7f34901050f403f51faba608",
                      "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/84a6883be145d40d7f34901050f403f51faba608"
                    }
                  }
                },
                "diskUsageBytes": "4197856",
                "env": "standard",
                "handlers": [
                  {
                    "authFailAction": "AUTH_FAIL_ACTION_REDIRECT",
                    "login": "LOGIN_OPTIONAL",
                    "script": {
                      "scriptPath": "auto"
                    },
                    "securityLevel": "SECURE_OPTIONAL",
                    "urlRegex": ".*"
                  }
                ],
                "id": "123",
                "instanceClass": "F1",
                "name": "apps/my-project/services/default/versions/123",
                "network": {},
                "runtime": "nodejs16",
                "runtimeChannel": "default",
                "serviceAccount": "my-project@appspot.gserviceaccount.com",
                "servingStatus": "SERVING",
                "threadsafe": true,
                "versionUrl": "https://123-dot-my-project.appspot.com"
              }
            }
          ]
        }
      `,
      expected: {
        project: 'my-project',
        service: 'default',
        versionID: '123',
      },
    },
    {
      name: 'with --no-promote',
      stdout: `
        {
          "configs": [],
          "versions": [
            {
              "environment": null,
              "id": "123",
              "last_deployed_time": null,
              "project": "my-project",
              "service": "default",
              "service_account": null,
              "traffic_split": null,
              "version": null
            }
          ]
        }
      `,
      expected: {
        project: 'my-project',
        service: 'default',
        versionID: '123',
      },
    },
    {
      name: 'empty stdout',
      stdout: ``,
      error: `empty response`,
    },
    {
      name: 'empty array from stdout',
      stdout: `[]`,
      error: `missing or empty "versions"`,
    },
    {
      name: 'empty object from stdout',
      stdout: `{}`,
      error: `missing or empty "versions"`,
    },
    {
      name: 'invalid text from stdout',
      stdout: `Some text to fail`,
      error: `failed to parse deploy response: unexpected token`,
    },
  ];

  cases.forEach((tc) => {
    const fn = tc.only ? it.only : it;
    fn(tc.name, () => {
      if (tc.error) {
        expect(() => {
          parseDeployResponse(tc.stdout);
        }).to.throw(tc.error);
      } else {
        expect(parseDeployResponse(tc.stdout)).to.eql(tc.expected);
      }
    });
  });
});

describe('#parseDescribeResponse', () => {
  const cases: {
    only?: boolean;
    name: string;
    stdout: string | undefined;
    error?: string;
    expected?: DescribeResponse | null;
  }[] = [
    {
      name: 'with response',
      stdout: `
        {
          "createTime": "2022-12-15T15:26:11Z",
          "createdBy": "foo@bar.com",
          "deployment": {
            "files": {
              "app.yaml": {
                "sha1Sum": "84a6883be145d40d7f34901050f403f51faba608",
                "sourceUrl": "https://storage.googleapis.com/staging.my-project.appspot.com/84a6883be145d40d7f34901050f403f51faba608"
              }
            }
          },
          "diskUsageBytes": "4288402",
          "env": "standard",
          "id": "20221215t102539",
          "instanceClass": "F1",
          "name": "apps/my-project/services/default/versions/20221215t102539",
          "network": {},
          "runtime": "nodejs16",
          "runtimeChannel": "default",
          "serviceAccount": "my-project@appspot.gserviceaccount.com",
          "servingStatus": "SERVING",
          "threadsafe": true,
          "versionUrl": "https://20221215t102539-dot-my-project.appspot.com"
        }
      `,
      expected: {
        name: 'apps/my-project/services/default/versions/20221215t102539',
        runtime: 'nodejs16',
        serviceAccountEmail: 'my-project@appspot.gserviceaccount.com',
        servingStatus: 'SERVING',
        versionID: '20221215t102539',
        versionURL: 'https://20221215t102539-dot-my-project.appspot.com',
      },
    },
    {
      name: 'empty stdout',
      stdout: ``,
      error: `empty response`,
    },
    {
      name: 'empty array from stdout',
      stdout: `[]`,
      error: `empty response`,
    },
    {
      name: 'empty object from stdout',
      stdout: `{}`,
      error: `empty response`,
    },
    {
      name: 'invalid text from stdout',
      stdout: `Some text to fail`,
      error: `failed to parse describe response: unexpected token`,
    },
  ];

  cases.forEach((tc) => {
    const fn = tc.only ? it.only : it;
    fn(tc.name, () => {
      if (tc.error) {
        expect(() => {
          parseDescribeResponse(tc.stdout);
        }).to.throw(tc.error);
      } else {
        expect(parseDescribeResponse(tc.stdout)).to.eql(tc.expected);
      }
    });
  });
});
