/**
 * Solar Gateway - Complete Setup Guide
 * 
 * How to connect PL40 to Raspberry Pi over 30m using Arduino + ESP-01
 */

// ============================================================================
// HARDWARE LIST
// ============================================================================

/*
Required:
- Arduino Uno (or compatible)           ~5€
- ESP-01 ESP8266 module               ~2-3€
- Breadboard (optional)                ~2€
- Jumper wires                        ~2€
- PLI RS232 adapter (already owned)

Total: ~10-15€
*/

// ============================================================================
// WIRING DIAGRAM
// ============================================================================

/*
    PL40 Controller          Arduino Uno            ESP-01
    ──────────────          ────────────          ──────
       PLI Port    ──────→   USB Serial    ──────→  ESP-01
       (4-pin)             (or Serial pins)         WiFi
                            D10 = RX
                            D11 = TX
                                   │
                                   ├──→ 3.3V (VCC, CH_PD, GPIO0)
                                   └──→ GND
                                         │
                                         ▼
                                   WiFi Network
                                         │
                                         ▼
                                   Raspberry Pi 4
                                   TCP Server :8888
*/

// ============================================================================
// STEP-BY-STEP SETUP
// ============================================================================

/*
STEP 1: Connect Arduino to ESP-01
-----------------------------------

Arduino Uno      ESP-01
-----------      ------
3.3V      ────── VCC
3.3V      ────── CH_PD
3.3V      ────── GPIO0
GND       ────── GND
D10 (RX)  ────── TXD
D11 (TX)  ────── RXD

NOTE: ESP-01 requires 3.3V only!
      Arduino 3.3V pin may not provide enough current.
      Use external 3.3V regulator if needed.


STEP 2: Connect PL40 to Arduino
--------------------------------

Option A: USB (easiest)
- Connect PLI RS232 to Arduino via USB
- Use Hardware Serial (Serial object)

Option B: Serial pins
- PLI TX → Arduino RX (pin 0)
- PLI RX → Arduino TX (pin 1)


STEP 3: Configure WiFi
----------------------

Edit solar_gateway.ino:

const char* WIFI_SSID = "TON_RESEAU_WIFI";
const char* WIFI_PASSWORD = "TON_MOT_DE_PASSE";


STEP 4: Configure Raspberry Pi IP
---------------------------------

Edit solar_gateway.ino:

const char* SERVER_HOST = "192.168.1.100";  // Change to your Pi IP
const int SERVER_PORT = 8888;


STEP 5: Upload Code to Arduino
-------------------------------

1. Open Arduino IDE
2. File → Open → solar_gateway.ino
3. Tools → Board → Arduino Uno
4. Tools → Port → (your Arduino)
5. Upload button


STEP 6: Setup Raspberry Pi
--------------------------

1. Copy files to Raspberry Pi:
   - src/gateway/tcp-server.js
   - src/driver/pli-driver.js

2. Install dependencies:
   npm install

3. Start TCP server:
   node src/gateway/tcp-server.js


STEP 7: Test Connection
------------------------

On Arduino (Serial Monitor 115200):
- Should see "WiFi OK"
- Should see "Connecté!"

On Raspberry Pi:
- Should see "Nouvelle connexion"
*/

// ============================================================================
// TESTING PROCEDURE
// ============================================================================

/*
1. Power up Arduino + ESP-01
2. Watch Serial Monitor for WiFi connection
3. Start TCP server on Raspberry Pi
4. Arduino should connect to TCP server
5. Send test command from Pi to Arduino
6. Verify PL40 responds (check display on PL40)
*/

// ============================================================================
// VERIFICATION
// ============================================================================

/*
If working:
- Arduino LED slow blinking
- TCP server shows "Nouvelle connexion"
- Data flows in both directions

If not working:
- Check Serial Monitor for errors
- Verify WiFi credentials
- Check Raspberry Pi firewall (port 8888)
- Verify ESP-01 power (3.3V, ~300mA)
*/

// ============================================================================
// COMMONLY ASKED QUESTIONS
// ============================================================================

/*
Q: Do I need the PLI adapter?
A: Yes, the PLI converts PL40 signals to RS232.
   The Arduino receives RS232 from PLI.

Q: Can I use ESP-01 without Arduino?
A: Yes, but:
   - RS PLI needs232 from voltage level conversion
   - Arduino is simpler for this project

Q: What about RS485?
A: More reliable for 30m, but more complex.
   WiFi is simpler and should work for your setup.

Q: What baud rate?
A: PLI defaults to 9600 baud.
   Change jumpers on PLI if needed.
*/
