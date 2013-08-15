#!/usr/bin/env python2.7
import sys
import BaseHTTPServer
import SocketServer
import httplib
import urllib
import mimetools
import hashlib
import base64
import struct
import time


class WebSocketServer(SocketServer.TCPServer):
  allow_reuse_address = 1

  def log(self, fmt, *args):
    """Log a single message"""
    date = time.strftime("%H:%M:%S")
    sys.stderr.write("%s - %s\n" % (date, fmt % args))


class WebSocketHttpError(Exception):
  def __init__(self, code, msg=None):
    self.code = code
    if msg is None:
      msg = httplib.responses[code]
    self.msg = msg
  def __str__(self):
    return "(%d) %s" % (self.code, self.msg)

class WebSocketCloseFrame(Exception):
  """Exception raised to close the connection"""
  def __init__(self, status, reason=None):
    self.status = status
    self.reason = reason
  def __str__(self):
    return "(%d) %s" % (self.status, self.reason)


class WebSocketRequestHandler(SocketServer.StreamRequestHandler):
  """
  Handle WebSocket connections

  Attributes:
    close_connection -- set to True to close the connection

  """

  MAX_CONTROL_PAYLOAD_LEN = 1024
  # maximume message payload length (prevent DoS with very long messages)
  MAX_PAYLOAD_LEN = 1024**2


  class MessageFileObject(object):
    """File object class for reading messages"""

    def __init__(self, handler):
      self._h = handler
      self._utf8 = False
      self._total_len = 0

      # get first frame
      self._offset = 0  # offset, for key
      opcode = self.next_frame()
      if opcode == 0:
        raise WebSocketCloseFrame(1002, "unexpected continuation frame")
      if opcode == 1:
        self._utf8 = True
      elif opcode == 2:
        pass # binary
      else:
        raise WebSocketCloseFrame(1002, "unknown opcode: 0x%X" % opcode)

    def read(self, n=None):
      if n == 0 or self._fin and self._len == 0:
        return ''

      ret = ''
      while n is None or n > 0:
        # if current frame is exhausted, read the next one
        while self._len == 0:
          opcode = self.next_frame()
          if opcode != 0:
            raise WebSocketCloseFrame(1002, "continuation frame expected")

        # read frame data
        nread = self._len if n is None else min(n, self._len)
        ret += self._h.read_masked(self._key, nread, self._offset)
        nread = len(ret)
        if n is not None:
          n -= nread
        self._len -= nread
        self._offset += nread
        if self._fin and self._len == 0:
          return ret  # no more content

      return ret

    def next_frame(self):
      """Receive and process next frame

      Process control frames
      Check combined payload length.
      Return frame's opcode.
      """
      while True:
        fin, opcode, key, pl_len = self._h.parse_frame()
        if opcode & 0x8:
          self._h.process_control_frame(opcode, key, pl_len)
        else:
          break
      self._total_len += pl_len
      if self._total_len > self._h.MAX_PAYLOAD_LEN:
        raise WebSocketCloseFrame(1009, "payload is too large")
      self._fin, self._key, self._len = fin, key, pl_len
      self._offset = 0  # offset, for key
      return opcode


  def on_message(self, fo):
    """Method called to handle messages
    fo is a file object from which message data can be read.
    """
    return NotImplemented

  def close(self, status, reason=None):
    """Send a close frame and close the connection
    This method never returns.
    """
    raise WebSocketCloseFrame(status, reason)


  def handle(self):
    """Parse a request"""

    self.log("new connection")

    # process handshake
    try:
      self.handle_handshake()
    except WebSocketHttpError as e:
      return self.send_http_error(e.code, e.msg)
    except Exception as e:
      return self.send_http_error(500, str(e))

    # process frames/messages
    try:
      while True:
        fo = self.MessageFileObject(self)
        self.on_message(fo)
        fo.read()  # consume remaining message data
    except WebSocketCloseFrame as e:
      return self.send_close_frame(e.status, e.reason)
    except Exception as e:
      return self.send_close_frame(1008, str(e))


  def handle_handshake(self):
    """Handle WebSocket handshake from client"""
    request_line = self.rfile.readline()
    if not request_line:
      raise ValueError("no request")
    l = request_line.rstrip('\r\n').split()
    if len(l) != 3:
      raise WebSocketHttpError(400, "invalid request line")
    method, uri, version = l

    # check version (at least 1.1)
    if not version.startswith('HTTP/'):
      raise WebSocketHttpError(400, "invalid version string: %r" % version)
    try:
      version = float(version[5:])
    except ValueError:
      raise WebSocketHttpError(400, "invalid version number: %r" % version[5:])
    if version < 1.1:
      raise WebSocketHttpError(505, "unsupported version")
    # check method (must be GET)
    if method != 'GET':
      raise WebSocketHttpError(405, "unsupported method: %r" % method)
    # parse/decode resource name
    self.resource_name = urllib.unquote(uri)

    # parse headers
    #TODO 'Host' header is ignored
    #TODO 'Origin' header is ignored
    self.headers = mimetools.Message(self.rfile, 0)
    if self.headers.get('Upgrade', '').lower() != 'websocket':
      raise WebSocketHttpError(400, "invalid 'Upgrade' header")
    if 'upgrade' not in (s.strip() for s in self.headers.get('Connection', '').lower().split(',')):
      raise WebSocketHttpError(400, "invalid 'Connection' header")
    if self.headers.get('Sec-WebSocket-Version') != '13':
      raise WebSocketHttpError(400, "invalid 'Sec-WebSocket-Version' header")
    # Sec-WebSocket-Key (no need to decode it)
    websocket_key = self.headers.get('Sec-WebSocket-Key')
    if websocket_key is None:
      raise WebSocketHttpError(400, "missing 'Sec-WebSocket-Key' header")

    # reply
    key_hash = hashlib.sha1()
    key_hash.update(websocket_key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    self.send_http_response(101, 'Switching Protocols', {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Accept': base64.b64encode(key_hash.digest()),
      })


  def read_masked(self, key, n, offset=0):
    """Read data and unmask it"""
    data = self.rfile.read(n)
    return ''.join(chr(ord(c) ^ key[i%4]) for i,c in enumerate(data, offset))


  def parse_frame(self):
    """Parse a single frame from client
    Return a (fin, opcode, masking_key, payload_len) tuple.
    """

    # first 2 bytes
    b1, b2 = struct.unpack('>BB', self.rfile.read(2))

    fin = b1 & 0x80 != 0
    if b1 & 0x70 != 0:
      raise WebSocketCloseFrame(1002, "RSVn bits should be set to 0")
    opcode = b1 & 0x0f
    # control frames MUST NOT be fragmented
    if opcode & 0x8 and not fin:
      raise WebSocketCloseFrame(1002, "fragmented control frame")

    if not b2 & 0x80:
      # clients MUST set the MASK bit
      raise WebSocketCloseFrame(1002, "MASK bit not set")
    # since we know MASK is set, we can compare the whole byte
    if b2 == 0xFE:
      payload_len, = struct.unpack('>H', self.rfile.read(2))
    elif b2 == 0xFF:
      payload_len, = struct.unpack('>Q', self.rfile.read(8))
    else:
      payload_len = b2 & 0x7F

    masking_key = struct.unpack('>BBBB', self.rfile.read(4))

    return fin, opcode, masking_key, payload_len


  def send_frame(self, opcode, data, fin=True):
    """Send a frame"""

    b1 = opcode
    if opcode == 1:
      data = data.encode('utf-8')
    if fin:
      b1 |= 0x80
    payload_len = len(data)

    if payload_len < 126:
      header = struct.pack('>BB', b1, payload_len)
    elif payload_len < 65536:
      header = struct.pack('>BBH', b1, 126, payload_len)
    else:
      header = struct.pack('>BBQ', b1, 127, payload_len)

    self.wfile.write(header)
    self.wfile.write(data)


  def send_close_frame(self, status, reason=None):
    """Send a close control frame"""
    data = struct.pack('>H', status)
    if reason is not None:
      data += reason.encode('utf-8')
    self.send_frame(0x8, data)
    self.log("closing connection: (%d) %s", status, reason)


  def send_http_response(self, code, message=None, headers=None):
    """Send HTTP response"""
    if message is None:
      message = httplib.responses[code]
    self.wfile.write("%s %d %s\r\n" % ('HTTP/1.1', code, message))
    for kv in headers.items():
      self.wfile.write("%s: %s\r\n" % kv)
    self.wfile.write("\r\n")

  def send_http_error(self, code, reason):
    self.log("HTTP error: (%d) %s", code, reason)
    self.send_http_response(code, None, {
      'Content-Type': 'text/plain',
      'Connection': 'close',
      })


  def process_control_frame(self, opcode, masking_key, payload_len):
    if payload_len > self.MAX_CONTROL_PAYLOAD_LEN:
      raise WebSocketCloseFrame(1009, "control frame is too large")
    payload = self.read_masked(masking_key, payload_len)
    if opcode == 0x8:
      self.process_close_frame(payload)
    elif opcode == 0x9:
      self.process_ping_frame(payload)
    elif opcode == 0xA:
      self.process_pong_frame(payload)
    else:
      raise WebSocketCloseFrame(1002, "unsupported control frame opcode: 0x%X" % opcode)


  def process_close_frame(self, data):
    n = len(data)
    if not n:
      return
    if n < 2:
      raise WebSocketCloseFrame(1002, "close frame payload is too short")
    status, = struct.unpack('>H', data[:2])
    if n > 2:
      reason = data[2:].decode('utf-8')
    else:
      reason = None
    # send reply
    raise WebSocketCloseFrame(status, "close frame received")

  def process_ping_frame(self, data):
    self.send_frame(0xA, data)

  def process_pong_frame(self, data):
    pass


  def log(self, fmt, *args):
    """Log a single message"""
    date = time.strftime("%H:%M:%S")
    source = '%s:%s' % self.client_address
    sys.stderr.write("%s [%s] - %s\n" % (date, source, fmt % args))



def main():
  class RequestHandler(WebSocketRequestHandler):
    def on_message(self, fo):
      s = "received message: %r" % fo.read()
      self.send_frame(1, s)

  port = int(sys.argv[1])
  print "starting server on port %d" % port
  server = WebSocketServer(('', port), RequestHandler)
  server.serve_forever()

if __name__ == '__main__':
  main()

