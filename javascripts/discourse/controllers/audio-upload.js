import Controller from "@ember/controller";
import { equal, notEmpty } from "@ember/object/computed";
import { uploadIcon } from "discourse/lib/uploads";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { default as discourseComputed } from "discourse-common/utils/decorators";

function padStart(s, l, char) {
  let n = l - String(s).length;
  for (let i = 0; i < n; ++i) {
    s = char + s;
  }
  return s;
}

export default Controller.extend(ModalFunctionality, {
  state: "idle", // 'idle', 'recording', 'recording_start', 'playing', 'processing'
  isRecording: equal("state", "recording"),
  isRecordingStart: equal("state", "recording_start"),
  isPlaying: equal("state", "playing"),
  isProcessing: equal("state", "processing"),
  isIdle: equal("state", "idle"),
  hasRecording: notEmpty("_audioEl"),

  @discourseComputed("state", "hasRecording")
  disallowPlayback(state, hasRecording) {
    return (state !== "idle" && state !== "playing") || !hasRecording;
  },

  @discourseComputed("state")
  disallowRecord(state) {
    return (
      state === "recording_start" || (state !== "idle" && state !== "recording")
    );
  },

  @discourseComputed("state")
  disallowUpload(state) {
    return state !== "idle";
  },

  @discourseComputed("_audioData")
  recordingSize(data) {
    if (data) {
      let bytes = data.size;
      return bytes < 1024
        ? bytes + " B"
        : Math.round((bytes * 10) / 1024) / 10 + " kB";
    }
    return "-";
  },

  _recorder: null,
  _chunks: [],
  _audioData: null,
  _audioEl: null,
  _stream: null,

  @discourseComputed()
  uploadIcon() {
    return uploadIcon(this.currentUser.staff, this.siteSettings);
  },

  _clearRecording() {
    this._recorder = null;
    this.set("_audioData", null);
    if (this._audioEl) {
      this._audioEl.remove();
      this.set("_audioEl", null);
    }
  },

  onShow() {
    this._clearRecording();
  },

  onDataAvailable(e) {
    this._chunks.push(e.data);
  },

  onStop() {
    let blob = new Blob(this._chunks, { type: this._recorder.mimeType });
    blob.name = "recording.mp3";
    blob.lastModifiedDate = new Date();
    this._chunks = [];

    let audio = document.createElement("audio");
    audio.setAttribute("preload", "metadata");
    audio.setAttribute("controls", "true");
    audio.src = window.URL.createObjectURL(blob);

    this.setProperties({
      _audioEl: audio,
      _audioData: blob,
      state: "idle",
    });
  },

  actions: {
    uploadFile() {
      if (!this._audioData) {
        this.flash("You have to record something!", "error");
        return;
      }
      this.appEvents.trigger(`composer:add-files`, [this._audioData]);
      this.send("closeModal");
    },

    startStopRecording() {
      if (this.state === "idle") {
        this._clearRecording();

        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            this._stream = stream;
            this._recorder = new MediaRecorder(stream);
            this._recorder.ondataavailable = this.onDataAvailable.bind(this);
            this._recorder.onstop = this.onStop.bind(this);
            this._recorder.start();
            this.set("state", "recording_start");
            setTimeout(() => {
              this.set("state", "recording");
            }, 1050);
          })
          .catch((err) => {
            this.flash(
              "An error occured. Did you enable voice recording in your browser?"
            );
            console.error(err);
          });
      } else if (this.state === "recording") {
        this.set("state", "processing");
        this._recorder.stop();
        this._stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    },
  },
});
