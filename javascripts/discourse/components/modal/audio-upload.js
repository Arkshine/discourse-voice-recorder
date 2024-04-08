import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { action } from "@ember/object";
import { uploadIcon } from "discourse/lib/uploads";

function padStart(s, l, char) {
  let n = l - String(s).length;
  for (let i = 0; i < n; ++i) {
    s = char + s;
  }
  return s;
}

export default class AudioUpload extends Component {
  @tracked flash;
  @tracked flashType;

  @tracked state = "idle"; // 'idle', 'recording', 'recording_start', 'playing', 'processing'
  @tracked _audioEl = null;

  _recorder = null;
  _chunks = [];
  _audioData = null;
  _stream = null;

  get isRecording() {
    return this.state === "recording";
  }

  get isRecordingStart() {
    return this.state === "recording_start";
  }

  get isPlaying() {
    return this.state === "playing";
  }

  get isProcessing() {
    return this.state === "processing";
  }

  get isIdle() {
    return this.state === "idle";
  }

  get hasRecording() {
    return this._audioEl !== null;
  }

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

  _clearRecording() {
    this._recorder = null;
    this._audioData = null;
    if (this._audioEl) {
      this._audioEl.remove();
      this._audioEl = null;
    }
  }

  onShow() {
    this._clearRecording();
  }

  onDataAvailable(e) {
    this._chunks.push(e.data);
  }

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
  }

  @action
  uploadFile() {
    if (!this._audioData) {
      this.flash = "You have to record something!";
      this.flashType = "error";
      return;
    }
    this.appEvents.trigger(`composer:add-files`, [this._audioData]);
    this.closeModal();
  }

  @action
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
          this.flash =
            "An error occured. Did you enable voice recording in your browser?";
          this.flashType = "error";
          console.error(err);
        });
    } else if (this.state === "recording") {
      this.set("state", "processing");
      this._recorder.stop();
      this._stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  }
}
