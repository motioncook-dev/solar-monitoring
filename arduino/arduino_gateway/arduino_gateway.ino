/**
 * Arduino Gateway - PLI RS232 to WiFi TCP Bridge
 * 
 * Connecte le PL40 via PLI RS232 à un réseau WiFi
 * pour communication avec le Raspberry Pi
 * 
 * Pinout:
 *   D10 (RX) ← TX ESP8266
 *   D11 (TX) ← RX ESP8266
 *   D2  ← LED status (connecté)
 *   D3  ← LED activity (données)
 */

#include <SoftwareSerial.h>
#include <ESP8266WiFi.h>

// Configuration Serial vers PLI
#define PLI_BAUD 9600

// Configuration ESP8266
#define ESP8266_BAUD 115200

// Pins Arduino
#define PIN_LED_STATUS 2    // LED builtin (actif bas)
#define PIN_LED_ACTIVITY 3

// Timeouts
#define TCP_TIMEOUT 10000    // ms sans activité avant déconnexion
#define SERIAL_BUFFER_SIZE 256

// États
enum State {
  STATE_DISCONNECTED,
  STATE_CONNECTING,
  STATE_CONNECTED,
  STATE_ERROR
};

SoftwareSerial pliSerial(10, 11);  // RX, TX sur pins 10, 11
WiFiClient tcpClient;

const char* serverIP = "192.168.1.100";  // IP Raspberry Pi
int serverPort = 8888;

State currentState = STATE_DISCONNECTED;
unsigned long lastActivity = 0;
bool ledState = false;

// Buffer circulaire pour données PLI
byte pliBuffer[SERIAL_BUFFER_SIZE];
int pliBufferHead = 0;
int pliBufferTail = 0;

void setup() {
  // LED status
  pinMode(PIN_LED_STATUS, OUTPUT);
  digitalWrite(PIN_LED_STATUS, HIGH);  // LED éteinte
  
  // LED activity
  pinMode(PIN_LED_ACTIVITY, OUTPUT);
  digitalWrite(PIN_LED_ACTIVITY, LOW);
  
  // Serial PLI
  pliSerial.begin(PLI_BAUD);
  
  // Serial debug (optionnel)
  Serial.begin(115200);
  Serial.println(F("\n=== Arduino PLI Gateway ==="));
  Serial.print(F("PLI Baud: "));
  Serial.println(PLI_BAUD);
  
  // WiFi
  WiFi.mode(WIFI_STA);
  
  currentState = STATE_DISCONNECTED;
  blinkLED(PIN_LED_STATUS, 3);
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
  
  // Timeout activity
  if (currentState == STATE_CONNECTED && 
      millis() - lastActivity > TCP_TIMEOUT) {
    Serial.println(F("Timeout - déconnexion"));
    disconnectTCP();
    currentState = STATE_DISCONNECTED;
  }
  
  // Activity LED clignote lentement si connecté
  if (currentState == STATE_CONNECTED) {
    blinkLED(PIN_LED_ACTIVITY, 50);  // Clignote à chaque activity
  }
}

void handleDisconnected() {
  static unsigned long lastAttempt = 0;
  
  if (millis() - lastAttempt > 5000) {  // Retry toutes les 5s
    lastAttempt = millis();
    
    Serial.print(F("Connexion TCP à "));
    Serial.print(serverIP);
    Serial.print(F(":"));
    Serial.println(serverPort);
    
    digitalWrite(PIN_LED_STATUS, LOW);  // LED allumée = connecting
    currentState = STATE_CONNECTING;
    
    if (tcpClient.connect(serverIP, serverPort)) {
      Serial.println(F("Connecté!"));
      tcpClient.setNoDelay(true);
      currentState = STATE_CONNECTED;
      lastActivity = millis();
    } else {
      Serial.println(F("Échec connexion"));
      currentState = STATE_DISCONNECTED;
    }
  }
}

void handleConnecting() {
  // Timeout connexion
  if (millis() - lastActivity > 5000) {
    Serial.println(F("Timeout connexion"));
    tcpClient.stop();
    currentState = STATE_DISCONNECTED;
  }
}

void handleConnected() {
  // Vérifie connexion TCP
  if (!tcpClient.connected()) {
    Serial.println(F("TCP déconnecté"));
    currentState = STATE_DISCONNECTED;
    return;
  }
  
  // Relais TCP → PLI
  if (tcpClient.available()) {
    byte data = tcpClient.read();
    pliSerial.write(data);
    lastActivity = millis();
  }
  
  // Relais PLI → TCP
  if (pliSerial.available()) {
    byte data = pliSerial.read();
    
    // Filter les caractères de contrôle
    if (data >= 0x20 || data == 0x0D || data == 0x0A) {
      tcpClient.write(data);
    }
    
    // Stocke dans buffer circulaire (debug)
    storeInBuffer(data);
    
    lastActivity = millis();
  }
}

void handleError() {
  tcpClient.stop();
  currentState = STATE_DISCONNECTED;
  delay(1000);
}

void disconnectTCP() {
  tcpClient.stop();
  currentState = STATE_DISCONNECTED;
}

// Stocke dans buffer circulaire pour debug
void storeInBuffer(byte data) {
  int next = (pliBufferHead + 1) % SERIAL_BUFFER_SIZE;
  if (next != pliBufferTail) {
    pliBuffer[pliBufferHead] = data;
    pliBufferHead = next;
  }
}

// Affiche le buffer (debug)
void printPLIBuffer() {
  Serial.print(F("PLI Buffer: "));
  while (pliBufferTail != pliBufferHead) {
    Serial.print(pliBuffer[pliBufferTail], HEX);
    Serial.print(F(" "));
    pliBufferTail = (pliBufferTail + 1) % SERIAL_BUFFER_SIZE;
  }
  Serial.println();
}

// Blink LED simple
void blinkLED(int pin, int duration) {
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > duration) {
    lastBlink = millis();
    digitalWrite(pin, !digitalRead(pin));
  }
}
