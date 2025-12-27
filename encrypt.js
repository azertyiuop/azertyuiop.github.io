// Script d'encryption pour chiffrer les fichiers JavaScript
// Utilisation: node encrypt.js

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Configuration
const ENCRYPTED_DIR = 'encrypted';
const SOURCE_DIR = 'src'; // Dossier contenant les fichiers source à chiffrer (optionnel)

// Fichiers à exclure (ne pas chiffrer)
const EXCLUDED_FILES = ['decrypt.js', 'encrypt.js', 'config.js'];

// Générer une clé AES-256 (64 caractères hex = 32 bytes)
function generateKey() {
    return crypto.randomBytes(32).toString('hex');
}

// Chiffrer un fichier avec AES-256-CBC
function encryptFile(filePath, key) {
    try {
        // Lire le contenu du fichier
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Générer un IV aléatoire (16 bytes = 32 caractères hex)
        const iv = crypto.randomBytes(16);
        
        // Créer le cipher
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
        
        // Chiffrer le contenu
        let encrypted = cipher.update(content, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Format: IV:données_chiffrées
        const encryptedData = iv.toString('hex') + ':' + encrypted;
        
        return encryptedData;
    } catch (error) {
        console.error(`Erreur lors du chiffrement de ${filePath}:`, error.message);
        throw error;
    }
}

// Trouver les fichiers à chiffrer
function findFilesToEncrypt() {
    const filesToEncrypt = [];
    
    // 1. Vérifier les arguments de ligne de commande
    const args = process.argv.slice(2);
    if (args.length > 0) {
        args.forEach(arg => {
            if (fs.existsSync(arg) && arg.endsWith('.js') && !EXCLUDED_FILES.includes(path.basename(arg))) {
                filesToEncrypt.push(arg);
            }
        });
        if (filesToEncrypt.length > 0) {
            return filesToEncrypt;
        }
    }
    
    // 2. Vérifier si le dossier src existe
    if (fs.existsSync(SOURCE_DIR) && fs.statSync(SOURCE_DIR).isDirectory()) {
        const files = fs.readdirSync(SOURCE_DIR)
            .filter(file => file.endsWith('.js') && !EXCLUDED_FILES.includes(file))
            .map(file => path.join(SOURCE_DIR, file));
        if (files.length > 0) {
            return files;
        }
    }
    
    // 3. Chercher les fichiers .js à la racine (sauf ceux exclus)
    const rootFiles = fs.readdirSync('.')
        .filter(file => {
            if (!file.endsWith('.js')) return false;
            if (EXCLUDED_FILES.includes(file)) return false;
            if (file.includes('.enc.js')) return false; // Ne pas re-chiffrer les fichiers déjà chiffrés
            const stat = fs.statSync(file);
            return stat.isFile();
        })
        .map(file => path.join('.', file));
    
    return rootFiles;
}

// Fonction principale
function main() {
    console.log('🔐 Script d\'encryption de fichiers JavaScript\n');
    
    // Vérifier si le dossier encrypted existe, sinon le créer
    if (!fs.existsSync(ENCRYPTED_DIR)) {
        fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
        console.log(`✅ Dossier "${ENCRYPTED_DIR}" créé.`);
    }
    
    // Générer ou utiliser une clé existante
    let encryptionKey;
    const keyFile = 'encryption_key.txt';
    
    if (fs.existsSync(keyFile)) {
        encryptionKey = fs.readFileSync(keyFile, 'utf8').trim();
        console.log(`📝 Utilisation de la clé existante depuis ${keyFile}`);
    } else {
        encryptionKey = generateKey();
        fs.writeFileSync(keyFile, encryptionKey, 'utf8');
        console.log(`🔑 Nouvelle clé générée et sauvegardée dans ${keyFile}`);
    }
    
    console.log(`\n🔑 Clé de chiffrement: ${encryptionKey}`);
    
    // Trouver les fichiers à chiffrer
    const filesToEncrypt = findFilesToEncrypt();
    
    if (filesToEncrypt.length === 0) {
        console.error(`\n❌ Aucun fichier .js trouvé à chiffrer.`);
        console.log('\n💡 Options:');
        console.log('   1. Créez un dossier "src" et placez-y vos fichiers JavaScript');
        console.log('   2. Placez vos fichiers .js à la racine du projet');
        console.log('   3. Spécifiez les fichiers en paramètres: node encrypt.js fichier1.js fichier2.js');
        console.log('\n⚠️  Fichiers exclus (non chiffrés):', EXCLUDED_FILES.join(', '));
        process.exit(1);
    }
    
    console.log(`\n📁 ${filesToEncrypt.length} fichier(s) trouvé(s) à chiffrer...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Chiffrer chaque fichier
    filesToEncrypt.forEach(filePath => {
        const fileName = path.basename(filePath);
        const encryptedFileName = fileName.replace('.js', '.enc.js');
        const encryptedPath = path.join(ENCRYPTED_DIR, encryptedFileName);
        
        try {
            const encryptedData = encryptFile(filePath, encryptionKey);
            fs.writeFileSync(encryptedPath, encryptedData, 'utf8');
            console.log(`✅ ${fileName} → ${encryptedFileName}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Erreur avec ${fileName}:`, error.message);
            errorCount++;
        }
    });
    
    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ ${successCount} fichier(s) chiffré(s) avec succès`);
    if (errorCount > 0) {
        console.log(`   ❌ ${errorCount} fichier(s) en erreur`);
    }
    
    // Mettre à jour decrypt.js avec la clé
    const decryptJsPath = 'decrypt.js';
    if (fs.existsSync(decryptJsPath)) {
        let decryptContent = fs.readFileSync(decryptJsPath, 'utf8');
        
        // Remplacer la clé dans decrypt.js
        const keyPattern = /const ENCRYPTION_KEY = ['"]([^'"]+)['"]/;
        if (keyPattern.test(decryptContent)) {
            decryptContent = decryptContent.replace(keyPattern, `const ENCRYPTION_KEY = '${encryptionKey}'`);
            fs.writeFileSync(decryptJsPath, decryptContent, 'utf8');
            console.log(`\n✅ decrypt.js mis à jour avec la nouvelle clé`);
        } else {
            console.log(`\n⚠️  Impossible de mettre à jour automatiquement decrypt.js`);
            console.log(`   Veuillez remplacer manuellement la clé par: ${encryptionKey}`);
        }
    } else {
        console.log(`\n⚠️  decrypt.js non trouvé`);
        console.log(`   Veuillez mettre à jour manuellement la clé: ${encryptionKey}`);
    }
    
    console.log(`\n✅ Terminé !`);
    console.log(`\n💡 Important: Gardez ${keyFile} en sécurité !`);
    console.log(`   Sans cette clé, vous ne pourrez plus déchiffrer vos fichiers.`);
}

// Exécuter
main();

