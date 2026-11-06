import * as core from "@actions/core";
import { uploadReleaseAsset } from "./upload-release-asset";

async function run() {
  try {
    await uploadReleaseAsset();
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
