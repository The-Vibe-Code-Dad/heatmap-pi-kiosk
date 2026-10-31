import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "image-builder/build-image.sh",
  "image-builder/build-image.ps1",
  "image-builder/install-build-deps.sh",
  "image-builder/README.md",
  "image-builder/stage5-kiosk/01-heatmap-kiosk/00-run-chroot.sh",
  "pi/heatmap-kiosk-browser.sh",
  "pi/heatmap-kiosk-session.sh",
  "rescue.sh",
  "pi/rescue-pi-kiosk.sh"
];

test("pi image builder files are present", async () => {
  await Promise.all(
    requiredFiles.map(async (file) => {
      await access(new URL(`../${file}`, import.meta.url));
    })
  );

  assert.ok(true);
});

test("pi image builder excludes prior output artifacts from staged app copies", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /--exclude "image-builder\/output"/);
});

test("pi image builder can reuse an existing pi-gen checkout on a different branch", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /PI_GEN_REPO="\$\{PI_GEN_REPO:-https:\/\/github\.com\/RPi-Distro\/pi-gen\.git\}"/);
  assert.match(buildScript, /config core\.filemode false/);
  assert.match(buildScript, /reset --hard HEAD/);
  assert.match(buildScript, /clean -fd/);
  assert.match(buildScript, /remote set-url origin "\$\{PI_GEN_REPO\}"/);
  assert.match(buildScript, /checkout -B "\$\{PI_GEN_BRANCH\}" FETCH_HEAD/);
});

test("pi image builder fetches the public pi-gen repo without interactive credential prompts", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /GIT_TERMINAL_PROMPT=0/);
  assert.match(buildScript, /GIT_ASKPASS=/);
  assert.match(buildScript, /credential\.helper=/);
});

test("pi image builder shell-escapes generated config values", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /write_config_value\(\)/);
  assert.match(buildScript, /printf -v escaped_value "%q" "\$\{config_value\}"/);
  assert.match(buildScript, /write_config_value "FIRST_USER_PASS" "\$\{FIRST_USER_PASS\}"/);
  assert.match(buildScript, /write_config_value "WPA_PASSWORD" "\$\{WPA_PASSWORD\}"/);
});

test("windows image builder passes values as argv env entries instead of shell text", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.ps1", import.meta.url), "utf8");

  assert.match(buildScript, /\$wslArgs = @\("-d", \$WslDistro, "--", "env"\)/);
  assert.match(buildScript, /\$envParts \+= "FIRST_USER_PASS=\$FirstUserPass"/);
  assert.match(buildScript, /\$envParts \+= "WPA_PASSWORD=\$WifiPassword"/);
  assert.match(buildScript, /'cd "\$1" && bash \.\/build-image\.sh'/);
  assert.doesNotMatch(buildScript, /\$envPrefix/);
});

test("pi image builder falls back to a Linux work dir when the repo lives on an unsupported filesystem", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /fuseblk\|drvfs\|exfat\|fuse\.exfat\|msdos\|ntfs\|ntfs3\|vfat/);
  assert.match(buildScript, /WORK_DIR="\/tmp\/heatmap-pi-kiosk-image-builder-work"/);
});

test("pi image builder clears stale deploy outputs before collecting artifacts", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /clear_pi_gen_deploy\(\)/);
  assert.match(buildScript, /find "\$\{PI_GEN_DIR\}\/deploy" -mindepth 1 -maxdepth 1 -exec rm -rf \{\} \+/);
  assert.match(buildScript, /clear_pi_gen_deploy\nstage_kiosk_app/);
});

test("pi image builder skips generic exports so only the kiosk image is emitted", async () => {
  const buildScript = await readFile(new URL("../image-builder/build-image.sh", import.meta.url), "utf8");

  assert.match(buildScript, /for generic_export_stage in stage2 stage4/);
  assert.match(buildScript, /"\$\{PI_GEN_DIR\}\/\$\{generic_export_stage\}\/SKIP_IMAGES"/);
});

test("pi image builder labels the custom export with the kiosk suffix", async () => {
  const exportScript = await readFile(new URL("../image-builder/stage5-kiosk/EXPORT_IMAGE", import.meta.url), "utf8");

  assert.match(exportScript, /IMG_SUFFIX="-kiosk"/);
});

test("pi image-builder kiosk stage delegates boot and session setup to the installer", async () => {
  const stageScript = await readFile(
    new URL("../image-builder/stage5-kiosk/01-heatmap-kiosk/00-run-chroot.sh", import.meta.url),
    "utf8"
  );

  assert.match(stageScript, /PI_IMAGE_BUILD=1 \.\/pi\/install-pi-kiosk\.sh/);
  assert.doesNotMatch(stageScript, /user-session=LXDE/);
  assert.doesNotMatch(stageScript, /do_boot_behaviour B4/);
});

test("pi image-builder kiosk stage rebuilds the custom rootfs on reruns", async () => {
  const prerunScript = await readFile(new URL("../image-builder/stage5-kiosk/prerun.sh", import.meta.url), "utf8");

  assert.match(prerunScript, /rm -rf "\$\{ROOTFS_DIR\}"/);
  assert.match(prerunScript, /copy_previous/);
  assert.doesNotMatch(prerunScript, /if \[ ! -f/);
});
