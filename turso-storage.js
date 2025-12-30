// Système de stockage Turso
// Remplace Firebase Realtime Database et Supabase
// Utilise l'API HTTP de Turso (libSQL)

let tursoClient = null;
let isTursoInitialized = false;

// Fonction pour initialiser Turso
async function initTurso() {
    if (isTursoInitialized && tursoClient) {
        return tursoClient;
    }
    
    // Vérifier la configuration
    if (!window.TURSO_CONFIG || !window.TURSO_CONFIG.url || !window.TURSO_CONFIG.token) {
        throw new Error('Configuration Turso non trouvée. Veuillez configurer config.js');
    }
    
    try {
        // Nettoyer l'URL (enlever libsql://, https://, etc.)
        let cleanUrl = window.TURSO_CONFIG.url;
        cleanUrl = cleanUrl.replace(/^libsql:\/\//, ''); // Enlever libsql://
        cleanUrl = cleanUrl.replace(/^https?:\/\//, ''); // Enlever http:// ou https://
        cleanUrl = cleanUrl.replace(/\/$/, ''); // Enlever le slash final
        
        tursoClient = {
            url: cleanUrl,
            token: window.TURSO_CONFIG.token
        };
        isTursoInitialized = true;
        return tursoClient;
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de Turso:', error);
        throw error;
    }
}

// Fonction pour exécuter une requête SQL sur Turso
async function tursoQuery(sql, params = []) {
    const client = await initTurso();
    
    // Format correct pour Turso : passer les valeurs directement
    // Turso détecte automatiquement le type (string, number, null)
    // Pas besoin de formatage spécial avec type/value
    const formattedParams = params.map(param => {
        // Passer directement la valeur - Turso gère automatiquement les types
        return param;
    });
    
    const response = await fetch(`https://${client.url}/v2/pipeline`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${client.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [{
                type: 'execute',
                stmt: {
                    sql: sql,
                    args: formattedParams
                }
            }]
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erreur Turso (${response.status}): ${error}`);
    }
    
    const result = await response.json();
    return result.results?.[0]?.response?.result;
}

// Fonction pour créer le schéma si nécessaire
async function ensureSchema() {
    try {
        await tursoQuery(`
            CREATE TABLE IF NOT EXISTS app_data (
                id INTEGER PRIMARY KEY DEFAULT 1,
                links TEXT NOT NULL DEFAULT '[]',
                social_links TEXT NOT NULL DEFAULT '{"discord":"","x":""}',
                admin_credentials TEXT,
                statistics TEXT NOT NULL DEFAULT '{"clicks":[],"visits":[],"daily_visits":{}}',
                admin_messages TEXT NOT NULL DEFAULT '[]',
                setup_page_enabled INTEGER NOT NULL DEFAULT 1
            );
        `);
    } catch (error) {
        console.warn('Erreur lors de la création du schéma (peut déjà exister):', error);
    }
}

// Fonction pour charger toutes les données depuis Turso
async function loadDataFromTurso() {
    try {
        await ensureSchema();
        
        const result = await tursoQuery('SELECT * FROM app_data WHERE id = 1');
        
        if (!result || !result.rows || result.rows.length === 0) {
            // Initialiser avec des valeurs par défaut
            const defaultData = {
                links: [],
                socialLinks: { discord: '', x: '' },
                adminCredentials: null,
                statistics: { clicks: [], visits: [], dailyVisits: {} },
                adminMessages: [],
                setupPageEnabled: true
            };
            
            await saveDataToTurso(defaultData);
            return defaultData;
        }
        
        const row = result.rows[0];
        
        // Convertir les données JSON stockées en texte
        return {
            links: JSON.parse(row.links || '[]'),
            socialLinks: JSON.parse(row.social_links || '{"discord":"","x":""}'),
            adminCredentials: row.admin_credentials ? JSON.parse(row.admin_credentials) : null,
            statistics: {
                clicks: JSON.parse(row.statistics || '{"clicks":[],"visits":[],"daily_visits":{}}').clicks || [],
                visits: JSON.parse(row.statistics || '{"clicks":[],"visits":[],"daily_visits":{}}').visits || [],
                dailyVisits: JSON.parse(row.statistics || '{"clicks":[],"visits":[],"daily_visits":{}}').daily_visits || {}
            },
            adminMessages: JSON.parse(row.admin_messages || '[]'),
            setupPageEnabled: row.setup_page_enabled !== 0
        };
    } catch (error) {
        console.error('❌ Erreur lors du chargement des données Turso:', error);
        throw error;
    }
}

// Fonction pour sauvegarder toutes les données sur Turso
async function saveDataToTurso(data) {
    try {
        await ensureSchema();
        
        const tursoData = {
            links: JSON.stringify(data.links || []),
            social_links: JSON.stringify(data.socialLinks || { discord: '', x: '' }),
            admin_credentials: data.adminCredentials ? JSON.stringify(data.adminCredentials) : null,
            statistics: JSON.stringify({
                clicks: data.statistics?.clicks || [],
                visits: data.statistics?.visits || [],
                daily_visits: data.statistics?.dailyVisits || {}
            }),
            admin_messages: JSON.stringify(data.adminMessages || []),
            setup_page_enabled: data.setupPageEnabled !== false ? 1 : 0
        };
        
        // Vérifier si les données existent déjà
        const existing = await tursoQuery('SELECT id FROM app_data WHERE id = 1');
        
        if (existing && existing.rows && existing.rows.length > 0) {
            // Mettre à jour
            await tursoQuery(
                `UPDATE app_data SET 
                    links = ?, 
                    social_links = ?, 
                    admin_credentials = ?, 
                    statistics = ?, 
                    admin_messages = ?, 
                    setup_page_enabled = ? 
                WHERE id = 1`,
                [
                    tursoData.links,
                    tursoData.social_links,
                    tursoData.admin_credentials,
                    tursoData.statistics,
                    tursoData.admin_messages,
                    tursoData.setup_page_enabled
                ]
            );
        } else {
            // Insérer
            await tursoQuery(
                `INSERT INTO app_data (id, links, social_links, admin_credentials, statistics, admin_messages, setup_page_enabled) 
                VALUES (1, ?, ?, ?, ?, ?, ?)`,
                [
                    tursoData.links,
                    tursoData.social_links,
                    tursoData.admin_credentials,
                    tursoData.statistics,
                    tursoData.admin_messages,
                    tursoData.setup_page_enabled
                ]
            );
        }
        
        if (window.DATA_CACHE) {
            window.DATA_CACHE.data = data;
            window.DATA_CACHE.lastLoad = 0;
            window.DATA_CACHE.lastSuccessfulSave = Date.now();
        }
        
        try {
            const now = Date.now();
            localStorage.setItem('lastDataSave', now.toString());
            localStorage.setItem('cachedData', JSON.stringify(data));
            localStorage.setItem('cachedDataTime', now.toString());
        } catch (e) {}
        
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde Turso:', error);
        throw error;
    }
}

// Fonction pour écouter les nouvelles visites en temps réel (via polling)
function listenToNewVisits(callback) {
    let lastVisitCount = 0;
    
    setInterval(async () => {
        try {
            const data = await loadDataFromTurso();
            const visits = data.statistics?.visits || [];
            
            if (visits.length > lastVisitCount) {
                const newVisits = visits.slice(lastVisitCount);
                newVisits.forEach(visit => {
                    if (callback) callback(visit);
                });
                lastVisitCount = visits.length;
            }
        } catch (error) {
            console.error('Erreur lors de l\'écoute des visites:', error);
        }
    }, 5000); // Vérifier toutes les 5 secondes
}

// Fonction pour écouter les nouveaux messages admin (via polling)
function listenToAdminMessages(callback) {
    let lastMessageCount = 0;
    
    setInterval(async () => {
        try {
            const data = await loadDataFromTurso();
            const messages = data.adminMessages || [];
            
            if (messages.length !== lastMessageCount) {
                if (callback) callback(messages);
                lastMessageCount = messages.length;
            }
        } catch (error) {
            console.error('Erreur lors de l\'écoute des messages:', error);
        }
    }, 3000); // Vérifier toutes les 3 secondes
}

// Fonction pour ajouter un message admin
async function addAdminMessage(message) {
    try {
        const data = await loadDataFromTurso();
        data.adminMessages = data.adminMessages || [];
        
        const newMessage = {
            id: Date.now().toString(),
            text: message.text,
            type: message.type || 'info',
            timestamp: new Date().toISOString(),
            active: message.active !== false
        };
        
        data.adminMessages.push(newMessage);
        
        // Garder seulement les 50 derniers messages
        if (data.adminMessages.length > 50) {
            data.adminMessages = data.adminMessages.slice(-50);
        }
        
        await saveDataToTurso(data);
        return newMessage;
    } catch (error) {
        console.error('Erreur lors de l\'ajout du message:', error);
        throw error;
    }
}

// Fonction pour supprimer un message admin
async function deleteAdminMessage(messageId) {
    try {
        const data = await loadDataFromTurso();
        data.adminMessages = data.adminMessages || [];
        data.adminMessages = data.adminMessages.filter(msg => msg.id !== messageId);
        
        await saveDataToTurso(data);
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        throw error;
    }
}

// Exposer les fonctions globalement
window.initTurso = initTurso;
window.loadDataFromTurso = loadDataFromTurso;
window.saveDataToTurso = saveDataToTurso;
// Alias pour compatibilité avec l'ancien code
window.loadDataFromFirebase = loadDataFromTurso;
window.saveDataToFirebase = saveDataToTurso;
window.initSupabase = initTurso; // Pour compatibilité avec Supabase
window.loadDataFromSupabase = loadDataFromTurso;
window.saveDataToSupabase = saveDataToTurso;
window.listenToNewVisits = listenToNewVisits;
window.listenToAdminMessages = listenToAdminMessages;
window.addAdminMessage = addAdminMessage;
window.deleteAdminMessage = deleteAdminMessage;

// Initialiser Turso automatiquement si la configuration est disponible
(function() {
    if (typeof window !== 'undefined' && window.TURSO_CONFIG && window.TURSO_CONFIG.url && window.TURSO_CONFIG.token) {
        // Initialiser de manière asynchrone sans bloquer
        initTurso().catch(error => {
            console.warn('⚠️ Initialisation Turso automatique échouée (sera réessayée lors de la première requête):', error);
        });
    }
})();

