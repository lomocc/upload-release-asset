import * as core from "@actions/core";
import { context, GitHub } from "@actions/github";
import fs from "fs";

export async function uploadReleaseAsset() {
  try {
    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    // @ts-ignore
    let timeZone = process.env.TZ || process.env.TIME_ZONE;
    // @ts-ignore
    const github = new GitHub(process.env.GITHUB_TOKEN, { timeZone });

    // Get owner and repo from context of payload that triggered the action
    // const { owner, repo } = context.repo;

    const owner =
      core.getInput("owner", { required: false }) || context.repo.owner;
    const repo =
      core.getInput("repo", { required: false }) || context.repo.repo;

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    // This removes the 'refs/tags' portion of the string, i.e. from 'refs/tags/v1.10.15' to 'v1.10.15'
    const tag = (
      core.getInput("tag_name", { required: false }) || context.ref
    ).replace(/refs\/\w+\//, "");

    const releaseName = (
      core.getInput("release_name", { required: false }) || context.ref
    ).replace(/refs\/\w+\//, "");
    const body = core.getInput("body", { required: false });
    const draft = core.getInput("draft", { required: false }) === "true";
    const prerelease =
      core.getInput("prerelease", { required: false }) === "true";
    const override = core.getInput("override", { required: false }) !== "false";

    let createReleaseResponse;
    try {
      let getReleaseByTagResponse = await github.repos.getReleaseByTag({
        owner,
        repo,
        tag
      });
      const {
        data: { id: releaseId }
      } = getReleaseByTagResponse;
      createReleaseResponse = await github.repos.updateRelease({
        owner,
        repo,
        release_id: releaseId,
        name: releaseName,
        body,
        draft,
        prerelease
      });
    } catch (error) {
      if (error.status === 404) {
        // Create a release
        // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
        // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
        createReleaseResponse = await github.repos.createRelease({
          owner,
          repo,
          tag_name: tag,
          name: releaseName,
          body,
          draft,
          prerelease
        });
      } else {
        core.setFailed(error.message);
      }
    }

    // Get the ID, html_url, and upload URL for the created Release from the response
    const {
      data: { upload_url: uploadUrl, id: releaseId }
    } = createReleaseResponse;

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const assetPath = core.getInput("asset_path", { required: true });
    const assetName =
      core.getInput("asset_name", { required: false }) ||
      assetPath.replace(/^.*(\\|\/)(.+\..*)$/, "$2");
    const assetContentType =
      core.getInput("asset_content_type", { required: false }) ||
      "application/octet-stream";

    // Check for duplicates.
    const assetsResponse = await github.repos.listAssetsForRelease({
      owner,
      repo,
      release_id: releaseId
    });
    const duplicateAsset = assetsResponse.data.find(
      asset => asset.name === assetName
    );
    if (duplicateAsset) {
      if (override) {
        core.debug(
          `An asset called ${assetName} already exists in release ${tag} so we'll overwrite it.`
        );
        await github.repos.deleteReleaseAsset({
          owner,
          repo,
          asset_id: duplicateAsset.id
        });
      } else {
        core.setFailed(`An asset called ${assetName} already exists.`);
        return;
      }
    }

    // Determine content-length for header to upload asset
    const assetContentLength = fs.statSync(assetPath).size;

    // Setup headers for API call, see Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset for more information
    const headers = {
      "content-type": assetContentType,
      "content-length": assetContentLength
    };

    // Upload a release asset
    // API Documentation: https://developer.github.com/v3/repos/releases/#upload-a-release-asset
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset
    const uploadAssetResponse = await github.repos.uploadReleaseAsset({
      url: uploadUrl,
      headers,
      name: assetName,
      file: fs.readFileSync(assetPath)
    });

    // Get the browser_download_url for the uploaded release asset from the response
    const {
      data: { browser_download_url: browserDownloadUrl }
    } = uploadAssetResponse;

    // Set the output variable for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    core.setOutput("browser_download_url", browserDownloadUrl);
  } catch (error) {
    core.setFailed(error.message);
  }
}
