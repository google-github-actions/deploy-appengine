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
import * as sinon from 'sinon';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { expect } from 'chai';
import { run, setUrlOutput } from '../src/deploy-appengine';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs: { [key: string]: string } = {
  credentials: '{}',
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

describe('#run', function () {
  beforeEach(async function () {
    this.stubs = {
      getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
      exportVariable: sinon.stub(core, 'exportVariable'),
      setFailed: sinon.stub(core, 'setFailed'),
      installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
      authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
      getLatestGcloudSDKVersion: sinon.stub(setupGcloud, 'getLatestGcloudSDKVersion'),
      isAuthenticated: sinon.stub(setupGcloud, 'isAuthenticated').resolves(true),
      isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(false),
      setProject: sinon.stub(setupGcloud, 'setProject'),
      parseServiceAccountKey: sinon.stub(setupGcloud, 'parseServiceAccountKey'),
      isProjectIdSet: sinon.stub(setupGcloud, 'isProjectIdSet').resolves(false),
      getExecOutput: sinon.stub(exec, 'getExecOutput'),
    };
  });

  afterEach(function () {
    Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
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

  it('authenticates if key is provided', async function () {
    this.stubs.getInput.withArgs('credentials').returns('key');
    this.stubs.isProjectIdSet.withArgs().returns(true);
    await run();
    expect(this.stubs.authenticateGcloudSDK.withArgs('key').callCount).to.eq(1);
  });

  it('uses project id from credentials if project_id is not provided', async function () {
    this.stubs.getInput.withArgs('credentials').returns('key');
    this.stubs.getInput.withArgs('project_id').returns('');
    await run();
    expect(this.stubs.parseServiceAccountKey.withArgs('key').callCount).to.eq(1);
  });

  it('fails if credentials and project_id are not provided', async function () {
    this.stubs.getInput.withArgs('credentials').returns('');
    this.stubs.getInput.withArgs('project_id').returns('');
    process.env.GCLOUD_PROJECT = '';
    await run();
    expect(this.stubs.setFailed.callCount).to.be.at.least(1);
  });
});

describe('#setUrlOutput', function () {
  it('correctly parses the URL', function () {
    const output = `
    Services to deploy:

    descriptor:      [/deploy-appengine/example-app/app.yaml]
    source:          [/deploy-appengine/example-app]
    target project:  [PROJECT_ID]
    target service:  [default]
    target version:  [20210602t090041]
    target url:      [https://PROJECT_ID.uc.r.appspot.com]


    Do you want to continue (Y/n)?

    Beginning deployment of service [default]...
    ╔════════════════════════════════════════════════════════════╗
    ╠═ Uploading 6 files to Google Cloud Storage                ═╣
    ╚════════════════════════════════════════════════════════════╝
    File upload done.
    Updating service [default]...done.
    Setting traffic split for service [default]...done.
    Deployed service [default] to [https://PROJECT_ID.uc.r.appspot.com]

    You can stream logs from the command line by running:
      $ gcloud app logs tail -s default

    To view your application in the web browser run:
      $ gcloud app browse
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq('https://PROJECT_ID.uc.r.appspot.com');
  });

  it('correctly parses the service URLs', function () {
    const output = `
    Services to deploy:

    descriptor:      [/deploy-appengine/example-app/app.yaml]
    source:          [/deploy-appengine/example-app]
    target project:  [PROJECT_ID]
    target service:  [service-v2]
    target version:  [20210602t090752]
    target url:      [https://service-v2-dot-PROJECT_ID.uc.r.appspot.com]


    Do you want to continue (Y/n)?

    Beginning deployment of service [service-v2]...
    ╔════════════════════════════════════════════════════════════╗
    ╠═ Uploading 1 file to Google Cloud Storage                 ═╣
    ╚════════════════════════════════════════════════════════════╝
    File upload done.
    Updating service [service-v2]...done.
    Setting traffic split for service [service-v2]...done.
    Deployed service [service-v2] to [https://service-v2-dot-PROJECT_ID.uc.r.appspot.com]

    You can stream logs from the command line by running:
      $ gcloud app logs tail -s service-v2

    To view your application in the web browser run:
      $ gcloud app browse -s service-v2
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq('https://service-v2-dot-PROJECT_ID.uc.r.appspot.com');
  });

  it('returns undefined', function () {
    const output = `
    ERROR: (gcloud.app.deploy) An error occurred while parsing file: [/deploy-appengine/example-app/app.yaml]
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq(undefined);
  });
});
