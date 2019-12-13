# Upload Release Asset

Upload Github Release Asset

## Usage:

### most cases (upload asset to current repo)

```yaml
- name: Upload Release Asset
  uses: lomocc/upload-release-asset@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    asset_path: dist/GXWorkInstaller.dmg
```

### particular cases (upload asset to other repo)

```yaml
- name: Upload Release Asset
  uses: lomocc/upload-release-asset@master
  env:
    GITHUB_TOKEN: ${{ secrets.RELEASE_GITHUB_TOKEN }}
  with:
    owner: ${{ secrets.RELEASE_GITHUB_OWNER }}
    repo: ${{ secrets.RELEASE_GITHUB_REPO }}
    tag_name: ${{ github.ref }}
    release_name: Release ${{ github.ref }}
    asset_path: dist/GXWorkSetup*{.exe,.dmg} # required
```
