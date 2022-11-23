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

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';

import { run } from '../src/main';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs: { [key: string]: string } = {
  project_id: '',
  working_directory: '',
  deliverables: 'example-app/app.yaml',
  image_url: '',
  version: '',
  promote: '',
  flags: '',
};

function getInputMock(name: string): string {
  return fakeInputs[name];
}

// Stub somewhat annoying logs
function doNothing(): void {
  /** do nothing */
}

describe('#run', function () {
  beforeEach(async function () {
    this.stubs = {
      getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
      exportVariable: sinon.stub(core, 'exportVariable'),
      setOutput: sinon.stub(core, 'setOutput'),
      installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
      authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
      getLatestGcloudSDKVersion: sinon.stub(setupGcloud, 'getLatestGcloudSDKVersion'),
      isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(true),
      getExecOutput: sinon
        .stub(exec, 'getExecOutput')
        .resolves({ exitCode: 0, stderr: '', stdout: '{}' }),
    };

    sinon.stub(core, 'debug').callsFake(doNothing);
    sinon.stub(core, 'endGroup').callsFake(doNothing);
    sinon.stub(core, 'info').callsFake(doNothing);
    sinon.stub(core, 'startGroup').callsFake(doNothing);
    sinon.stub(core, 'warning').callsFake(doNothing);
  });

  afterEach(function () {
    Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
    sinon.restore();
  });

  it('installs the gcloud SDK if it is not already installed', async function () {
    this.stubs.isInstalled.returns(false);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(1);
  });

  it('uses the cached gcloud SDK if it was already installed', async function () {
    this.stubs.isInstalled.returns(true);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(0);
  });

  it('sets project if provided', async function () {
    this.stubs.getInput.withArgs('project_id').returns('my-test-project');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--project', 'my-test-project']);
  });

  it('sets image-url if provided', async function () {
    this.stubs.getInput.withArgs('image_url').returns('gcr.io/foo/bar');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--image-url', 'gcr.io/foo/bar']);
  });

  it('sets version if provided', async function () {
    this.stubs.getInput.withArgs('version').returns('123');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--version', '123']);
  });

  it('sets promote if provided', async function () {
    this.stubs.getInput.withArgs('promote').returns('true');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--promote']);
  });

  it('sets no-promote if not provided', async function () {
    this.stubs.getInput.withArgs('promote').returns('false');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--no-promote']);
  });

  it('sets flags if provided', async function () {
    this.stubs.getInput.withArgs('flags').returns('--log-http   --foo=bar');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--log-http', '--foo', 'bar']);
  });

  it('sets outputs', async function () {
    this.stubs.getExecOutput.resolves({
      exitCode: 0,
      stderr: '',
      stdout: `
        {
          "versions": [
            {
              "version": {
                "createTime": "2022-11-17T17:18:16Z",
                "createdBy": "foo@bar.com",
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
    });
    await run();

    const setOutput = this.stubs.setOutput;
    expect(setOutput.calledWith('name', 'apps/my-project/services/default/versions/123')).to.be.ok;
    expect(setOutput.calledWith('serviceAccountEmail', 'my-project@appspot.gserviceaccount.com')).to
      .be.ok;
    expect(setOutput.calledWith('versionURL', 'https://123-dot-my-project.appspot.com')).to.be.ok;
    expect(setOutput.calledWith('url', 'https://123-dot-my-project.appspot.com')).to.be.ok;
  });
});
