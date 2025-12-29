// Système de stockage Firebase Realtime Database
// Remplace GitHub Gist - Gratuit et sans limite de rate

// Initialisation Firebase (sera chargé depuis le CDN)
let firebaseApp = null;
let firebaseDatabase = null;
let isFirebaseInitialized = false;

// Fonction pour initialiser Firebase
async function initFirebase() {
    if (isFirebaseInitialized && firebaseDatabase) {
        return firebaseDatabase;
    }
    
    // Vérifier si Firebase est chargé
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK non chargé. Veuillez inclure le script Firebase dans votre page.');
    }
    
    // Vérifier la configuration
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.databaseURL) {
        throw new Error('Configuration Firebase non trouvée. Veuillez configurer firebase-config.js');
    }
    
    try {
        // Initialiser Firebase
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
        }
        
        // Obtenir la référence à la base de données
        firebaseDatabase = firebase.database();
        isFirebaseInitialized = true;
        
        return firebaseDatabase;
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de Firebase:', error);
        throw error;
    }
}

// Fonction pour charger toutes les données depuis Firebase
async function loadDataFromFirebase() {
    try {
        const db = await initFirebase();
        const snapshot = await db.ref('appData').once('value');
        const data = snapshot.val();
        
        // Si pas de données, initialiser avec des valeurs par défaut
        if (!data) {
            const defaultData = {
                links: [],
                socialLinks: { discord: '', x: '' },
                adminCredentials: null,
                statistics: {
                    clicks: [],
                    visits: [],
                    dailyVisits: {}
                },
                adminMessages: [] // Messages à afficher aux visiteurs
            };
            await saveDataToFirebase(defaultData);
            return defaultData;
        }
        
        return data;
    } catch (error) {
        console.error('Erreur lors du chargement des données Firebase:', error);
        throw error;
    }
}

// Fonction pour sauvegarder toutes les données sur Firebase
async function saveDataToFirebase(data) {
    try {
        console.log('🔥 Firebase - Début de la sauvegarde');
        console.log('🔥 Firebase - setupPageEnabled:', data.setupPageEnabled);
        
        const db = await initFirebase();
        console.log('🔥 Firebase - Connexion établie, envoi des données...');
        
        await db.ref('appData').set(data);
        
        console.log('✅ Firebase - Données sauvegardées avec succès');
        console.log('✅ Firebase - setupPageEnabled sauvegardé:', data.setupPageEnabled);
        
        return true;
    } catch (error) {
        console.error('❌ Firebase - Erreur lors de la sauvegarde:', error);
        throw error;
    }
}

// Fonction pour écouter les nouvelles visites en temps réel
function listenToNewVisits(callback) {
    initFirebase().then(db => {
        // Écouter les nouvelles visites
        db.ref('appData/statistics/visits').limitToLast(1).on('child_added', (snapshot) => {
            const visit = snapshot.val();
            if (visit && callback) {
                callback(visit);
            }
        });
    }).catch(error => {
        console.error('Erreur lors de l\'écoute des visites:', error);
    });
}

// Fonction pour écouter les nouveaux messages admin
function listenToAdminMessages(callback) {
    initFirebase().then(db => {
        db.ref('appData/adminMessages').on('value', (snapshot) => {
            const messages = snapshot.val() || [];
            if (callback) {
                callback(messages);
            }
        });
    }).catch(error => {
        console.error('Erreur lors de l\'écoute des messages:', error);
    });
}

// Fonction pour ajouter un message admin
async function addAdminMessage(message) {
    try {
        const data = await loadDataFromFirebase();
        data.adminMessages = data.adminMessages || [];
        
        const newMessage = {
            id: Date.now().toString(),
            text: message.text,
            type: message.type || 'info', // info, warning, success, error
            timestamp: new Date().toISOString(),
            active: message.active !== false
        };
        
        data.adminMessages.push(newMessage);
        
        // Garder seulement les 50 derniers messages
        if (data.adminMessages.length > 50) {
            data.adminMessages = data.adminMessages.slice(-50);
        }
        
        await saveDataToFirebase(data);
        return newMessage;
    } catch (error) {
        console.error('Erreur lors de l\'ajout du message:', error);
        throw error;
    }
}

// Fonction pour supprimer un message admin
async function deleteAdminMessage(messageId) {
    try {
        const data = await loadDataFromFirebase();
        data.adminMessages = data.adminMessages || [];
        data.adminMessages = data.adminMessages.filter(msg => msg.id !== messageId);
        await saveDataToFirebase(data);
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        throw error;
    }
}

// Exposer les fonctions globalement
window.initFirebase = initFirebase;
window.loadDataFromFirebase = loadDataFromFirebase;
window.saveDataToFirebase = saveDataToFirebase;
window.listenToNewVisits = listenToNewVisits;
window.listenToAdminMessages = listenToAdminMessages;
window.addAdminMessage = addAdminMessage;
window.deleteAdminMessage = deleteAdminMessage;

