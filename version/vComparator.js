// vComparator.js 🖋️ Scritto da ChatGPT

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Registrato come modulo anonimo.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Non funziona con CommonJS rigoroso, ma solo con
        // ambienti simili a CommonJS che supportano module.exports,
        // come Node.
        module.exports = factory();
    } else {
        // Globali del browser (root è window)
        root.vComparator = factory();
    }
}(typeof self !== 'undefined' ? self : this, () => {
    // Contenuto del modulo
    const vComparator = {
        /**
         * Ottiene il tipo di versione di una data versione.
         *
         * @param   version  La versione da analizzare.
         * @returns Il tipo di versione: 'alpha', 'beta' o 'release'.
         */
        getVersionType: version => {
            if (version.toLowerCase().includes('alpha')) {
                return 'alpha';
            } else if (version.toLowerCase().includes('beta')) {
                return 'beta';
            } else {
                return 'release';
            }
        },

        /**
         * Ottiene la priorità di un tipo di versione.
         *
         * @param   versionType  Il tipo di versione: 'alpha', 'beta' o 'release'.
         * @returns La priorità del tipo di versione.
         */
        getVersionPriority: versionType => {
            const typeOrder = { 'alpha': 1, 'beta': 2, 'release': 3 };
            return typeOrder[versionType] || 0; // 0 per tipi sconosciuti
        },

        /**
         * Verifica se una data versione è valida.
         *
         * @param   version  La versione da verificare.
         * @returns True se la versione è valida, altrimenti false.
         */
        isValidVersion: version => {
            const versionRegex = /^\d+(\.\d+)*(\s+\w+)*$/;
            return versionRegex.test(version);
        },

        /**
         * Confronta due versioni software.
         *
         * @param   v1  La prima versione da confrontare.
         * @param   v2  La seconda versione da confrontare.
         * @returns -1 se v1 è più vecchia di v2, 1 se è più recente, altrimenti 0.
         */
        compareSoftwareVersions: (v1, v2) => {
            if (!vComparator.isValidVersion(v1) || !vComparator.isValidVersion(v2)) {
                throw new Error('Formato versione non valido');
            }

            const v1Type = vComparator.getVersionType(v1);
            const v2Type = vComparator.getVersionType(v2);

            const parts1 = v1.match(/\d+/g).map(Number);
            const parts2 = v2.match(/\d+/g).map(Number);

            for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                const num1 = parseInt(parts1[i] || 0);
                const num2 = parseInt(parts2[i] || 0);

                if (num1 !== num2) {
                    return (num1 < num2) ? -1 : 1;
                }
            }

            const priority1 = vComparator.getVersionPriority(v1Type);
            const priority2 = vComparator.getVersionPriority(v2Type);

            return priority1 - priority2;
        }
    };
    return vComparator;
}));
