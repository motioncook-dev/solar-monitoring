/**
 * Circular Buffer for PLI Protocol
 * 
 * Handles byte-by-byte protocol parsing
 */

class CircularBuffer {
  constructor(size = 1024) {
    this.buffer = Buffer.alloc(size);
    this.head = 0;
    this.tail = 0;
    this.size = size;
    this.count = 0;
  }
  
  /**
   * Write a single byte
   */
  writeByte(byte) {
    const next = (this.head + 1) % this.size;
    if (next === this.tail) {
      // Buffer overflow - overwrite tail
      this.tail = (this.tail + 1) % this.size;
    } else {
      this.head = next;
    }
    this.buffer[this.head] = byte;
    if (this.count < this.size) {
      this.count++;
    }
  }
  
  /**
   * Write multiple bytes
   */
  write(data) {
    if (Buffer.isBuffer(data)) {
      for (let i = 0; i < data.length; i++) {
        this.writeByte(data[i]);
      }
    } else if (typeof data === 'string') {
      for (let i = 0; i < data.length; i++) {
        this.writeByte(data.charCodeAt(i));
      }
    } else if (Array.isArray(data)) {
      for (const byte of data) {
        this.writeByte(byte);
      }
    }
  }
  
  /**
   * Read a single byte
   */
  readByte() {
    if (this.count === 0) return null;
    const byte = this.buffer[this.tail];
    this.tail = (this.tail + 1) % this.size;
    this.count--;
    return byte;
  }
  
  /**
   * Peek at next byte without consuming
   */
  peek() {
    if (this.count === 0) return null;
    return this.buffer[this.tail];
  }
  
  /**
   * Read until delimiter
   */
  readUntil(delimiter) {
    if (this.count === 0) return null;
    
    let start = this.tail;
    let pos = this.tail;
    
    while (this.count > 0) {
      const byte = this.buffer[pos];
      if (byte === delimiter) {
        break;
      }
      pos = (pos + 1) % this.size;
      if (pos === this.head && this.buffer[pos] !== delimiter) {
        break;
      }
    }
    
    const length = (pos - start + this.size) % this.size + 1;
    const result = Buffer.alloc(length);
    
    for (let i = 0; i < length; i++) {
      result[i] = this.buffer[this.tail];
      this.tail = (this.tail + 1) % this.size;
      this.count--;
    }
    
    return result;
  }
  
  /**
   * Clear buffer
   */
  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
  
  /**
   * Get available bytes count
   */
  available() {
    return this.count;
  }
  
  /**
   * Convert to string
   */
  toString(encoding = 'utf8') {
    let result = '';
    let pos = this.tail;
    for (let i = 0; i < this.count; i++) {
      result += String.fromCharCode(this.buffer[pos]);
      pos = (pos + 1) % this.size;
    }
    return result;
  }
  
  /**
   * Convert to hex string
   */
  toHex() {
    let result = '';
    let pos = this.tail;
    for (let i = 0; i < this.count; i++) {
      const byte = this.buffer[pos];
      result += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';
      pos = (pos + 1) % this.size;
    }
    return result.trim();
  }
}

module.exports = CircularBuffer;
