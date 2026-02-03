/**
 * Solar Gateway - PL40 to WiFi TCP Bridge
 * 
 * Hardware: Arduino Uno + ESP-01 (ESP8266)
 * 
 * Connections:
 *   ESP-01  → Arduino Uno
 *   VCC     → 3.3V
 *   GND     → GND
 *   CH_PD   → 3.3V
 *   GPIO0   → 3.3V (normal mode) or GND (flash mode)
 *   TXD     → D10 (SoftwareSerial RX)
 *   RXD     → D11 (SoftwareSerial TX)
 *   
 *   PLI RS232 → Arduino Uno (via USB Serial or pins 0/1)
 */

#include <SoftwareSerial.h>
#include <ESP8266WiFi.h>

// ============================================================================
// CONFIGURATION - CHANGE THESE VALUES
// ============================================================================

// WiFi Credentials
const char* WIFI_SSID = "TON_WIFI_SSID";
const char* WIFI_PASSWORD = "TON_MOT_DE_PASSE";

// TCP Server (Raspberry Pi)
const char* SERVER_HOST = "192.168.1.100";  // IP du Raspberry Pi
const int SERVER_PORT = 8888;

// Serial to PLI
#define PLI_BAUD 9600

// ESP8266 baud rate
#define ESP_BAUD 115200

// Status LED (builtin LED on pin 13, active LOW)
#define LED_PIN 13

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

SoftwareSerial pliSerial(10, 11);  // RX=10, TX=11 (connect to PLI)
WiFiClient tcpClient;

enum State {
  STATE_DISCONNECTED,
  STATE_CONNECTING,
  STATE_CONNECTED,
  STATE_ERROR
};

State currentState = STATE_DISCONNECTED;
unsigned long lastActivity = 0;
const unsigned long ACTIVITY_TIMEOUT = 60000;  // 60 seconds

// Buffer for incoming data
byte dataBuffer[256];
int bufferIndex = 0;

bool ledState = false;
unsigned long lastLedToggle = 0;

void setup() {
  // LED setup
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // LED off initially
  
  // Serial to PLI (9600 baud)
  pliSerial.begin(PLI_BAUD);
  
  // Hardware serial for debugging (optional)
  Serial.begin(115200);
  Serial.println(F("\n=== Solar Gateway PL40 ==="));
  Serial.print(F("PLI Baud: "));
  Serial.println(PLI_BAUD);
  
  // WiFi setup
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  Serial.print(F("Connexion WiFi: "));
  Serial.println(WIFI_SSID);
  
  currentState = STATE_DISCONNECTED;
  blinkLED(3);
}

void loop() {
  switch (currentState) {
    case STATE_DISCONNECTED:
      handleDisconnected();
      break;
    case STATE_CONNECTING:
      handleConnecting();
      break;
    case STATE_CONNECTED:
      handleConnected();
      break;
    case STATE_ERROR:
      handleError();
      break;
  }
  
  // Activity LED blink
  if (currentState == STATE_CONNECTED) {
    blinkLED(100);  // Slow blink when connected
  }
}

// ============================================================================
// STATE HANDLERS
// ============================================================================

void handleDisconnected() {
  // Check WiFi connection
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("WiFi OK: "));
    Serial.println(WiFi.localIP());
    
    Serial.print(F("Connexion TCP: "));
    Serial.print(SERVER_HOST);
    Serial.print(F(":"));
    Serial.println(SERVER_PORT);
    
    digitalWrite(LED_PIN, LOW);  // LED on = connecting
    currentState = STATE_CONNECTING;
    lastActivity = millis();
    
    if (tcpClient.connect(SERVER_HOST, SERVER_PORT)) {
      Serial.println(F("Connecté!"));
      tcpClient.setNoDelay(true);
      currentState = STATE_CONNECTED;
      lastActivity = millis();
    } else {
      Serial.println(F("Échec TCP"));
      currentState = STATE_DISCONNECTED;
    }
  } else {
    // WiFi not connected
    static unsigned long lastWifiCheck = 0;
    if (millis() - lastWifiCheck > 5000) {
      lastWifiCheck = millis();
      Serial.print(F("WiFi: "));
      Serial.println(WiFi.status());
    }
  }
}

void handleConnecting() {
  if (millis() - lastActivity > 10000) {
    // Timeout connecting
    Serial.println(F("Timeout connexion TCP"));
    tcpClient.stop();
    currentState = STATE_DISCONNECTED;
  }
}

void handleConnected() {
  // Check TCP connection
  if (!tcpClient.connected()) {
    Serial.println(F("TCP déconnecté"));
    currentState = STATE_DISCONNECTED;
    return;
  }
  
  // Relais: TCP → PLI
  if (tcpClient.available()) {
    byte data = tcpClient.read();
    pliSerial.write(data);
    lastActivity = millis();
  }
  
  // Relais: PLI → TCP
  if (pliSerial.available()) {
    byte data = pliSerial.read();
    tcpClient.write(data);
    lastActivity = millis();
  }
  
  // Timeout check
  if (millis() - lastActivity > ACTIVITY_TIMEOUT) {
    Serial.println(F("Timeout inactivité"));
    tcpClient.stop();
    currentState = STATE_DISCONNECTED;
  }
}

void handleError() {
  tcpClient.stop();
  currentState = STATE_DISCONNECTED;
  delay(1000);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

void blinkLED(int interval) {
  if (millis() - lastLedToggle > interval) {
    lastLedToggle = millis();
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? LOW : HIGH);
  }
}

// Send a string to TCP
void sendToServer(const char* str) {
  if (tcpClient && tcpClient.connected()) {
    tcpClient.print(str);
  }
}

// Send a byte to TCP
void sendByteToServer(byte data) {
  if (tcpClient && tcpClient.connected()) {
    tcpClient.write(data);
  }
}
