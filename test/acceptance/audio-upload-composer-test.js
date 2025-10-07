import {
  click,
  fillIn,
  find,
  settled,
  visit,
  waitFor,
  waitUntil,
} from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  query,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { i18n } from "discourse-i18n";

const uploadResponseFixtures = {
  id: 321,
  url: "/uploads/default/original/1X/61fdf6fac415541560e2d86e495f94d4dd201a18.mp3",
  original_filename: "recording.mp3",
  filesize: 36864,
  width: null,
  height: null,
  thumbnail_width: null,
  thumbnail_height: null,
  extension: "mp3",
  short_url: "upload://dYSqLbGQHdjJFT40TIVt56uSIOs.mp3",
  short_path: "/uploads/short-url/dYSqLbGQHdjJFT40TIVt56uSIOs.mp3",
  retain_hours: null,
  human_filesize: "36 KB",
  dominant_color: null,
  thumbnail: null,
};

const channelResponseFixtures = {
  public_channels: [
    {
      id: 4,
      chatable: {
        id: 4,
        name: "General",
        color: "25AAE2",
        slug: "general",
        slug_path: ["general"],
      },
      chatable_id: 4,
      chatable_type: "Category",
      chatable_url: "/c/general/4",
      title: "test",
      slug: "test",
      status: "open",
      memberships_count: 1,
      current_user_membership: {
        following: true,
        muted: false,
        chat_channel_id: 4,
      },
      meta: {
        message_bus_last_ids: {
          channel_message_bus_last_id: 0,
        },
      },
    },
  ],
  direct_message_channels: [],
  tracking: {
    channel_tracking: {},
    thread_tracking: {},
  },
  meta: {
    message_bus_last_ids: {},
  },
  unread_thread_overview: {},
  global_presence_channel_state: {},
};

acceptance("Audio Upload - Composer", function (needs) {
  needs.user();
  needs.settings({ authorized_extensions: "mp3" });
  needs.pretender((server, helper) => {
    server.post("/uploads.json", () => helper.response(uploadResponseFixtures));
  });

  needs.hooks.afterEach(function () {
    if (window.AudioRecorder) {
      window.AudioRecorder.stop?.();
    }
  });

  test("recording audio", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    await fillIn(".d-editor-input", "this is the content of my reply");

    const buttonClass = ".d-editor-button-bar .composer_audio_upload";
    assert.dom(buttonClass).exists("it adds a button to the composer toolbar");

    await click(buttonClass);
    assert.ok(visible(".d-modal"), "it pops up a modal");

    // Default state
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        i18n(themePrefix("composer_audio.action.start_recording")),
        "default button text is correct"
      );
    assert
      .dom(".d-modal .composer-audio-upload-audio")
      .hasText(
        i18n(themePrefix("composer_audio.state.no_recording")),
        "default description text is correct"
      );

    // Try to upload without recording
    await click(".d-modal .d-modal__footer button.btn-primary");

    assert
      .dom(".d-modal #modal-alert")
      .hasText(
        i18n(themePrefix("composer_audio.error.no_record")),
        "uploading without recording shows an error"
      );

    // Start recording [initial]
    await click(".d-modal .record-button");

    assert
      .dom(".d-modal #modal-alert")
      .doesNotExist("recording [initial]: starts without error");
    assert
      .dom(".d-modal .d-modal__footer button.btn-primary")
      .isDisabled("recording [initial]: upload button is disabled");
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        i18n(themePrefix("composer_audio.action.start_recording")),
        "recording [initial]: button text is correct"
      );
    assert
      .dom(".d-modal .composer-audio-upload-audio")
      .hasText(
        i18n(themePrefix("composer_audio.state.recording_start")),
        "recording [initial]: description is correct"
      );

    assert.ok(
      window.AudioRecorder,
      "recording [initial]: AudioRecorder is loaded"
    );

    await waitUntil(
      () => {
        return find(
          ".d-modal .composer-audio-upload-audio"
        ).textContent.includes(
          i18n(themePrefix("composer_audio.state.recording"))
        );
      },
      { timeout: 5000 }
    );

    // Start recording
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        i18n(themePrefix("composer_audio.action.stop_recording")),
        "recording: button text is correct"
      );

    assert
      .dom(".d-modal .composer-audio-upload-audio")
      .hasText(
        i18n(themePrefix("composer_audio.state.recording")),
        "recording: description is correct"
      );

    // Stop recording
    await click(".d-modal .record-button");
    await waitFor(".d-modal .composer-audio-upload-audio audio");

    assert
      .dom(".d-modal #modal-alert")
      .doesNotExist("stopped recording: stops without error");
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        i18n(themePrefix("composer_audio.action.start_recording")),
        "stopped recording: button text is correct"
      );
    assert
      .dom(".d-modal .d-modal__footer button.btn-primary")
      .isNotDisabled("stopped recording: upload button is enabled");
    assert
      .dom(".d-modal .composer-audio-upload-audio audio")
      .exists("stopped recording: audio element is present");
    assert
      .dom(".d-modal .composer-audio-upload-metadata span")
      .exists("stopped recording: metadata is present");

    // Composer upload
    await click(".d-modal .d-modal__footer button.btn-primary");

    await waitUntil(() => {
      return query(".d-editor-input").value.includes("audio");
    });
    await settled();

    assert
      .dom(".d-editor-input")
      .hasValue(
        `this is the content of my reply\n![${
          uploadResponseFixtures.original_filename.split(".")[0]
        }|audio](${uploadResponseFixtures.short_url})\n`,
        "composer upload: markdown is correct"
      );

    // Composer preview
    assert
      .dom(".d-editor-preview audio")
      .exists("composer preview: audio is present");
  });
});

acceptance("Audio Upload - Chat", function (needs) {
  needs.user({ has_chat_enabled: true, can_chat: true });
  needs.settings({ authorized_extensions: "mp3", chat_enabled: true });
  needs.pretender((server, helper) => {
    server.post("/uploads.json", () => helper.response(uploadResponseFixtures));
    server.get("/chat/api/me/channels", () =>
      helper.response(channelResponseFixtures)
    );
    server.post("/chat/:channel_id", () => helper.response());
    server.post("/chat/api/channels/:channel_id/memberships/me", () =>
      helper.response({})
    );
    server.post("/chat/api/channels/:channel_id/drafts", () =>
      helper.response({})
    );
    server.get("/chat/api/channels/:channel_id/messages", () =>
      helper.response({
        messages: [],
        meta: {
          target_message_id: null,
          can_load_more_future: false,
          can_load_more_past: false,
        },
        tracking: {},
      })
    );
  });

  needs.hooks.afterEach(function () {
    if (window.AudioRecorder) {
      window.AudioRecorder.stop?.();
    }
  });

  test("recording audio & upload", async function (assert) {
    await visit("/chat/c/general/4");

    assert
      .dom(".chat-composer-button.-voice-recorder")
      .exists("it adds a button to the composer");

    await click(".chat-composer-button.-voice-recorder");

    assert.dom(".d-modal").isVisible("it pops up a modal");

    await click(".d-modal .record-button"); // start recording

    await waitUntil(
      () => {
        return find(
          ".d-modal .composer-audio-upload-audio"
        ).textContent.includes(
          i18n(themePrefix("composer_audio.state.recording"))
        );
      },
      { timeout: 5000 }
    );

    await click(".d-modal .record-button"); // stop recording
    await waitFor(".d-modal .composer-audio-upload-audio audio");

    await click(".d-modal__footer button.upload");
    assert.dom(".d-modal").isNotVisible("modal is closed");
    assert.dom(".chat-composer-uploads-container").exists("audio is attached");

    await waitUntil(
      () => find(".chat-composer-button.-send").disabled === false,
      { timeout: 5000 }
    );

    await click(".chat-composer-button.-send");
    assert.dom(".chat-uploads audio").exists("audio is posted");
  });

  test("recording audio & send", async function (assert) {
    await visit("/chat/c/general/4");

    assert
      .dom(".chat-composer-button.-voice-recorder")
      .exists("it adds a button to the composer");
    await click(".chat-composer-button.-voice-recorder");

    assert.dom(".d-modal").isVisible("it pops up a modal");
    assert
      .dom(".d-modal__footer button .d-icon-paper-plane")
      .exists("send button is present");

    await click(".d-modal .record-button"); // start recording
    await waitUntil(
      () => {
        return find(
          ".d-modal .composer-audio-upload-audio"
        ).textContent.includes(
          i18n(themePrefix("composer_audio.state.recording"))
        );
      },
      { timeout: 5000 }
    );
    await settled();

    await click(".d-modal .record-button"); // stop recording
    await waitFor(".d-modal .composer-audio-upload-audio audio");

    await click(".d-modal__footer button.send");
    assert.dom(".d-modal").isNotVisible("modal is closed");

    await waitUntil(
      () => {
        return query(".chat-uploads audio");
      },
      { timeout: 5000 }
    );
    await settled();

    assert.dom(".chat-uploads audio").exists("audio is posted");
  });
});
