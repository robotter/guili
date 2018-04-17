#!/usr/bin/env python3
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
import hashlib
import base64
import struct


class WebSocketServer(HTTPServer):
  pass


class WebSocketCloseFrame(Exception):
  """Exception raised to close the connection"""
  def __init__(self, status, reason=None):
    self.status = status
    self.reason = reason
  def __str__(self):
    return "(%d) %s" % (self.status, self.reason)


class WebSocketRequestHandler(BaseHTTPRequestHandler):
  """
  Add WebSocket support to an HTTP request handler
  """

  WS_MAX_CONTROL_PAYLOAD_LEN = 1024
  # maximum message payload length (prevent DoS with very long messages)
  WS_MAX_PAYLOAD_LEN = 1024**2

  class WebSocketMessageFileObject:
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
        ret += self._h.ws_read_masked(self._key, nread, self._offset)
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
        fin, opcode, key, pl_len = self._h.ws_parse_frame()
        if opcode & 0x8:
          self._h.ws_process_control_frame(opcode, key, pl_len)
        else:
          break
      self._total_len += pl_len
      if self._total_len > self._h.WS_MAX_PAYLOAD_LEN:
        raise WebSocketCloseFrame(1009, "payload is too large")
      self._fin, self._key, self._len = fin, key, pl_len
      self._offset = 0  # offset, for key
      return opcode


  def on_message(self, fo):
    """Method called to handle messages
    fo is a file object from which message data can be read.
    """
    raise NotImplementedError()

  def close(self, status, reason=None):
    """Send a close frame and close the connection
    This method never returns.
    """
    raise WebSocketCloseFrame(status, reason)


  def handle_websocket(self):
    if self.request_version != 'HTTP/1.1':
      return self.send_error(400, "Bad request version (%r)" % self.request_version)

    # parse headers
    #TODO 'Host' header is ignored
    #TODO 'Origin' header is ignored
    if self.headers.get('Upgrade', '').lower() != 'websocket':
      return self.send_error(400, "Invalid 'Upgrade' header")
    if 'upgrade' not in (s.strip() for s in self.headers.get('Connection', '').lower().split(',')):
      return self.send_error(400, "invalid 'Connection' header")
    if self.headers.get('Sec-WebSocket-Version') != '13':
      return self.send_error(400, "Invalid 'Sec-WebSocket-Version' header")
    # Sec-WebSocket-Key (no need to decode it)
    websocket_key = self.headers.get('Sec-WebSocket-Key')
    if websocket_key is None:
      return self.send_error(400, "Missing 'Sec-WebSocket-Key' header")

    # reply, end handshake
    key_hash = hashlib.sha1()
    key_hash.update((websocket_key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode('ascii'))
    self.send_response(101, 'Switching Protocols')
    self.send_header('Upgrade', 'websocket')
    self.send_header('Connection', 'Upgrade')
    self.send_header('Sec-WebSocket-Accept', base64.b64encode(key_hash.digest()).decode('ascii'))
    self.end_headers()
    self.log_message("WebSocket handshake successful")

    # from now, request will use WebSocket protocol
    # process frames/messages and don't return
    self.ws_setup()
    try:
      while True:
        fo = self.WebSocketMessageFileObject(self)
        self.on_message(fo)
        fo.read()  # consume remaining message data
    except WebSocketCloseFrame as e:
      return self.ws_send_close_frame(e.status, e.reason)
    except Exception as e:
      return self.ws_send_close_frame(1008, str(e))
    finally:
      self.ws_finish()
      self.close_connection = 1


  def ws_setup(self):
    """Called before after WebSocket handshake"""
    pass

  def ws_finish(self):
    """Called before closing a WebSocket connection"""
    pass


  def ws_read_masked(self, key, n, offset=0):
    """Read data and unmask it"""
    data = self.rfile.read(n)
    return ''.join(chr(c ^ key[i%4]) for i,c in enumerate(data, offset))


  def ws_parse_frame(self):
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


  def ws_send_frame(self, opcode, data, fin=True):
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


  def ws_send_close_frame(self, status, reason=None):
    """Send a close control frame"""
    data = struct.pack('>H', status)
    if reason is not None:
      data += reason.encode('utf-8')
    self.ws_send_frame(0x8, data)
    self.log_message("Closing connection: (%d) %s", status, reason)


  def ws_process_control_frame(self, opcode, masking_key, payload_len):
    if payload_len > self.WS_MAX_CONTROL_PAYLOAD_LEN:
      raise WebSocketCloseFrame(1009, "control frame is too large")
    payload = self.ws_read_masked(masking_key, payload_len)
    if opcode == 0x8:
      self.ws_process_close_frame(payload)
    elif opcode == 0x9:
      self.ws_process_ping_frame(payload)
    elif opcode == 0xA:
      self.ws_process_pong_frame(payload)
    else:
      raise WebSocketCloseFrame(1002, "unsupported control frame opcode: 0x%X" % opcode)


  def ws_process_close_frame(self, data):
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

  def ws_process_ping_frame(self, data):
    self.ws_send_frame(0xA, data)

  def ws_process_pong_frame(self, data):
    pass


def main():
  class RequestHandler(WebSocketRequestHandler):
    def do_GET(self):
      return self.handle_websocket()
    def on_message(self, fo):
      s = "received message: %r" % fo.read()
      self.ws_send_frame(1, s)

  port = int(sys.argv[1])
  print("starting server on port %d" % port)
  server = WebSocketServer(('', port), RequestHandler)
  server.serve_forever()

if __name__ == '__main__':
  main()

