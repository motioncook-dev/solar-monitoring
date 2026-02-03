/**
 * Arduino Gateway - PLI RS232 to WiFi TCP Bridge
 * 
 * Hardware Configuration Guide
 */

// ============================================================================
// WIRING DIAGRAM
// ============================================================================

// Arduino Nano Pinout
//                   +------------+
//                D13|           |VCC (+5V)
//                D12|           |GND
//  LED Activity → D11|  Arduino   |RST
//      TX ESP8266 → D10|   Nano    |+3.3V
//      RX ESP8266 ←  D9|           |D0 (RX)
//                    |           |D1 (TX)
//                    |           |D2 → LED Status
//                    +------------+

// ============================================================================
// ESP8266 ESP-01 Pinout
//                    +-------+
//  VCC (+3.3V) →  3V3  |       |  GND → GND
//      CH_PD → 3.3V  | ESP-01|  GPIO2
//       GPIO0 → 3.3V  |       |  TXD → D10 Arduino
//                RST →      |       |  RXD ← D11 Arduino
//                    +-------+

// ============================================================================
// COMPLETE WIRING TABLE
// ============================================================================

// Arduino Nano → ESP8266 ESP-01
// ┌─────────────────┬────────────────────┬─────────────┐
// │ Arduino Nano    │ ESP-01            │ Notes       │
// ├─────────────────┼────────────────────┼─────────────┤
// │ GND             │ GND                │ both grounds│
// │ 3.3V           │ VCC                │ 3.3V power │
// │ 3.3V           │ CH_PD              │ enable     │
// │ 3.3V           │ GPIO0              │ boot mode  │
// │ D10 (SoftwareRX)│ TXD                │ ESP TX → Ard│
// │ D11 (SoftwareTX)│ RXD                │ ESP RX ← Ard│
// └─────────────────┴────────────────────┴─────────────┘

// ============================================================================
// POWER CONSIDERATIONS
// ============================================================================

// ESP8266 requires 3.3V and can draw up to 300mA during transmission
// DO NOT power ESP8266 directly from Arduino 3.3V pin!

// Recommended power options:
// 1. USB 5V → Step-down 3.3V → ESP8266
// 2. Separate 3.3V regulator (AMS1117-3.3)
// 3.breadboard with 3.3V rail from USB

// ============================================================================
// STATUS LED CODES
// ============================================================================

// LED on D2 (active LOW - builtin LED on most Arduino Nano)
// ┌──────────────┬────────────────────────────────┐
// │ Blink Pattern │ Meaning                        │
// ├──────────────┼────────────────────────────────┤
// │ Off          │ Disconnected / powering up     │
// │ Slow blink   │ Connecting to WiFi/TCP         │
// │ On           │ Connected and ready            │
// │ Fast blink   │ Activity (data transfer)       │
// │ 3 blinks    │ Error / retrying             │
// └──────────────┴────────────────────────────────┘

// ============================================================================
// SETUP INSTRUCTIONS
// ============================================================================

// Step 1: Install ESP8266 board in Arduino IDE
//   - File → Preferences → Additional Board Manager URLs:
//     http://arduino.esp8266.com/stable/package_esp8266com_index.json
//   - Tools → Board → Board Manager → ESP8266

// Step 2: Select correct board
//   - Tools → Board → ESP8266 Boards → Generic ESP8266 Module

// Step 3: Flash ESP8266 with AT firmware (if needed)
//   - Or use the gateway code directly on ESP8266

// Step 4: Upload gateway code to Arduino Nano

// Step 5: Connect wiring (power OFF first!)

// Step 6: Open Serial Monitor (115200 baud) to debug

// Step 7: Test TCP connection from Raspberry Pi

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

// Issue: ESP8266 not responding
// → Check 3.3V power (needs ~300mA)
// → Verify CH_PD and GPIO0 connected to 3.3V
// → Check TX/RX are not crossed

// Issue: Connection refused
// → Verify Raspberry Pi TCP server is running
// → Check IP address and port
// → Disable firewall on Raspberry Pi

// Issue: Garbled characters
// → Check baud rate (115200 for ESP8266, 9600 for PLI)
// → Verify correct TX/RX pins

// Issue: Random disconnections
// → Add capacitors near ESP8266 power pins
// → Reduce WiFi power if nearby routers

// ============================================================================
// ALTERNATIVE: DIRECT ESP8266 CONNECTION
// ============================================================================

// For simpler setup, you can connect PLI RS232 directly to ESP8266:
//   - RS232 TX → ESP8266 RX (via voltage divider 3.3V)
//   - RS232 RX → ESP8266 TX (direct 3.3V)
//   - GND → GND

// Voltage divider for RS232 TX → ESP8266 RX:
//   RS232 TX ───[10K]───┬───[10K]─── GND
//                       │
//                  ESP8266 RX

// This eliminates the Arduino Nano entirely!
