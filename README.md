# deploy-appengine

This action deploys your source code to [App Engine][gae] and makes the URL
available to later build steps via outputs. This allows you to parameterize your
App Engine deployments.

**This is not an officially supported Google product, and it is not covered by a
Google Cloud support contract. To report bugs or request features in a Google
Cloud product, please contact [Google Cloud
support](https://cloud.google.com/support).**


## Prerequisites

-   This action requires Google Cloud credentials that are authorized to deploy
    an App Engine Application. See the [Authorization](#authorization) section
    below for more information.

-   This action runs using Node 24. If you are using self-hosted GitHub Actions
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
      uses: 'google-github-actions/auth@v3'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-appengine@v3'

    # Example of using the output
    - id: 'test'
      run: 'curl "${{ steps.deploy.outputs.version_url }}"'
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

-   `build_env_vars`: (Optional) List of key=value pairs to set as environment
    variables during tbe build process. This will overwrite any duplicate key
    environment variables defined in the app.yaml.

    ```yaml
    with:
      build_env_vars: |-
        FOO=bar
        ZIP=zap
    ```

    Note: To include environment variables defined in another file, use the
    [`includes` directive][includes-directive] in your app.yaml.

-   `env_vars`: (Optional) List of key=value pairs to set as environment
    variables. This will overwrite any duplicate key environment variables
    defined in the app.yaml.

    ```yaml
    with:
      env_vars: |-
        FOO=bar
        ZIP=zap
    ```

    Note: To include environment variables defined in another file, use the
    [`includes` directive][includes-directive] in your app.yaml.

-   `image_url`: (Optional) Deploy with a specific container image. The image
    url must be from one of the valid GCR hostnames (example, `gcr.io/`).

-   `version`: (Optional) The version of the app that will be created or
    replaced by this deployment. If you do not specify a version, one will be
    generated for you.

-   `promote`: (Optional) Promote the deployed version to receive all traffic.
    The default is `true`.

-   `flags`: (Optional) Space-separated list of other App Engine flags. This can
    be used to access features that are not exposed via this GitHub Action.

    ```yaml
    with:
      flags: '--ignore-file=...'
    ```

    See the [complete list of flags](https://cloud.google.com/sdk/gcloud/reference/app/deploy#FLAGS) for more information.

---

-   `gcloud_version`: (Optional) Version of the gcloud CLI to use. The default value is `latest`.

-   `gcloud_component`: (Optional) Component of the gcloud CLI to use. Valid
    values are `alpha` and `beta`. The default value is to use the stable track.

### app.yaml customizations

Other application configurations can be customized through the app.yaml, ie the
service name. See [app.yaml Configuration File](https://cloud.google.com/appengine/docs/standard/nodejs/config/appref)
for more information.

## Outputs

-   `name`: The fully-qualified resource name of the deployment. This will be of
    the format "apps/<project>/services/<service>/versions/<version>".

-   `runtime`: The computed deployment runtime.

-   `service_account_email`: The email address of the runtime service account.

-   `serving_status`: The current serving status. The value is usually
    "SERVING", unless the deployment failed to start.

-   `version_id`: Unique identifier for the version, or the specified version if
    one was given.

-   `version_url`: URL of the version of the AppEngine service that was
    deployed.

## Authorization

There are a few ways to authenticate this action. The caller must have the following [Google Cloud IAM Roles](https://cloud.google.com/appengine/docs/standard/python/roles#predefined_roles):

-   App Engine Admin (`roles/appengine.appAdmin`) to manage all App Engine
    resources and create new services and versions.

-   Storage Admin (`roles/storage.admin`) to upload files to Cloud Storage to
    store source artifacts.

-   Cloud Build Editor (`roles/cloudbuild.builds.editor`) to build the
    service.

-   Artifact Registry Reader (`roles/artifactregistry.reader`) to view & get artifacts for implementing CI/CD pipeline.

-   Service Account User (`roles/iam.serviceAccountUser`) permissions on the
    runtime service account to deploy the service. The default runtime service
    account is `PROJECT_ID@appspot.gserviceaccount.com`, but you can also
    customize the service account in your app.yaml file.

-   _(optional)_ Cloud Scheduler Admin (`roles/cloudscheduler.admin`) to
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
      uses: 'google-github-actions/auth@v3'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-appengine@v3'
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
      uses: 'google-github-actions/deploy-appengine@v3'
```

## Advanced Configuration

#### Custom Build Timeouts

The default Google Cloud Build timeout to compile the application may be too
short for some services. To extend the build timeout, set the
`CLOUDSDK_APP_CLOUD_BUILD_TIMEOUT` environment variable to an integer
representing the number of seconds for the timeout. Do not customize this value
unless you are getting errors about build timeouts. This will consume more build
minutes.

```yaml
jobs:
  job_id:
    steps:
    - uses: 'google-github-actions/deploy-appengine@v3'
      env:
        CLOUDSDK_APP_CLOUD_BUILD_TIMEOUT: 1800 # 30 minutes
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
[includes-directive]: https://cloud.google.com/appengine/docs/legacy/standard/python/config/appref#includes
