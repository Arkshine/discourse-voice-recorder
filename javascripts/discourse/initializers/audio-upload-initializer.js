import { withPluginApi } from "discourse/lib/plugin-api";
import AudioUpload from "../components/modal/audio-upload";

function initializePlugin(api) {
  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "composer_audio_upload",
      group: "extras",
      icon: "microphone",
      action: () => api.container.lookup("service:modal").show(AudioUpload),
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
