/**
 * Solar Gateway - Complete Documentation
 * 
 * Hardware: Arduino Uno + ESP-01 (ESP8266)
 * Purpose: Bridge PL40 solar controller to WiFi network
 */

// ============================================================================
// PINOUT DIAGRAM
// ============================================================================

/*
    Arduino Uno Pinout
    ==================
    
              +------------+
         SCL | A5         | D13 ── LED_BUILTIN
         SDA | A4         | D12
              |            | D11 ──→ TX ESP-01 (SoftwareSerial TX)
              |   UNO      | D10 ──← RX ESP-01 (SoftwareSerial RX)
              |            | D9
              |            | D8
              |            | D7
              |            | D6
              |            | D5
              |            | D4
              |            | D3
              |            | D2
         GND ─┤ GND        | GND ── GND ESP-01
         VIN ─┤ VIN        | AREF
              |            | A0
              +------------+
              
    ESP-01 Pinout
    ============
    
              +------+
         VCC ─┤1    8├─ GPIO2
         CH_PD┤2    7├─ GPIO0 ── 3.3V (normal) or GND (flash)
         GPIO0┤3    6├─ TXD ───→ Arduino D10 (RX)
         GPIO2┤4    5├─ RXD ───→ Arduino D11 (TX)
              +------+              
              3.3V ─ VCC
              GND  ─ GND
              
    Complete Wiring
    ===============
    
    Arduino          ESP-01
    -------          ------
    3.3V     ─────── VCC
    3.3V     ─────── CH_PD
    3.3V     ─────── GPIO0
    GND      ─────── GND
    D10 (RX) ─────── TXD
    D11 (TX) ─────── RXD
*/

// ============================================================================
// WIRING TABLE
// ============================================================================

/*
┌─────────────────┬────────────┬─────────────────┐
│ Arduino Uno     │ ESP-01     │ Notes           │
├─────────────────┼────────────┼─────────────────┤
│ 3.3V            │ VCC        │ Power 3.3V      │
│ 3.3V            │ CH_PD      │ Chip enable     │
│ 3.3V            │ GPIO0      │ Boot mode       │
│ GND             │ GND        │ Ground          │
│ D10 (SoftwareRX)│ TXD        │ TX→RX           │
│ D11 (SoftwareTX)│ RXD        │ TX←RX           │
└─────────────────┴────────────┴─────────────────┘
*/

// ============================================================================
// POWER CONSIDERATIONS
// ============================================================================

/*
IMPORTANT: ESP-01 requires 3.3V and can draw up to 300mA!

Options:
1. Use Arduino 3.3V pin (may be unstable)
2. Use external 3.3V regulator (recommended)
3. Use USB 5V → 3.3V regulator module

Recommended: AMS1117-3.3V regulator module (~1€)
*/

// ============================================================================
// STATUS LED CODES
// ============================================================================

/*
LED on pin 13 (builtin)
========================

Pattern          Meaning
------           --------
Off              Disconnected / Error
On (solid)       Connecting to WiFi/TCP
Slow blink       Connected & Ready
Fast blink       Data Transfer

Activity LED:
- Connected + blinking = Data flowing
- Connected + steady = No activity
*/

// ============================================================================
// CONFIGURATION
// ============================================================================

/*
Before uploading, change these values:

1. WiFi Credentials:
   const char* WIFI_SSID = "ton_reseau_wifi";
   const char* WIFI_PASSWORD = "ton_mot_de_passe";

2. Raspberry Pi IP:
   const char* SERVER_HOST = "192.168.1.100";
*/

// ============================================================================
// SETUP INSTRUCTIONS
// ============================================================================

/*
Step 1: Install ESP8266 Board
-----------------------------
- Arduino IDE → File → Preferences
- Additional Board Manager URLs:
  http://arduino.esp8266.com/stable/package_esp8266com_index.json
- Tools → Board → Board Manager → ESP8266 → Install

Step 2: Select Board
--------------------
- Tools → Board → ESP8266 Boards → Generic ESP8266 Module

Step 3: Configure ESP-01
------------------------
The ESP-01 should work with default AT firmware.
If needed, flash with ESP8266 AT firmware.

Step 4: Wire Connections
------------------------
Connect Arduino to ESP-01 as shown above.

Step 5: Upload Code
-------------------
- Open solar_gateway.ino in Arduino IDE
- Change WiFi SSID and password
- Upload to Arduino Uno

Step 6: Test
------------
- Open Serial Monitor (115200 baud)
- Verify WiFi connection
- Verify TCP connection to Raspberry Pi
*/

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/*
Issue: ESP-01 not responding
Solution:
- Check 3.3V power (needs ~300mA)
- Verify CH_PD connected to 3.3V
- Check TX/RX not crossed

Issue: Connection refused
Solution:
- Verify Raspberry Pi TCP server is running
- Check IP address and port
- Disable firewall on Raspberry Pi

Issue: Garbled characters
Solution:
- Check baud rates match
- Verify correct TX/RX pins

Issue: WiFi won't connect
Solution:
- Verify SSID and password
- Check WiFi network is 2.4GHz (ESP-01 doesn't support 5GHz)
- Move router closer for testing
*/

// ============================================================================
// ESP-01 FIRMWARE UPDATE (IF NEEDED)
// ============================================================================

/*
If ESP-01 doesn't respond to AT commands:

1. Connect GPIO0 to GND (flash mode)
2. Use esptool.py or Arduino ESP8266 sketch uploader
3. Flash AT firmware from:
   https://github.com/espressif/ESP8266_AT

Or use ESP8266 Sketch Data Upload:
- Tools → ESP8266 Sketch Data Upload
*/

// ============================================================================
// ALTERNATIVE: USE ARDUINO ETHERNET SHIELD
// ============================================================================

/*
Instead of ESP-01, you can use:
- Arduino Ethernet Shield ( Wiz5100 )
- Arduino WiFi Shield (ESP8266 based)

Code modifications needed for these alternatives.
*/
