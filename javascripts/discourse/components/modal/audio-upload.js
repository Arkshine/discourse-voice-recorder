import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { action } from "@ember/object";
import { equal, notEmpty } from "@ember/object/computed";
import { getOwner } from "@ember/owner";
import loadScript from "discourse/lib/load-script";
import { uploadIcon } from "discourse/lib/uploads";
import I18n from "discourse-i18n";

export default class AudioUpload extends Component {
  @tracked state = "loading"; // 'loading', 'idle', 'recording', 'recording_start', 'playing', 'processing'
  @tracked flash;

  @equal("state", "recording") isRecording;
  @equal("state", "recording_start") isRecordingStart;
  @equal("state", "playing") isPlaying;
  @equal("state", "processing") isProcessing;
  @equal("state", "idle") isIdle;
  @equal("state", "loading") isLoading;
  @notEmpty("_audioEl") hasRecording;

  @tracked _audioEl = null;
  @tracked _audioData = null;

  _recorder = null;
  _chunks = [];
  _stream = null;

  get disallowPlayback() {
    return (
      (this.state !== "idle" && this.state !== "playing") || !this.hasRecording
    );
  }

  get disallowRecord() {
    return (
      this.state === "recording_start" ||
      (this.state !== "idle" && this.state !== "recording")
    );
  }

  get disallowUpload() {
    return this.state !== "idle";
  }

  get recordingSize() {
    if (this._audioData) {
      let bytes = this._audioData.size;

      return bytes < 1024
        ? bytes + " B"
        : Math.round((bytes * 10) / 1024) / 10 + " kB";
    }
    return "-";
  }

  get uploadIcon() {
    return uploadIcon(this.currentUser.staff, this.siteSettings);
  }

  get chatContext() {
    return this.model?.context === "channel";
  }

  _clearRecording() {
    this._recorder = null;
    this._audioData = null;
    if (this._audioEl) {
      this._audioEl.remove();
      this._audioEl = null;
    }
  }

  @action
  async onShow() {
    this._clearRecording();

    await loadScript(settings.theme_uploads.audiorecorder);
    await loadScript(settings.theme_uploads.mp3worker);

    if (window.AudioRecorder) {
      window.AudioRecorder.preload(settings.theme_uploads.mp3worker);
      this.state = "idle";
    }
  }

  onStart() {
    this.state = "recording";
  }

  onDataAvailable(data) {
    this._chunks.push(data);
  }

  onStop() {
    const blob = new Blob(this._chunks, { type: "audio/mp3" });
    blob.name = "recording.mp3";
    blob.lastModifiedDate = new Date();

    this._chunks = [];

    const audio = document.createElement("audio");
    audio.setAttribute("preload", "metadata");
    audio.setAttribute("controls", "true");
    audio.src = window.URL.createObjectURL(blob);

    this._audioEl = audio;
    this._audioData = blob;

    this.state = "idle";
  }

  onError(error) {
    this.flash = I18n.t(themePrefix("composer_audio.error.failed"));
    // eslint-disable-next-line no-console
    console.error(error);
  }

  @action
  uploadFileAndSend() {
    this.uploadFile({ send: true });
  }

  @action
  async uploadFile(options = {}) {
    if (!this._audioData) {
      this.flash = I18n.t(themePrefix("composer_audio.error.no_record"));
      return;
    }

    if (this.chatContext) {
      const chatComposerUploads = getOwner(this).lookup(
        "component:chat-composer-uploads"
      );

      this.appEvents.trigger(
        `upload-mixin:${chatComposerUploads.id}:add-files`,
        [this._audioData]
      );

      if (options.send) {
        this.appEvents.one(
          `upload-mixin:${chatComposerUploads.id}:all-uploads-complete`,
          async () => {
            await this.model.args.onSendMessage(this.model.draft);
            this.model.composer.textarea.refreshHeight();
          }
        );
      }
    } else {
      this.appEvents.trigger(`composer:add-files`, [this._audioData]);
    }

    this.closeModal();
  }

  @action
  onCancelRecording() {
    if (this.state === "recording" && this._recorder) {
      this._recorder.onstop = null; // prevent calling onStop
      this._recorder.stop();
    }

    this._clearRecording();
  }

  @action
  startStopRecording() {
    if (this.state === "idle") {
      this._clearRecording();

      this._recorder = new window.AudioRecorder({
        encoderBitRate: 128,
        streaming: true,
      });

      this.state = "recording_start";
      this.flash = "";

      this._recorder.onstart = this.onStart.bind(this);
      this._recorder.ondataavailable = this.onDataAvailable.bind(this);
      this._recorder.onstop = this.onStop.bind(this);
      this._recorder.onerror = this.onError.bind(this);

      this._recorder.start();
    } else if (this.state === "recording") {
      this.state = "processing";
      this._recorder.stop();
    }
  }
}
