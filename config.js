const GITHUB_CONFIG = {
    token: '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', // TOKEN GIT
    gistId: null
};

// Exposer les valeurs sur window pour que common.js puisse les utiliser
window.GITHUB_TOKEN = GITHUB_CONFIG.token;
window.GITHUB_GIST_ID = GITHUB_CONFIG.gistId;
