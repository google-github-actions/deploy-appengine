/*
 * Copyright 2021 Google LLC
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

import { afterEach, beforeEach, describe, mock, it } from 'node:test';
import assert from 'node:assert';

import YAML from 'yaml';
import * as path from 'path';
import * as fs from 'fs/promises';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { TestToolCache } from '@google-github-actions/setup-cloud-sdk';
import {
  forceRemove,
  KVPair,
  randomFilepath,
  writeSecureFile,
} from '@google-github-actions/actions-utils';

import { run, findAppYaml, updateEnvVars, parseDeliverables } from '../src/main';
import * as outputParser from '../src/output-parser';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs = {
  project_id: '',
  working_directory: '',
  deliverables: 'example-app/app.yaml',
  image_url: '',
  env_vars: '',
  version: '',
  promote: '',
  flags: '',
};

const defaultMocks = (
  m: typeof mock,
  overrideInputs?: Record<string, string>,
): Record<string, any> => {
  const inputs = Object.assign({}, fakeInputs, overrideInputs);
  return {
    startGroup: m.method(core, 'startGroup', () => {}),
    endGroup: m.method(core, 'endGroup', () => {}),
    group: m.method(core, 'group', () => {}),
    logDebug: m.method(core, 'debug', () => {}),
    logError: m.method(core, 'error', () => {}),
    logInfo: m.method(core, 'info', () => {}),
    logNotice: m.method(core, 'notice', () => {}),
    logWarning: m.method(core, 'warning', () => {}),
    exportVariable: m.method(core, 'exportVariable', () => {}),
    setSecret: m.method(core, 'setSecret', () => {}),
    addPath: m.method(core, 'addPath', () => {}),
    setOutput: m.method(core, 'setOutput', () => {}),
    setFailed: m.method(core, 'setFailed', (msg: string) => {
      throw new Error(msg);
    }),
    getBooleanInput: m.method(core, 'getBooleanInput', (name: string) => {
      return !!inputs[name];
    }),
    getMultilineInput: m.method(core, 'getMultilineInput', (name: string) => {
      return inputs[name];
    }),
    getInput: m.method(core, 'getInput', (name: string) => {
      return inputs[name];
    }),

    authenticateGcloudSDK: m.method(setupGcloud, 'authenticateGcloudSDK', () => {}),
    isInstalled: m.method(setupGcloud, 'isInstalled', () => {
      return true;
    }),
    installGcloudSDK: m.method(setupGcloud, 'installGcloudSDK', async () => {
      return '1.2.3';
    }),
    installComponent: m.method(setupGcloud, 'installComponent', () => {}),
    getLatestGcloudSDKVersion: m.method(setupGcloud, 'getLatestGcloudSDKVersion', () => {
      return '1.2.3';
    }),

    getExecOutput: m.method(exec, 'getExecOutput', async () => {
      return {
        exitCode: 0,
        stderr: '',
        stdout: '{}',
      };
    }),

    parseDeployResponse: m.method(outputParser, 'parseDeployResponse', async () => {
      return {
        exitCode: 0,
        stderr: '',
        name: 'a',
        link: 'b',
      };
    }),

    parseDescribeResponse: m.method(outputParser, 'parseDescribeResponse', async () => {
      return {
        exitCode: 0,
        stderr: '',
        name: 'a',
        link: 'b',
      };
    }),
  };
};

describe('#run', async () => {
  beforeEach(async () => {
    await TestToolCache.start();
  });

  afterEach(async () => {
    await TestToolCache.stop();
  });

  it('installs the gcloud SDK if it is not already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return false;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 1);
  });

  it('uses the cached gcloud SDK if it was already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return true;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 0);
  });

  it('uses default components without gcloud_component flag', async (t) => {
    const mocks = defaultMocks(t.mock);
    await run();
    assert.deepStrictEqual(mocks.installComponent.mock.callCount(), 0);
  });

  it('throws error with invalid gcloud component flag', async (t) => {
    defaultMocks(t.mock, {
      gcloud_component: 'wrong_value',
    });
    assert.rejects(run, 'invalid input received for gcloud_component: wrong_value');
  });

  it('installs alpha component with alpha flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'alpha',
    });

    await run();

    expectSubArray(mocks.installComponent.mock.calls?.at(0)?.arguments, ['alpha']);
  });

  it('installs beta component with beta flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'beta',
    });

    await run();

    expectSubArray(mocks.installComponent.mock.calls?.at(0)?.arguments, ['beta']);
  });

  it('sets project if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      project_id: 'my-test-project',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--project',
      'my-test-project',
    ]);
  });

  it('sets image-url if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      image_url: 'gcr.io/foo/bar',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--image-url',
      'gcr.io/foo/bar',
    ]);
  });

  it('sets version if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      version: '123',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), ['--version', '123']);
  });

  it('sets promote if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      promote: 'true',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), ['--promote']);
  });

  it('sets no-promote if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      promote: 'false',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), ['--no-promote']);
  });

  it('sets flags if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      flags: '--log-http   --foo=bar',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--log-http',
      '--foo',
      'bar',
    ]);
  });

  it('sets outputs', async (t) => {
    const mocks = defaultMocks(t.mock);

    t.mock.method(outputParser, 'parseDescribeResponse', () => {
      return {
        name: 'test-name',
      };
    });

    await run();

    const args = mocks.setOutput.mock.calls[0].arguments;
    assert.deepStrictEqual(args, ['name', 'test-name']);
  });
});

describe('#findAppYaml', async () => {
  let parent: string;

  beforeEach(async () => {
    parent = randomFilepath();
    await fs.mkdir(parent, { recursive: true });
  });

  afterEach(async () => {
    forceRemove(parent);
  });

  const cases: {
    name: string;
    files: Record<string, string>;
    expected?: string;
    error?: string;
  }[] = [
    {
      name: 'no deployables',
      files: {},
      error: 'could not find an appyaml',
    },
    {
      name: 'no appyaml single',
      files: {
        'my-file': `
this is a file
      `,
      },
      error: 'could not find an appyaml',
    },
    {
      name: 'no appyaml multiple',
      files: {
        'my-file': `
this is a file
      `,
        'my-other-file': `
this is another file
      `,
      },
      error: 'could not find an appyaml',
    },
    {
      name: 'single appyaml',
      files: {
        'app-dev.yaml': `
runtime: 'node'
      `,
      },
      expected: 'app-dev.yaml',
    },
    {
      name: 'multiple files with appyaml',
      files: {
        'my-file': `
this is a file
      `,
        'my-other-file': `
this is another file
      `,
        'app-prod.yaml': `
runtime: 'node'
      `,
      },
      expected: 'app-prod.yaml',
    },
    {
      name: 'multiple appyaml uses first',
      files: {
        'app.yaml': `
runtime: 'node'
service: 'my-service'
      `,
        'app-dev.yaml': `
runtime: 'node'
service: 'my-service'
env: 'flex'
      `,
        'app-prod.yaml': `
runtime: 'node'
service: 'my-service'
env: 'standard'
      `,
      },
      expected: 'app.yaml',
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, async () => {
      Object.keys(tc.files).map((key) => {
        const newKey = path.join(parent, key);
        tc.files[newKey] = tc.files[key];
        delete tc.files[key];
      });

      await Promise.all(
        Object.entries(tc.files).map(async ([pth, contents]) => {
          await writeSecureFile(pth, contents);
        }),
      );

      const filepaths = Object.keys(tc.files);
      if (tc.error) {
        assert.rejects(async () => {
          await findAppYaml(filepaths);
        }, tc.error);
      } else if (tc.expected) {
        const expected = path.join(parent, tc.expected);
        const result = await findAppYaml(filepaths);
        assert.deepStrictEqual(result, expected);
      }
    });
  });
});

describe('#updateEnvVars', async () => {
  const cases: {
    name: string;
    existing: KVPair;
    envVars: KVPair;
    expected: KVPair;
  }[] = [
    {
      name: 'empty existing, empty input',
      existing: {},
      envVars: {},
      expected: {},
    },
    {
      name: 'empty existing, given input',
      existing: {},
      envVars: {
        FOO: 'bar',
        ZIP: 'zap',
      },
      expected: {
        FOO: 'bar',
        ZIP: 'zap',
      },
    },
    {
      name: 'existing, given input',
      existing: {
        EXISTING: 'one',
      },
      envVars: {
        FOO: 'bar',
        ZIP: 'zap',
      },
      expected: {
        EXISTING: 'one',
        FOO: 'bar',
        ZIP: 'zap',
      },
    },
    {
      name: 'overwrites',
      existing: {
        FOO: 'bar',
      },
      envVars: {
        FOO: 'zip',
      },
      expected: {
        FOO: 'zip',
      },
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, async () => {
      const result = updateEnvVars(tc.existing, tc.envVars);
      assert.deepStrictEqual(result, tc.expected);
    });
  });

  it('handles an yaml with variables', async () => {
    const parsed = YAML.parse(`
      env_variables:
        FOO: 'bar'
    `);

    const result = updateEnvVars(parsed.env_variables, { ZIP: 'zap' });
    assert.deepStrictEqual(result, {
      FOO: 'bar',
      ZIP: 'zap',
    });
  });

  it('handles an yaml without variables', async () => {
    const parsed = YAML.parse(`{}`);

    const result = updateEnvVars(parsed.env_variables, { ZIP: 'zap' });
    assert.deepStrictEqual(result, {
      ZIP: 'zap',
    });
  });
});

describe('#parseDeliverables', async () => {
  const cases: {
    name: string;
    input: string;
    expected?: string[];
  }[] = [
    {
      name: 'empty',
      input: '',
      expected: [],
    },
    {
      name: 'single',
      input: 'app.yaml',
      expected: ['app.yaml'],
    },
    {
      name: 'multi space',
      input: 'app.yaml foo.yaml',
      expected: ['app.yaml', 'foo.yaml'],
    },
    {
      name: 'multi comma',
      input: 'app.yaml, foo.yaml',
      expected: ['app.yaml', 'foo.yaml'],
    },
    {
      name: 'multi comma space',
      input: 'app.yaml,foo.yaml,   bar.yaml',
      expected: ['app.yaml', 'foo.yaml', 'bar.yaml'],
    },
    {
      name: 'multi-line comma space',
      input: 'app.yaml,\nfoo.yaml,   bar.yaml',
      expected: ['app.yaml', 'foo.yaml', 'bar.yaml'],
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, async () => {
      const result = parseDeliverables(tc.input);
      assert.deepStrictEqual(result, tc.expected);
    });
  });
});

const expectSubArray = (m: string[], exp: string[]) => {
  const window = exp.length;
  for (let i = 0; i < m.length; i++) {
    const x = m.slice(i, i + window);

    let matches = true;
    for (let j = 0; j < exp.length; j++) {
      if (x[j] !== exp[j]) {
        matches = false;
      }
    }
    if (matches) {
      return true;
    }
  }

  throw new assert.AssertionError({
    message: 'mismatch',
    actual: m,
    expected: exp,
    operator: 'subArray',
  });
};
