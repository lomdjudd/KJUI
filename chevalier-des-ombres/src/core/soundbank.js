// Banque de sons générée à l'installation (instruments et bruitages rendus hors temps réel).
// Rempli dans une étape ultérieure ; l'API est déjà utilisée par l'installateur.
export const soundbank = {
  data: null,
  async render(quality, onProgress) {
    onProgress && onProgress(1, '');
    return { version: 0, rate: 0, samples: {} };
  },
  load(data) {
    this.data = data;
  },
};
