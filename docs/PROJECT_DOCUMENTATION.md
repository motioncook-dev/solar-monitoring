# 🌞 Solar Monitoring - Documentation Technique

## 📋 Vue d'Ensemble du Projet

**Objectif** : Interface de monitoring pour contrôleur solaire Plasmatronics PL40 via RS232, avec API REST pour Home Assistant.

---

## 🎯 Matériel Cible

### Contrôleur Solaire PL Series
| Modèle | Courant Charge | Courant Load | Tension Système |
|--------|---------------|--------------|----------------|
| PL20 | 20A | 20A | 12-48V |
| PL40 | 40A | 7A | 12-48V |
| PL60 | 60A | 30A | 12-48V |

### Interface Required
- **PLI RS232 Adapter** → Convertisseur RS232 pour PL series
- **Câble WYS** → PL20/40 vers PLI
- **Câble WZS** → PL60 vers PLI
- **USB-Serial adapter** → Si pas de port série sur Raspberry Pi

---

## 🔌 Connexions Physiques

```
┌─────────────────┐     ┌──────────┐     ┌─────────────────┐
│   PL Controller │────▶│   PLI    │────▶│  Raspberry Pi   │
│   (Solar)       │     │ (RS232)  │     │  (USB-Serial)   │
└─────────────────┘     └──────────┘     └─────────────────┘
                            │
                    Optical Isolation
                    (500V DC)
```

### Broches PLI (DB9 Femelle)
| Pin | Signal | Description |
|-----|--------|-------------|
| 2 | TX | Data → Computer |
| 3 | RX | Data ← Computer |
| 5 | GND | Signal Ground |

### Configuration Câble WYS
- Connecteur 8-pin vers PL20/40 (sous le capot)
- Sortie à côté de l'écran LCD

---

## 📡 Protocole de Communication

### Spécifications
| Paramètre | Valeur |
|-----------|--------|
| Mode | Master/Slave (PC = Master) |
| Baud Rates | 300, 1200, 2400, 9600 |
| Data Format | 8 bit, No parity, 1 stop bit |
| Délai Réponse | ~70ms |

### Format de Commande (4 bytes)
```
[CMD] [ADDR] [DATA] [CHECK]
```
- **CMD** : Code commande (1 byte)
- **ADDR** : Adresse mémoire (1 byte)
- **DATA** : Donnée à écrire (0 pour lecture)
- **CHECK** : 1s complement de CMD (xor 0xFF)

### Codes Commande
| Hex | Décimal | Action |
|-----|---------|--------|
| 0x14 | 20 | Lecture RAM |
| 0x48 | 72 | Lecture EEPROM |
| 0x98 | 152 | Écriture RAM |
| 0xCA | 202 | Écriture EEPROM |
| 0xBB | 187 | Loopback test |
| 0x57 | 87 | Simulation bouton |

### Format de Réponse
**Double byte** (pour données) :
```
[200 (0xC8)] [DATA]
```

**Erreurs** :
| Code | Description |
|------|-------------|
| 5 | Pas de communication |
| 128 | Loopback OK |
| 129 | Commande non reconnue |
| 130 | PL n'a pas répondu |
| 131 | Erreur réponse PL |

### ⚠️ Note Importante
> Toutes les 6 minutes, le PL copie l'EEPROM vers le RAM (écrasant les modifications RAM).
> Pour des settings instantanés : écrire dans EEPROM d'abord, puis RAM.

---

## 📊 Données Disponibles (DATA Menu)

### Menu DATA → Valeurs Temps Réel
| Paramètre | Description | Unité |
|-----------|-------------|-------|
| VMAX | Tension batterie max | 0.1V |
| VMIN | Tension batterie min | 0.1V |
| SOC | State of Charge | % |
| FTIM | Float time | minutes |
| TEMP | Température batterie | °C |
| SOLV | Tension panneau solaire | 0.1V |

### Historique (30 jours)
| Donnée | Description |
|--------|-------------|
| Charge Ah | Énergie charge quotidienne |
| Load Ah | Énergie décharge quotidienne |
| VMAX/VMIN | Tensions max/min journalières |
| SOC | État de charge moyen |
| Float Time | Temps en phase float |

---

## 🏗️ Architecture du Projet

```
solar-monitoring/
├── config/
│   ├── default.yaml          # Configuration par défaut
│   └── usb-serial.yaml       # Mapping USB→Device
├── src/
│   ├── sensors/
│   │   ├── pl40.js           # Driver principal PL40
│   │   ├── protocol.js       # Parser protocole RS232
│   │   └── addresses.js      # Adresses mémoire PL40
│   ├── api/
│   │   ├── server.js         # Serveur REST
│   │   ├── routes/
│   │   │   ├── status.js     # /api/status
│   │   │   ├── history.js    # /api/history
│   │   │   └── config.js     # /api/config
│   │   └── homeassistant.js  # Auto-discovery HA
│   └── database/
│       ├── influx.js         # Connexion InfluxDB
│       └── sqlite.js         # Backup SQLite
├── scripts/
│   └── install.sh            # Installation Raspberry Pi
├── docs/
│   └── README.md             # Cette doc
└── package.json
```

---

## 🔧 Spécifications Techniques

### Driver PL40 (src/sensors/pl40.js)

```javascript
const PL40 = {
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  
  // Commandes de base
  commands: {
    readRam: 0x14,
    readEeprom: 0x48,
    writeRam: 0x98,
    writeEeprom: 0xCA,
    loopback: 0xBB,
    button: 0x57
  },
  
  // Adresses mémoire importantes (à vérifier)
  addresses: {
    version: 0x00,      // Version software
    soc: 0x0A,          // State of Charge
    vbat: 0x0C,         // Tension batterie
    vsolar: 0x0E,       // Tension solaire
    icharge: 0x10,      // Courant charge
    iload: 0x12,        // Courant load
    temp: 0x14,         // Température
    vmax: 0x16,         // Vmax journalier
    vmin: 0x18,         // Vmin journalier
    ahcharge: 0x1A,     // Ah charge aujourd'hui
    ahload: 0x1C,       // Ah load aujourd'hui
    floatTime: 0x1E,    // Temps float aujourd'hui
    status: 0x20        // Bits d'état
  }
}
```

### API REST

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/status` | GET | État temps réel |
| `/api/history` | GET | Historique 30 jours |
| `/api/config` | GET | Configuration actuelle |
| `/api/config` | POST | Modifier settings |
| `/health` | GET | Health check |

### Format JSON - /api/status

```json
{
  "timestamp": "2026-02-03T17:00:00Z",
  "controller": {
    "model": "PL40",
    "version": "6.4",
    "uptime": 86400
  },
  "battery": {
    "voltage": 13.8,
    "soc": 85,
    "temperature": 25,
    "state": "FLOAT"
  },
  "solar": {
    "voltage": 18.5,
    "current": 4.2,
    "power": 77.7
  },
  "load": {
    "current": 1.5,
    "state": "ON"
  },
  "history": {
    "chargeAh": 45.2,
    "loadAh": 12.3,
    "vmax": 14.4,
    "vmin": 12.1
  }
}
```

---

## 📦 Dépendances Node.js

```json
{
  "dependencies": {
    "serialport": "^12.0.0",
    "influxdb-client": "^1.33.0",
    "express": "^4.18.0",
    "yaml": "^2.3.0",
    "crc": "^4.3.0"
  }
}
```

---

## 🚀 Installation Raspberry Pi

```bash
# 1. Installation dépendances
sudo apt update
sudo apt install nodejs npm
sudo apt install python3-pip
sudo pip3 install pyserial  # Optionnel

# 2. Cloner le projet
cd /home/pi
git clone https://github.com/motioncook-dev/solar-monitoring.git
cd solar-monitoring

# 3. Installer Node.js packages
npm install

# 4. Configuration
cp config/default.yaml config/local.yaml
# Éditer local.yaml avec les bons paramètres USB

# 5. Service systemd
sudo cp solar-monitoring.service /etc/systemd/system/
sudo systemctl enable solar-monitoring
sudo systemctl start solar-monitoring
```

---

## 🔒 Configuration Home Assistant

### auto-discovery (MQTT ou REST)

```yaml
# configuration.yaml
# REST API integration via:
# http://<IP-RASPBERRY>:3000/api/status

# MQTT (si implémenté):
mqtt:
  sensor:
    - state_topic: "solar/pl40/status"
      name: "Solar SOC"
      unit_of_measurement: "%"
    - state_topic: "solar/pl40/status"
      value_template: "{{ value_json.battery.voltage }}"
      name: "Battery Voltage"
      unit_of_measurement: "V"
```

---

## 📋 À Faire / Questions Ouvertes

### Questions Techniques
- [ ] Adresses RAM exactes pour données temps réel (besoin tests)
- [ ] Format exact des données historique (30 jours)
- [ ] Procédure d'écriture EEPROM (unlock requis)

### Todo
- [ ] Créer driver serial basic
- [ ] Tester connexion avec PL40 réel
- [ ] Implémenter lecture données
- [ ] Créer API REST
- [ ] Intégrer InfluxDB
- [ ] Documentation auto

---

## 📚 Sources

- `PLI.Info.2.16.pdf` - Spécifications protocole
- `PL.Reference.Manual.6.4.0.pdf` - Manuel technique
- `Product.summary.V1.4.pdf` - Vue d'ensemble produit
- `FAQ.Voltage.Gen.Control.V3.00.pdf` - Exemples configuration

---

*Document généré le 2026-02-03*
*Projet : motioncook-dev/solar-monitoring*
