import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { action } from "@ember/object";
import { equal, notEmpty } from "@ember/object/computed";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import willDestroy from "@ember/render-modifiers/modifiers/will-destroy";
import { htmlSafe } from "@ember/template";
import DButton from "discourse/components/d-button";
import DModal from "discourse/components/d-modal";
import loadScript from "discourse/lib/load-script";
import { uploadIcon } from "discourse/lib/uploads";
import { i18n } from "discourse-i18n";
import { service } from "@ember/service";

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

  @service chatUppyUpload;

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
    const now = new Date();
    const formattedDate = now.toISOString().replace(/:/g, "-").split(".")[0];
    blob.name = `recording_${formattedDate}.mp3`;
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
    this.flash = i18n(themePrefix("composer_audio.error.failed"));
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
      this.flash = i18n(themePrefix("composer_audio.error.no_record"));
      return;
    }

    if (this.chatContext) {
      this.chatUppyUpload.instance.addFiles([this._audioData]);

      if (options.send) {
        this.appEvents.one(
          `upload-mixin:${this.chatUppyUpload.instance.config.id}:all-uploads-complete`,
          () => this.model.onSend()
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

  <template>
    <DModal
      class="composer-audio-upload-modal"
      @closeModal={{@closeModal}}
      @title={{i18n (themePrefix "composer_audio_upload.title")}}
      @dismissable={{false}}
      @flash={{this.flash}}
      {{didInsert this.onShow}}
      {{willDestroy this.onCancelRecording}}
    >
      <:body>
        <div class="composer-audio-upload-buttons">
          <DButton
            @action={{this.startStopRecording}}
            @icon={{if this.isRecording "circle-stop" "circle"}}
            @translatedLabel={{i18n
              (themePrefix
                (if
                  this.isRecording
                  "composer_audio.action.stop_recording"
                  "composer_audio.action.start_recording"
                )
              )
            }}
            class="btn record-button
              {{if this.isRecording 'btn-danger' 'btn-secondary'}}"
            disabled={{this.disallowRecord}}
          />
        </div>
        <div class="composer-audio-upload-audio">
          {{#if this.isLoading}}
            <span class="wait-text">{{~htmlSafe
                (i18n (themePrefix "composer_audio.state.loading"))
              ~}}</span>
          {{else if this.isProcessing}}
            <span class="wait-text">{{~htmlSafe
                (i18n (themePrefix "composer_audio.state.processing"))
              ~}}</span>
          {{else if this.isRecordingStart}}
            <span class="wait-text">{{~htmlSafe
                (i18n (themePrefix "composer_audio.state.recording_start"))
              ~}}</span>
          {{else if this.isRecording}}
            {{~htmlSafe (i18n (themePrefix "composer_audio.state.recording"))~}}
          {{else if this.hasRecording}}
            {{this._audioEl}}
          {{else}}
            {{~htmlSafe
              (i18n (themePrefix "composer_audio.state.no_recording"))
            ~}}
          {{/if}}
        </div>
        <div class="composer-audio-upload-metadata">
          {{#if this.hasRecording}}
            <span>{{~htmlSafe
                (i18n
                  (themePrefix "composer_audio.metadata.size")
                  size=this.recordingSize
                )
              ~}}</span>
          {{/if}}
        </div>
      </:body>
      <:footer>
        <DButton
          @action={{this.uploadFile}}
          class="btn-primary upload"
          @icon={{this.uploadIcon}}
          @label="upload"
          @disabled={{this.disallowUpload}}
        />
        {{#if this.chatContext}}
          <DButton
            @action={{this.uploadFileAndSend}}
            class="btn-primary send"
            @icon="paper-plane"
            @translatedLabel={{i18n
              (themePrefix "composer_audio.button.upload_and_send")
            }}
            @disabled={{this.disallowUpload}}
          />
        {{/if}}
        <DButton @label="cancel" class="btn-flat" @action={{@closeModal}} />
      </:footer>
    </DModal>
  </template>
}
