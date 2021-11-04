<!--
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
# deploy-appengine

This action deploys your source code to [App Engine][gae] and makes the URL
available to later build steps via outputs. This allows you to parameterize your
App Engine deployments.

**Note:** This action will install [gcloud](https://cloud.google.com/sdk) in the
background if not using in with the [`setup-gcloud` action][setup-gcloud].

## Prerequisites

This action requires Google Cloud credentials that are authorized to deploy an
App Engine Application. See the [Authorization](#authorization) section below for more information.

## Usage

```yaml
steps:
- id: deploy
  uses: google-github-actions/deploy-appengine@main
  with:
    credentials: ${{ secrets.gcp_credentials }}

# Example of using the output
- id: test
  run: curl "${{ steps.deploy.outputs.url }}"
```

## Inputs

- `project_id`: (Optional) ID of the Google Cloud project. If provided, this
  will override the project configured by gcloud.

- `working_directory`: (Optional) The working directory to use. **Actions do not honor
  [default working-directory settings](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#defaultsrun).** The `deliverables` input is a 
  relative path based on this setting.

- `deliverables`: (Optional) The [yaml files](https://cloud.google.com/appengine/docs/standard/nodejs/configuration-files#optional_configuration_files)
  for the services or configurations you want to deploy. If not given, defaults
  to app.yaml in the current directory. If that is not found, attempts to
  automatically generate necessary configuration files (such as app.yaml) in
  the current directory (example, `app.yaml cron.yaml`). Note: the additional
  deliverables may require additional roles for your service account user.

- `image_url`: (Optional) Deploy with a specific container image. The image url
  must be from one of the valid GCR hostnames (example, `gcr.io/`).

- `version`: (Optional) The version of the app that will be created or replaced
  by this deployment. If you do not specify a version, one will be generated for
  you.

- `promote`: (Optional) Promote the deployed version to receive all traffic. 
  Possible values: `''|'true'|true|'false'|false`, if not specified behavior defaults to promote.

### app.yaml customizations

Other application configurations can be customized through the app.yaml, ie the
service name. See [app.yaml Configuration File](https://cloud.google.com/appengine/docs/standard/nodejs/config/appref)
for more information.

## Outputs

- `url`: The URL of your App Engine Application.

## Authorization
<a name="authorization"></a>
There are a few ways to authenticate this action. The caller must have
permissions to access the secrets being requested.

[Roles needed](https://cloud.google.com/appengine/docs/standard/python/roles#predefined_roles):

- App Engine Admin (`roles/appengine.appAdmin`): can manage all App Engine resources
- Service Account User (`roles/iam.serviceAccountUser`): to deploy as the service account
- Storage Admin (`roles/compute.storageAdmin`): to upload files
- Cloud Build Editor (`cloudbuild.builds.editor`): to build the application
- _(optional)_ Cloud Scheduler Admin (`roles/cloudscheduler.admin`): to schedule tasks

*Note:* An owner will be needed to create the App Engine application

### Used with setup-gcloud

You can provide credentials using the [setup-gcloud][setup-gcloud] action,
however you must provide your Project ID to the `deploy-appengine` action:

```yaml
- uses: google-github-actions/setup-gcloud@master
  with:
    version: '290.0.1'
    service_account_key: ${{ secrets.GCP_SA_KEY }}
    export_default_credentials: true
- id: Deploy
  uses: google-github-actions/deploy-appengine@main
  with:
    project_id: ${{ secrets.project_id }}
```

### Via Credentials

You can provide [Google Cloud Service Account JSON][sa] directly to the action
by specifying the `credentials` input. First, create a [GitHub
Secret][gh-secret] that contains the JSON content, then import it into the
action:

```yaml
- id: Deploy
  uses: google-github-actions/deploy-appengine@main
  with:
    credentials: ${{ secrets.GCP_SA_KEY }}
```

### Via Application Default Credentials

If you are hosting your own runners, **and** those runners are on Google Cloud,
you can leverage the Application Default Credentials of the instance. This will
authenticate requests as the service account attached to the instance. **This
only works using a custom runner hosted on GCP.**

```yaml
- id: Deploy
  uses: google-github-actions/deploy-appengine@main
```

The action will automatically detect and use the Application Default
Credentials.

## Example Workflows

* [Deploy from source](#deploy-from-source)

### Setup

1.  Clone this repo.

1. Create a new Google Cloud Project (or select an existing project).

1. [Initialize your App Engine app with your project][app-engine-nodejs-docs].

1. Enable the [App Engine Admin API][app-engine-admin-api] on your project.

1.  [Create a Google Cloud service account][sa] or select an existing one.

1.  Add [required roles](#authorization) to [your service account][roles].

1.  [Download a JSON service account key][create-key] for the service account.

1.  Add the following [secrets to your repository's secrets][gh-secret]:

    - `GCP_PROJECT`: Google Cloud project ID

    - `GCP_SA_KEY`: the downloaded service account key

### Deploy from source

To run this workflow, push to the branch named `example`:

```sh
git push YOUR-FORK main:example
```

## Migrating from `setup-gcloud`

Example using `setup-gcloud`:

```YAML
- name: Setup Cloud SDK
  uses: google-github-actions/setup-gcloud@v0.2.0
  with:
    project_id: ${{ env.PROJECT_ID }}
    service_account_key: ${{ secrets.GCP_SA_KEY }}

- name: Deploy to App Engine
  run: gcloud app deploy app.yaml --quiet --no-promote --version v1

```

Migrated to `deploy-appengine`:

```YAML
- name: Deploy to App Engine
  uses: google-github-actions/deploy-appengine@v0.2.0
  with:
    deliverables: app.yaml
    project_id: ${{ secrets.GCP_PROJECT }}
    credentials: ${{ secrets.GCP_SA_KEY }}
    promote: false
    version: v1
```

[gae]: https://cloud.google.com/appengine
[sm]: https://cloud.google.com/secret-manager
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
[setup-gcloud]: https://github.com/google-github-actions/setup-gcloud/
[roles]: https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_service_account_for_a_resource
[create-key]: https://cloud.google.com/iam/docs/creating-managing-service-account-keys
[app-engine-admin-api]: https://console.cloud.google.com/apis/api/appengine.googleapis.com/overview
[app-engine-nodejs-docs]: https://cloud.google.com/appengine/docs/standard/nodejs/console#console
