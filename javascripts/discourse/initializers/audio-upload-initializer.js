import { default as Composer } from "discourse/components/d-editor";
import { withPluginApi } from "discourse/lib/plugin-api";
import showModal from "discourse/lib/show-modal";

function initializePlugin(api) {
  Composer.reopen({
    actions: {
      showAudioUploadModal: function () {
        showModal("audio_upload", {
          title: themePrefix("composer_audio_upload.title"),
        });
      },
    },
  });

  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "composer_audio_upload",
      group: "extras",
      icon: "microphone",
      action: "showAudioUploadModal",
      title: themePrefix("composer.composer_audio_upload_button_title"),
    });
  });
}

export default {
  name: "composer-audio-upload",

  initialize() {
    withPluginApi("0.1", initializePlugin);
  },
};
