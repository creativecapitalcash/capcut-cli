import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadDraft } from "./helpers/load-fixture.mjs";
import { spawnCli } from "./helpers/spawn-cli.mjs";
import { tmpDir, tmpDraft } from "./helpers/tmp-draft.mjs";

function dummyMedia(dir, name) {
  const p = join(dir, name);
  writeFileSync(p, "not a real video");
  return p;
}

describe("capcut add-broll", () => {
  it("defaults to a muted 'b-roll' track that covers the existing video track", () => {
    const fix = tmpDraft();
    try {
      const main = dummyMedia(fix.dir, "main.mp4");
      let r = spawnCli([
        "add-video",
        fix.path,
        main,
        "0",
        "5s",
        "--track-name",
        "main",
        "--width",
        "1920",
        "--height",
        "1080",
      ]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);

      const broll = dummyMedia(fix.dir, "broll.mp4");
      r = spawnCli(["add-broll", fix.path, broll, "1s", "2s", "--width", "1920", "--height", "1080"]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);
      assert.equal(r.json.volume, 0);
      assert.equal(r.json.covers_track, true);
      assert.equal(r.json.warning, undefined);

      const draft = loadDraft(fix.path);
      const brollTrack = draft.tracks.find((t) => t.name === "b-roll");
      assert.ok(brollTrack, "creates a 'b-roll' track by default");
      assert.equal(brollTrack.segments[0].volume, 0);

      const videoTracks = draft.tracks.filter((t) => t.type === "video").map((t) => t.name);
      assert.equal(videoTracks.at(-1), "b-roll", "b-roll renders above the main track");
    } finally {
      fix.cleanup();
    }
  });

  it("warns and reports covers_track: false when no other video track exists yet", () => {
    const t = tmpDir();
    try {
      let r = spawnCli(["init", "broll-only", "--drafts", t.dir]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);
      const draftPath = join(t.dir, "broll-only", "draft_content.json");

      const broll = dummyMedia(t.dir, "early-broll.mp4");
      r = spawnCli(["add-broll", draftPath, broll, "0", "1s", "--width", "1920", "--height", "1080"]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);
      assert.equal(r.json.covers_track, false);
      assert.match(r.json.warning, /no existing video track/i);
    } finally {
      t.cleanup();
    }
  });

  it("the default b-roll track stays topmost even when other video is added afterward", () => {
    const t = tmpDir();
    try {
      let r = spawnCli(["init", "order-test", "--drafts", t.dir]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);
      const draftPath = join(t.dir, "order-test", "draft_content.json");

      const broll = dummyMedia(t.dir, "early-broll.mp4");
      r = spawnCli(["add-broll", draftPath, broll, "0", "1s", "--width", "1920", "--height", "1080"]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);

      const main = dummyMedia(t.dir, "later-main.mp4");
      r = spawnCli([
        "add-video",
        draftPath,
        main,
        "0",
        "1s",
        "--track-name",
        "later-main",
        "--width",
        "1920",
        "--height",
        "1080",
      ]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);

      const draft = loadDraft(draftPath);
      const videoTracks = draft.tracks.filter((t2) => t2.type === "video").map((t2) => t2.name);
      assert.deepEqual(videoTracks, ["later-main", "b-roll"]);
    } finally {
      t.cleanup();
    }
  });

  it("a custom --track-name opts out of the always-on-top promotion", () => {
    const t = tmpDir();
    try {
      let r = spawnCli(["init", "custom-name-order", "--drafts", t.dir]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);
      const draftPath = join(t.dir, "custom-name-order", "draft_content.json");

      const broll = dummyMedia(t.dir, "early-broll.mp4");
      r = spawnCli([
        "add-broll",
        draftPath,
        broll,
        "0",
        "1s",
        "--track-name",
        "custom-broll",
        "--width",
        "1920",
        "--height",
        "1080",
      ]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);

      const main = dummyMedia(t.dir, "later-main.mp4");
      r = spawnCli([
        "add-video",
        draftPath,
        main,
        "0",
        "1s",
        "--track-name",
        "later-main",
        "--width",
        "1920",
        "--height",
        "1080",
      ]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);

      const draft = loadDraft(draftPath);
      const videoTracks = draft.tracks.filter((t2) => t2.type === "video").map((t2) => t2.name);
      assert.deepEqual(videoTracks, ["custom-broll", "later-main"]);
    } finally {
      t.cleanup();
    }
  });

  it("honors an explicit --volume and --track-name override", () => {
    const fix = tmpDraft();
    try {
      const media = dummyMedia(fix.dir, "loud-broll.mp4");
      const r = spawnCli([
        "add-broll",
        fix.path,
        media,
        "0",
        "1s",
        "--volume",
        "0.4",
        "--track-name",
        "custom-broll",
        "--width",
        "1920",
        "--height",
        "1080",
      ]);
      assert.equal(r.status, 0, `stderr: ${r.stderr}`);
      assert.equal(r.json.volume, 0.4);

      const draft = loadDraft(fix.path);
      const track = draft.tracks.find((t) => t.name === "custom-broll");
      assert.ok(track, "honors --track-name");
      assert.equal(track.segments[0].volume, 0.4);
    } finally {
      fix.cleanup();
    }
  });
});
