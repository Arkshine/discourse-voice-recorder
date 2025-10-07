import { getOwner } from "@ember/application";
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

  const siteSettings = api.container.lookup("service:site-settings");

  if (siteSettings.chat_enabled) {
    api.registerChatComposerButton?.({
      id: "voice-recorder",
      icon: "microphone",
      title: themePrefix("composer.composer_audio_upload_button_title"),
      displayed() {
        return this.currentUser.can_chat && this.canAttachUploads;
      },
      action() {
        getOwner(this).lookup("service:modal").show(AudioUpload, {
          model: this,
        });
      },
    });
  }
}

export default {
  name: "composer-audio-upload",

  initialize() {
    withPluginApi("0.1", initializePlugin);
  },
};
