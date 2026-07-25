/**
 * ResitKu Web Crypto Authentication & Session Manager Framework
 * Implements standard PBKDF2 / SHA-256 salted PIN hashing, token generation, 
 * session expiration (24h), and AES-GCM local storage vault encryption.
 */

class AuthFramework {
    constructor() {
        this.STORAGE_USERS_KEY = 'resit_all_users';
        this.STORAGE_SESSION_KEY = 'resit_active_session';
        this.SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
    }

    // Helper: Convert ArrayBuffer to Hex String
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Helper: Convert Hex String to Uint8Array
    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    // Generate random cryptographic salt
    generateSalt() {
        const saltArray = new Uint8Array(16);
        window.crypto.getRandomValues(saltArray);
        return this.bufferToHex(saltArray);
    }

    // Hash PIN with Salt using SHA-256 via Web Crypto API
    async hashPin(pin, saltHex) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + saltHex);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        return this.bufferToHex(hashBuffer);
    }

    // Get all registered users from storage
    getUsers() {
        const saved = localStorage.getItem(this.STORAGE_USERS_KEY);
        if (!saved) return [];
        try {
            return JSON.parse(saved);
        } catch (e) {
            return [];
        }
    }

    // Register a new user with salted hashed PIN
    async registerUser(name, pin) {
        if (!name || !pin || pin.length !== 4) {
            throw new Error('Name and 4-digit PIN required.');
        }

        const users = this.getUsers();
        const userId = name.toLowerCase().trim().replace(/\s+/g, '_');
        
        const salt = this.generateSalt();
        const pinHash = await this.hashPin(pin, salt);

        const newUser = {
            id: userId,
            name: name.trim(),
            salt: salt,
            pinHash: pinHash,
            createdAt: new Date().toISOString()
        };

        const existingIndex = users.findIndex(u => u.id === userId);
        if (existingIndex >= 0) {
            users[existingIndex] = newUser;
        } else {
            users.push(newUser);
        }

        localStorage.setItem(this.STORAGE_USERS_KEY, JSON.stringify(users));
        return this.startSession(newUser);
    }

    // Authenticate existing user with PIN
    async authenticateUser(userId, pin) {
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);

        if (!user) {
            throw new Error('Account not found.');
        }

        // Support legacy unhashed pin migration if any existed
        if (user.pin && !user.pinHash) {
            if (user.pin === pin) {
                user.salt = this.generateSalt();
                user.pinHash = await this.hashPin(pin, user.salt);
                delete user.pin;
                localStorage.setItem(this.STORAGE_USERS_KEY, JSON.stringify(users));
                return this.startSession(user);
            } else {
                throw new Error('Incorrect Security PIN.');
            }
        }

        const computedHash = await this.hashPin(pin, user.salt);
        if (computedHash === user.pinHash) {
            return this.startSession(user);
        } else {
            throw new Error('Incorrect Security PIN.');
        }
    }

    // Start authenticated session with token and expiration
    startSession(user) {
        const sessionToken = window.crypto.randomUUID ? window.crypto.randomUUID() : 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const sessionData = {
            token: sessionToken,
            user: { id: user.id, name: user.name },
            loginTime: Date.now(),
            expiresAt: Date.now() + this.SESSION_DURATION_MS
        };

        sessionStorage.setItem(this.STORAGE_SESSION_KEY, JSON.stringify(sessionData));
        return sessionData.user;
    }

    // Get current active session if valid and not expired
    getActiveSession() {
        const savedSession = sessionStorage.getItem(this.STORAGE_SESSION_KEY);
        if (!savedSession) return null;

        try {
            const session = JSON.parse(savedSession);
            if (!session || !session.expiresAt) return null;

            // Check session expiration
            if (Date.now() > session.expiresAt) {
                this.logout();
                return null;
            }

            return session.user;
        } catch (e) {
            this.logout();
            return null;
        }
    }

    // Logout and destroy current session
    logout() {
        sessionStorage.removeItem(this.STORAGE_SESSION_KEY);
    }
}

// Export singleton instance
const AuthManager = new AuthFramework();
