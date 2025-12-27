// Déchiffreur de fichiers JavaScript chiffrés
// Remplacez VOTRE_CLE_DE_CHIFFREMENT_ICI par la clé générée par encrypt.js

const ENCRYPTION_KEY = 'f9af690a1294c7f87424abee93058edca8c9c0e1e563601097e2169cbfbae2d3'; // Clé de chiffrement
const ENCRYPTED_DIR = 'encrypted'; // Dossier contenant les fichiers chiffrés

// Fonction pour déchiffrer avec AES-256 (côté client)
async function decryptContent(encryptedData, key) {
    try {
        // Nettoyer les données (supprimer les espaces, retours à la ligne, etc.)
        encryptedData = encryptedData.trim().replace(/\s+/g, '');
        
        // Séparer l'IV et le contenu chiffré
        const parts = encryptedData.split(':');
        if (parts.length !== 2) {
            console.error('Format invalide: Le fichier doit contenir "IV:données_chiffrées"');
            console.error('Format reçu:', encryptedData.substring(0, 100) + '...');
            throw new Error('Format de données invalide: doit contenir "IV:données"');
        }
        
        const ivHex = parts[0].trim();
        const encryptedHex = parts[1].trim();
        
        // Vérifier que l'IV et les données sont en hexadécimal valide
        if (!/^[0-9a-fA-F]+$/.test(ivHex)) {
            throw new Error('IV invalide: doit être en hexadécimal');
        }
        if (!/^[0-9a-fA-F]+$/.test(encryptedHex)) {
            throw new Error('Données chiffrées invalides: doivent être en hexadécimal');
        }
        
        // Vérifier la longueur de l'IV (doit être 32 caractères hex = 16 bytes)
        if (ivHex.length !== 32) {
            throw new Error(`IV de longueur incorrecte: ${ivHex.length} caractères (attendu: 32)`);
        }
        
        // Vérifier que les données chiffrées ont une longueur valide (multiple de 32 pour AES-CBC)
        if (encryptedHex.length % 32 !== 0) {
            throw new Error(`Longueur des données chiffrées invalide: ${encryptedHex.length} caractères (doit être un multiple de 32 pour AES-CBC)`);
        }
        
        // Convertir la clé et l'IV en ArrayBuffer
        const keyBuffer = hexToArrayBuffer(key);
        const ivBuffer = hexToArrayBuffer(ivHex);
        
        // Vérifier la longueur de la clé (doit être 64 caractères hex = 32 bytes pour AES-256)
        if (key.length !== 64) {
            throw new Error(`Clé de longueur incorrecte: ${key.length} caractères (attendu: 64)`);
        }
        
        // Vérifier la longueur de l'IV en bytes (doit être 16 bytes pour AES-CBC)
        if (ivBuffer.byteLength !== 16) {
            throw new Error(`IV de longueur incorrecte: ${ivBuffer.byteLength} bytes (attendu: 16)`);
        }
        
        // Vérifier la longueur des données chiffrées en bytes (doit être un multiple de 16)
        const encryptedBuffer = hexToArrayBuffer(encryptedHex);
        if (encryptedBuffer.byteLength % 16 !== 0) {
            throw new Error(`Données chiffrées de longueur invalide: ${encryptedBuffer.byteLength} bytes (doit être un multiple de 16 pour AES-CBC)`);
        }
        
        console.log(`🔍 Débogage - IV: ${ivHex.substring(0, 16)}... (${ivHex.length} chars), Données: ${encryptedHex.length} chars (${encryptedBuffer.byteLength} bytes), Clé: ${key.substring(0, 16)}... (${key.length} chars)`);
        
        // Importer la clé
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );
        
        // Déchiffrer
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: ivBuffer },
            cryptoKey,
            encryptedBuffer
        );
        
        // Convertir en texte
        const decryptedText = new TextDecoder().decode(decryptedBuffer);
        return decryptedText;
    } catch (error) {
        console.error('Erreur lors du déchiffrement:', error);
        console.error('Type d\'erreur:', error.name);
        console.error('Message:', error.message);
        
        // Informations supplémentaires pour OperationError
        if (error.name === 'OperationError') {
            console.error('💡 OperationError indique généralement que:');
            console.error('   - La clé de chiffrement est incorrecte');
            console.error('   - Les données chiffrées sont corrompues');
            console.error('   - Le format des données ne correspond pas à AES-CBC');
            console.error('   - Vérifiez que la clé dans decrypt.js correspond à celle utilisée pour chiffrer');
        }
        
        throw error;
    }
}

// Convertir une chaîne hexadécimale en ArrayBuffer
function hexToArrayBuffer(hex) {
    // Vérifier que la longueur est paire
    if (hex.length % 2 !== 0) {
        throw new Error(`Longueur hex invalide: ${hex.length} (doit être paire)`);
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
}

// Charger et déchiffrer un fichier
async function loadAndDecrypt(filePath) {
    try {
        // Construire le chemin complet (avec le dossier encrypted)
        const fullPath = filePath.startsWith(ENCRYPTED_DIR + '/') 
            ? filePath 
            : ENCRYPTED_DIR + '/' + filePath;
        
        // Charger le fichier chiffré
        const response = await fetch(fullPath);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        let encryptedContent = await response.text();
        
        // Nettoyer le contenu (supprimer BOM, espaces, etc.)
        encryptedContent = encryptedContent.trim();
        // Supprimer le BOM UTF-8 si présent
        if (encryptedContent.charCodeAt(0) === 0xFEFF) {
            encryptedContent = encryptedContent.slice(1);
        }
        
        // Vérifier si la clé est configurée
        if (ENCRYPTION_KEY === 'VOTRE_CLE_DE_CHIFFREMENT_ICI') {
            console.error('❌ Erreur: La clé de chiffrement n\'a pas été configurée dans decrypt.js');
            throw new Error('Clé de chiffrement non configurée');
        }
        
        // Déchiffrer le contenu
        const decryptedContent = await decryptContent(encryptedContent, ENCRYPTION_KEY);
        
        // Vérifier si le script a déjà été chargé (pour éviter les doublons)
        const scriptId = 'encrypted-' + filePath.replace(/[^a-zA-Z0-9]/g, '-');
        if (document.getElementById(scriptId)) {
            console.log(`⚠️ ${filePath} déjà chargé, ignoré`);
            return true;
        }
        
        // Vérifier si des variables globales du script sont déjà définies
        // Pour common.js, vérifier GITHUB_API_URL
        if (filePath.includes('common.js') && typeof window.GITHUB_API_URL !== 'undefined') {
            console.log(`⚠️ ${filePath} déjà chargé (variables globales détectées), ignoré`);
            return true;
        }
        
        // Créer un script et l'exécuter
        const script = document.createElement('script');
        script.id = scriptId;
        script.textContent = decryptedContent;
        document.head.appendChild(script);
        
        return true;
    } catch (error) {
        console.error(`Erreur lors du chargement de ${filePath}:`, error);
        throw error;
    }
}

// Détecter et charger tous les scripts avec data-enc
function loadEncryptedScripts() {
    const encryptedScripts = document.querySelectorAll('script[data-enc]');
    
    if (encryptedScripts.length === 0) {
        console.warn('Aucun script chiffré trouvé');
        return;
    }
    
    console.log(`🔓 Déchiffrement de ${encryptedScripts.length} fichier(s)...`);
    
    // Charger les scripts séquentiellement pour respecter l'ordre
    (async () => {
        let successCount = 0;
        let errorCount = 0;
        
        for (const script of encryptedScripts) {
            const filePath = script.getAttribute('data-enc');
            try {
                await loadAndDecrypt(filePath);
                console.log(`✅ ${filePath} déchiffré et chargé`);
                successCount++;
            } catch (error) {
                console.error(`❌ Erreur avec ${filePath}:`, error);
                errorCount++;
                
                // Afficher une alerte pour les erreurs critiques
                if (filePath.includes('auth.js') || filePath.includes('config.js')) {
                    console.error('⚠️ Fichier critique non chargé:', filePath);
                }
            }
        }
        
        // Résumé du chargement
        if (errorCount > 0) {
            console.warn(`⚠️ ${errorCount} fichier(s) n'ont pas pu être chargés sur ${encryptedScripts.length}`);
        } else {
            console.log(`✅ Tous les fichiers (${successCount}) ont été chargés avec succès`);
        }
    })();
}

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEncryptedScripts);
} else {
    // DOM déjà chargé
    loadEncryptedScripts();
}

