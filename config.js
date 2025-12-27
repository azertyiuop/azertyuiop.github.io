const GITHUB_CONFIG = {
    token: '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', // TOKEN GIT
    gistId: null
};

// Exposer les valeurs sur window pour que common.js puisse les utiliser
window.GITHUB_TOKEN = GITHUB_CONFIG.token;
window.GITHUB_GIST_ID = GITHUB_CONFIG.gistId;
