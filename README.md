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

<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="__input_project_id"></a><a href="#user-content-__input_project_id"><code>project_id</code></a>: _(Optional)_ ID of the Google Cloud project. If not provided, this is inherited from
    the environment.

-   <a name="__input_working_directory"></a><a href="#user-content-__input_working_directory"><code>working_directory</code></a>: _(Optional)_ The working directory to use. **GitHub Actions do not honor [default
    working-directory
    settings](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#defaultsrun).**
    The `deliverables` input is a relative path based on this setting.

-   <a name="__input_deliverables"></a><a href="#user-content-__input_deliverables"><code>deliverables</code></a>: _(Optional)_ The [yaml
    files](https://cloud.google.com/appengine/docs/standard/nodejs/configuration-files#optional_configuration_files)
    for the services or configurations you want to deploy. If not given,
    defaults to app.yaml in the current directory. If that is not found,
    attempts to automatically generate necessary configuration files (such as
    app.yaml) in the current directory (example, `app.yaml cron.yaml`).

    Note: The additional deliverables may require additional roles for your
    service account user.

-   <a name="__input_build_env_vars"></a><a href="#user-content-__input_build_env_vars"><code>build_env_vars</code></a>: _(Optional)_ List of build environment variables that should be set in the build
    environment. These are comma-separated or newline-separated `KEY=VALUE`.
    Keys or values that contain separators must be escaped with a backslash
    (e.g. `\,` or `\\n`) unless quoted. Any leading or trailing whitespace is
    trimmed unless values are quoted.

    ```yaml
    build_env_vars: |-
      FRUIT=apple
      SENTENCE=" this will retain leading and trailing spaces "
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    To include build environment variables defined in another file, use the
    [`includes` directive][includes-directive] in your `app.yaml`.

    This will overwrite any duplicate key environment variables defined in the
    `app.yaml`.

-   <a name="__input_env_vars"></a><a href="#user-content-__input_env_vars"><code>env_vars</code></a>: _(Optional)_ List of environment variables that should be set in the environment. These
    are comma-separated or newline-separated `KEY=VALUE`. Keys or values that
    contain separators must be escaped with a backslash (e.g. `\,` or `\\n`)
    unless quoted. Any leading or trailing whitespace is trimmed unless values
    are quoted.

    ```yaml
    env_vars: |-
      FRUIT=apple
      SENTENCE=" this will retain leading and trailing spaces "
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    To include environment variables defined in another file, use the
    [`includes` directive][includes-directive] in your `app.yaml`.

    This will overwrite any duplicate key environment variables defined in the
    `app.yaml`.

-   <a name="__input_image_url"></a><a href="#user-content-__input_image_url"><code>image_url</code></a>: _(Optional)_ Fully-qualified name
    of the container image to deploy. For example:

        us-docker.pkg.dev/cloudrun/container/hello:latest

    or

        us-docker.pkg.dev/my-project/my-container/image:1.2.3

-   <a name="__input_version"></a><a href="#user-content-__input_version"><code>version</code></a>: _(Optional)_ The version of the app that will be created or replaced by this
    deployment. If you do not specify a version, one will be generated for
    you.

-   <a name="__input_promote"></a><a href="#user-content-__input_promote"><code>promote</code></a>: _(Optional, default: `true`)_ Promote the deployed version to receive all traffic.

-   <a name="__input_flags"></a><a href="#user-content-__input_flags"><code>flags</code></a>: _(Optional)_ Space separate list of additional Cloud Functions flags to pass to the
    deploy command. This can be used to apply advanced features that are not
    exposed via this GitHub Action.

    ```yaml
    with:
      flags: '--ignore-file=...'
    ```

    Flags that include other flags must quote the _entire_ outer flag value. For
    example, to pass `--args=-X=123`:

    ```yaml
    with:
      flags: 'flags: '--ignore-file=...' "--args=-X=123"'
    ```

    See the [complete list of
    flags](https://cloud.google.com/sdk/gcloud/reference/app/deploy#FLAGS) for
    more information.

    Please note, this GitHub Action does not parse or validate the flags. You
    are responsible for making sure the flags are available on the gcloud
    version and subcommand.

-   <a name="__input_gcloud_version"></a><a href="#user-content-__input_gcloud_version"><code>gcloud_version</code></a>: _(Optional)_ Version of the Cloud SDK to install. If unspecified or set to "latest",
    the latest available gcloud SDK version for the target platform will be
    installed. Example: "290.0.1".

-   <a name="__input_gcloud_component"></a><a href="#user-content-__input_gcloud_component"><code>gcloud_component</code></a>: _(Optional)_ Version of the Cloud SDK components to install and use. If unspecified,
    the latest or released version will be used. This is the equivalent of
    running 'gcloud alpha COMMAND' or 'gcloud beta COMMAND'. Valid values are
    `alpha` or `beta`. The default value is to use the stable track.


<!-- END_AUTOGEN_INPUTS -->

### app.yaml customizations

Other application configurations can be customized through the app.yaml, ie the
service name. See [app.yaml Configuration File](https://cloud.google.com/appengine/docs/standard/nodejs/config/appref)
for more information.

## Outputs

<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   <a name="__output_name"></a><a href="#user-content-__output_name"><code>name</code></a>: The fully-qualified resource name of the deployment. This will be of the
    format `apps/[PROJECT]/services/[SERVICE]/versions/[VERSION]`.

-   <a name="__output_runtime"></a><a href="#user-content-__output_runtime"><code>runtime</code></a>: The computed deployment runtime.

-   <a name="__output_service_account_email"></a><a href="#user-content-__output_service_account_email"><code>service_account_email</code></a>: The email address of the runtime service account.

-   <a name="__output_serving_status"></a><a href="#user-content-__output_serving_status"><code>serving_status</code></a>: The current serving status. The value is usually "SERVING", unless the
    deployment failed to start.

-   <a name="__output_version_id"></a><a href="#user-content-__output_version_id"><code>version_id</code></a>: Unique identifier for the version, or the specified version if one was
    given.

-   <a name="__output_version_url"></a><a href="#user-content-__output_version_url"><code>version_url</code></a>: URL of the version of the AppEngine service that was deployed.


<!-- END_AUTOGEN_OUTPUTS -->

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
