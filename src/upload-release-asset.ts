import * as core from "@actions/core";
import { context, GitHub } from "@actions/github";
import fs from "fs";
import glob from "glob";
import mime from "mime-types";
import path from "path";

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

    // Check for duplicates.
    const assetsResponse = await github.repos.listAssetsForRelease({
      owner,
      repo,
      release_id: releaseId
    });

    let files = glob.sync(assetPath);
    for (let i = 0; i < files.length; i++) {
      let assetPath = files[i];
      let assetName = path.basename(assetPath);
      let duplicateAsset = assetsResponse.data.find(
        asset => asset.name === assetName
      );
      if (duplicateAsset) {
        if (override) {
          await github.repos.deleteReleaseAsset({
            owner,
            repo,
            asset_id: duplicateAsset.id
          });
          core.debug(`Delete Duplicate Asset: ${assetName}`);
        } else {
          continue;
        }
      }
      try {
        let contentType = mime.lookup(assetName);
        let contentLength = fs.statSync(assetPath).size;
        let file = fs.readFileSync(assetPath);
        // Upload a release asset
        // API Documentation: https://developer.github.com/v3/repos/releases/#upload-a-release-asset
        // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset
        await github.repos.uploadReleaseAsset({
          url: uploadUrl,
          headers: {
            "content-type": contentType,
            "content-length": contentLength
          },
          name: assetName,
          file
        });
        core.debug(`Upload Asset Success: ${assetName} - ${assetPath}`);
      } catch (error) {
        core.warning(`Upload Asset Fail: ${assetName}, ${error.message}`);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
