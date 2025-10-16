import Service from "@ember/service";

export default class ChatUppyUploadService extends Service {
  #instance = null;

  setInstance(value) {
    this.#instance = value;
  }

  clear() {
    this.#instance = null;
  }

  get instance() {
    return this.#instance;
  }
}
