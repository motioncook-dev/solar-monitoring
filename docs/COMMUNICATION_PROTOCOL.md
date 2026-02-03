# 🌞 Solar Monitoring - Protocole de Communication PL40

## 📡 Comment Lire les Données du PL40

### 1. Format de Commande (4 bytes)

```
[CMD] [ADDR] [DATA] [CHECK]
├─────┘ └──┬──┘ └──┬──┘ └──┬──┘
   │        │        │       │
   │        │        │       └─→ Check = CMD XOR 0xFF
   │        │        └─────────→ 0 pour lecture, donnée pour écriture
   │        └─────────────────→ Adresse mémoire (0-255)
   └───────────────────────────→ Code commande
```

### 2. Commandes de Base

| CMD (Hex) | CMD (Dec) | Action | Check |
|-----------|-----------|--------|-------|
| 0x14 | 20 | Lire RAM | 0xEB (235) |
| 0x48 | 72 | Lire EEPROM | 0xB7 (183) |
| 0x98 | 152 | Écrire RAM | 0x67 (103) |
| 0xCA | 202 | Écrire EEPROM | 0x35 (53) |
| 0xBB | 187 | Loopback test | 0x44 (68) |

### 3. Réponse du Contrôleur

**Lecture réussie (double byte)** :
```
[200 (0xC8)] [DATA]
```

**Codes d'erreur** :
| Code | Signification |
|------|---------------|
| 5 | Pas de communication |
| 128 | Loopback OK |
| 129 | Commande non reconnue |
| 130 | Pas de réponse du PL |
| 131 | Erreur réponse |

---

## 🔌 Connexion Physique

### Broches DB9 (PLI)
| Pin | Signal | Direction |
|-----|--------|-----------|
| 2 | TX | PL → PC |
| 3 | RX | PC → PL |
| 5 | GND | Masse |

### Configuration Série
```
Baud Rate : 9600 (ou 2400 si problèmes)
Data Bits : 8
Parity : None
Stop Bits : 1
Flow Control : None
```

### Délai entre commandes : ~100-200ms

---

## 📊 Adresses RAM pour Données Temps Réel

### Batterie
| Adresse | Nom | Unité | Formule |
|---------|-----|-------|---------|
| 50 (0x32) | Vbat | 0.1V | `valeur × (V système / 12V)` |
| 52 (0x34) | Temp Batterie | °C | `valeur - 100` (si négatif) |
| 181 (0xB5) | SOC | % | `valeur直接` |
| 124 (0x7C) | Vmin journalier | 0.1V | `valeur × (V système / 12V)` |
| 125 (0x7D) | Vmax journalier | 0.1V | `valeur × (V système / 12V)` |

### Panneau Solaire
| Adresse | Nom | Unité | Formule |
|---------|-----|-------|---------|
| 53 (0x35) | SOLV | 0.5V | `valeur × 0.5` |
| 231 (0xE7) | V_solaire_LSB | 0.1V | `valeur × (V système / 12V)` |
| 232 (0xE8) | V_solaire_MSB | V | `MSB × 256 + LSB` |
| 212 (0xD4) | I_charge | 0.1A | `PL20: 0.1A/étape, PL40: 0.2A/étape` |

### Charge/Décharge (Ah)
| Adresse | Nom | Formule |
|---------|-----|---------|
| 188 (0xBC) | Ah_charge_LSB | `LSB + (MSB × 256)` |
| 189 (0xBD) | Ah_charge_MSB | |
| 195 (0xC3) | Ah_load_LSB | `LSB + (MSB × 256)` |
| 196 (0xC4) | Ah_load_MSB | |

### État du Contrôleur
| Adresse | Nom | Valeurs |
|---------|-----|---------|
| 101 (0x65) | rstate | 0=Boost, 1=Equal, 2=Absorb, 3=Float |
| 0 (0x00) | Version | 0-127=PL20, 128-191=PL40, 192-210=PL60 |

---

## 📈 Lecture de l'Historique (30 jours)

### Format d'un Record Journalier (7 bytes)
| Offset | Donnée | Unité |
|--------|--------|-------|
| 0 | Vmax | 0.1V (× Vsys/12V) |
| 1 | Vmin | 0.1V (× Vsys/12V) |
| 2 | Float Time | 0.1 heure (6 min) |
| 3 | SOC | % |
| 4 | Ah Charge | LSB |
| 5 | Ah Load | LSB |
| 6 (low) | Ah Charge MSB | `MSB × 256` |
| 6 (high) | Ah Load MSB | `MSB × 256` |

### Calcul du Pointer d'Historique

**Adresse du pointer** : 45 (0x2D)

```
Pointer = valeur à l'adresse 45
Offset Jour 1 = 0x2E + (7 × Pointer)

Jour m : Offset = Offset_Jour1 - (7 × (m-1))
Si Offset < 0x2E → wraparound à (Offset_Jour1 + 0xD2 - 7×(m-1))
```

### Exemple de Lecture
```
Pointer = 0x02 (2)
Jour 1 : offset = 0x2E + (7×2) = 0x3C (60)
  - Vmax = addr 60
  - Vmin = addr 61
  - FTime = addr 62
  - SOC = addr 63
  - Ah_in = addr 64
  - Ah_out = addr 65
  - Ah_MSB = addr 66 (low nibble = Charge, high nibble = Load)
```

---

## 💾 Stockage des Données

### Structure JSON pour Base de Données

```json
{
  "timestamp": "2026-02-03T17:00:00Z",
  "controller": {
    "model": "PL40",
    "version": 6.4,
    "system_voltage": 24
  },
  "realtime": {
    "battery": {
      "voltage": 13.8,
      "soc": 85,
      "temperature": 25.0,
      "state": "FLOAT"
    },
    "solar": {
      "voltage": 18.5,
      "current": 4.2,
      "power": 77.7
    },
    "load": {
      "current": 1.5,
      "ah_today": 12.3
    }
  },
  "daily": {
    "charge_ah": 45.2,
    "load_ah": 12.3,
    "vmax": 14.4,
    "vmin": 12.1,
    "float_hours": 8.5
  },
  "history": [
    {
      "day": 1,
      "date": "2026-02-02",
      "vmax": 14.8,
      "vmin": 12.0,
      "float_hours": 9.2,
      "soc_avg": 82,
      "charge_ah": 48.5,
      "load_ah": 10.2
    }
  ]
}
```

### Base de Données Recommandée

**InfluxDB (pour production)**
```
Measurement: solar_pl40
Tags: controller=PL40, system_voltage=24V
Fields:
  - battery_voltage (float)
  - battery_soc (integer)
  - battery_temperature (float)
  - solar_voltage (float)
  - solar_current (float)
  - solar_power (float)
  - load_current (float)
  - charge_ah (float)
  - load_ah (float)
  - state (string)
```

**SQLite (pour backup local)**
```sql
CREATE TABLE readings (
    id INTEGER PRIMARY KEY,
    timestamp DATETIME,
    battery_voltage REAL,
    battery_soc INTEGER,
    battery_temperature REAL,
    solar_voltage REAL,
    solar_current REAL,
    load_current REAL,
    charge_ah REAL,
    load_ah REAL,
    state TEXT
);

CREATE TABLE daily_history (
    id INTEGER PRIMARY KEY,
    date DATE,
    vmax REAL,
    vmin REAL,
    float_hours REAL,
    soc_avg INTEGER,
    charge_ah REAL,
    load_ah REAL
);
```

---

## 🔧 Exemples de Code (Node.js)

### Lecture Tension Batterie
```javascript
// Envoyer: [20, 50, 0, 235] (CMD=20, ADDR=50, DATA=0, CHECK=235)
// Réponse: [200, bbb]
const readBattery = async (port) => {
  const cmd = Buffer.from([0x14, 0x32, 0x00, 0xEB]);
  port.write(cmd);
  await delay(150);
  const response = await readResponse(port);
  // response = [200, bbb]
  const voltage = response[1] * (systemVoltage / 12);
  return voltage; // ex: 13.8V
};
```

### Lecture SOC
```javascript
// Envoyer: [20, 181, 0, 0x75] (0xB5 = 181)
// Réponse: [200, xx] où xx = SOC en %
const readSOC = async (port) => {
  const cmd = Buffer.from([0x14, 0xB5, 0x00, 0x4A]); // 0xEB XOR 0xA1 = 0x4A
  port.write(cmd);
  await delay(150);
  const response = await readResponse(port);
  return response[1]; // SOC en %
};
```

### Lecture Historique Complet
```javascript
const readHistory = async (port) => {
  // 1. Lire le pointer
  const ptrCmd = Buffer.from([0x14, 0x2D, 0x00, 0xD2]);
  port.write(ptrCmd);
  await delay(150);
  const ptrResp = await readResponse(port);
  const pointer = ptrResp[1];
  
  // 2. Calculer offset du jour 1
  const baseOffset = 0x2E + (7 * pointer);
  const history = [];
  
  // 3. Lire 30 jours
  for (let day = 1; day <= 30; day++) {
    let offset = baseOffset - (7 * (day - 1));
    if (offset < 0x2E) {
      offset = baseOffset + 0xD2 - (7 * (day - 1));
    }
    
    // Lire 7 bytes
    const dayData = await readBytes(port, offset, 7);
    history.push(parseDayRecord(dayData));
  }
  
  return history;
};

const parseDayRecord = (data) => {
  const chargeAh = data[4] + ((data[6] & 0x0F) * 256);
  const loadAh = data[5] + (((data[6] & 0xF0) >> 4) * 256);
  
  return {
    vmax: data[0] * 0.1 * systemVoltageRatio,
    vmin: data[1] * 0.1 * systemVoltageRatio,
    floatHours: data[2] * 0.1,
    soc: data[3],
    chargeAh: chargeAh,
    loadAh: loadAh
  };
};
```

---

## ⏱️ Procédure de Lecture Optimisée

### Séquence de Lecture Complète
```
1. Loopback Test
   └─→ Vérifier connexion [187, 0, 0, 68]
       └─→ Attendre 128

2. Lire Version (ADDR 0)
   └─→ Déterminer modèle (PL20/40/60)

3. Lire Tension Système (ADDR 93)
   └─→ Déterminer ratio (12V=×1, 24V=×2, 48V=×4)

4. Lire Données Temps Réel
   ├─→ Batterie: ADDR 50, 52, 181
   ├─→ Solaire: ADDR 53, 231, 212
   ├─→ Charge: ADDR 212, 188, 189
   └─→ Load: ADDR 216, 195, 196

5. Lire État (ADDR 101)
   └─→ Déterminer phase (Boost/Equal/Absorb/Float)

6. Lire Historique (si nécessaire)
   └─→ Récupérer pointer (ADDR 45)
       └─→ Parser 30 jours
```

### Intervalle de Lecture Recommandé
- **Temps réel** : toutes les 30 secondes
- **Historique** : une fois par jour (minuit)
- **Export HA** : toutes les 5 minutes

---

## ⚠️ Notes Importantes

1. **EEPROM Update** : Toutes les 6 minutes, le PL copie EEPROM → RAM
   → Pour settings instantanés : écrire EEPROM puis RAM

2. **Voltage Scaling** : Toutes les tensions sont stockées en base 12V
   → 24V : multiplier par 2
   → 48V : multiplier par 4

3. **Courant Scaling** : Dépend du modèle
   - PL20 : 0.1A/étape
   - PL40 : 0.2A/étape
   - PL60 : 0.4A/étape

4. **DELAI** : Attendre 100-200ms entre chaque commande

5. **BUFFER** : Vider les buffers RX/TX avant chaque transmission

---

*Document généré le 2026-02-03*
*Basé sur PLI.Info.2.16.pdf et PL.Reference.Manual.6.4.0.pdf*
