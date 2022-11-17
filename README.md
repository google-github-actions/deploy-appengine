# deploy-appengine

This action deploys your source code to [App Engine][gae] and makes the URL
available to later build steps via outputs. This allows you to parameterize your
App Engine deployments.

## Prerequisites

-   This action requires Google Cloud credentials that are authorized to deploy
    an App Engine Application. See the [Authorization](#authorization) section
    below for more information.

-   This action runs using Node 16. If you are using self-hosted GitHub Actions
    runners, you must use runner version [2.285.0](https://github.com/actions/virtual-environments)
    or newer.

## Usage

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - id: 'auth'
      uses: 'google-github-actions/auth@v1'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-appengine@v0'

    # Example of using the output
    - id: 'test'
      run: 'curl "${{ steps.deploy.outputs.url }}"'
```

## Inputs

-   `project_id`: (Optional) ID of the Google Cloud project. If not provided,
    this is inherited from the environment.

-   `working_directory`: (Optional) The working directory to use. **Actions do
    not honor [default working-directory
    settings](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#defaultsrun).**
    The `deliverables` input is a relative path based on this setting.

-   `deliverables`: (Optional) The [yaml
    files](https://cloud.google.com/appengine/docs/standard/nodejs/configuration-files#optional_configuration_files)
    for the services or configurations you want to deploy. If not given,
    defaults to app.yaml in the current directory. If that is not found,
    attempts to automatically generate necessary configuration files (such as
    app.yaml) in the current directory (example, `app.yaml cron.yaml`). Note:
    the additional deliverables may require additional roles for your service
    account user.

-   `image_url`: (Optional) Deploy with a specific container image. The image
    url must be from one of the valid GCR hostnames (example, `gcr.io/`).

-   `version`: (Optional) The version of the app that will be created or
    replaced by this deployment. If you do not specify a version, one will be
    generated for you.

-   `promote`: (Optional) Promote the deployed version to receive all traffic.
    The default is `true`.

-   `flags`: (Optional) Space-separated list of other Cloud Run flags. This can
    be used to access features that are not exposed via this GitHub Action.

    ```yaml
    with:
      flags: '--add-cloudsql-instances=...'
    ```

    See the [complete list of flags](https://cloud.google.com/sdk/gcloud/reference/run/deploy#FLAGS) for more information.

### app.yaml customizations

Other application configurations can be customized through the app.yaml, ie the
service name. See [app.yaml Configuration File](https://cloud.google.com/appengine/docs/standard/nodejs/config/appref)
for more information.

## Outputs

- `url`: The URL of your App Engine Application.

## Authorization

There are a few ways to authenticate this action. The caller must have the following [Google Cloud IAM Roles](https://cloud.google.com/appengine/docs/standard/python/roles#predefined_roles):

-   App Engine Admin (`roles/appengine.appAdmin`): can manage all App Engine
    resources
-   Service Account User (`roles/iam.serviceAccountUser`): to deploy as the
    service account
-   Storage Admin (`roles/compute.storageAdmin`): to upload files
-   Cloud Build Editor (`roles/cloudbuild.builds.editor`): to build the
    application
-   _(optional)_ Cloud Scheduler Admin (`roles/cloudscheduler.admin`): to
    schedule tasks

*Note:* An owner will be needed to create the App Engine application.

### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth) to authenticate the action. This Action supports both the recommended [Workload Identity Federation][wif] based authentication and the traditional [Service Account Key JSON][sa] based auth.

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - id: 'auth'
      uses: 'google-github-actions/auth@v1'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-appengine@v0'
```

### Via Application Default Credentials

If you are hosting your own runners, **and** those runners are on Google Cloud,
you can leverage the Application Default Credentials of the instance. This will
authenticate requests as the service account attached to the instance. **This
only works using a custom runner hosted on GCP.**

```yaml
jobs:
  job_id:
    steps:
    - id: 'deploy'
      uses: 'google-github-actions/deploy-appengine@v0'
```

## Example Workflows

* [Deploy from source](#deploy-from-source)

### Setup

1.  Clone this repo.

1.  Create a new Google Cloud Project (or select an existing project).

1.  [Initialize your App Engine app with your project][app-engine-nodejs-docs].

1.  Enable the [App Engine Admin API][app-engine-admin-api] on your project.

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

[gae]: https://cloud.google.com/appengine
[sm]: https://cloud.google.com/secret-manager
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
[setup-gcloud]: https://github.com/google-github-actions/setup-gcloud/
[roles]: https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_service_account_for_a_resource
[create-key]: https://cloud.google.com/iam/docs/creating-managing-service-account-keys
[app-engine-admin-api]: https://console.cloud.google.com/apis/api/appengine.googleapis.com/overview
[app-engine-nodejs-docs]: https://cloud.google.com/appengine/docs/standard/nodejs/console#console
