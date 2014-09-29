#!/usr/bin/env python2.7
import sys
import os
import json
import threading
import time
import posixpath
import urllib
import mimetypes
import shutil
from websocket import WebSocketServer, WebSocketRequestHandler
from SocketServer import ThreadingMixIn
import rome

if not mimetypes.inited:
  mimetypes.init()


class GuiliRequestHandler(WebSocketRequestHandler):
  """
  Guili request handler

  Messages are json-encoded maps with the following fields:
    method -- message type
    params -- map of message parameters

  When receiving a message with method 'method', the 'wsdo_method' method is
  called with 'params' as keyword parameters.

  Attributes:
    lock -- lock for concurrent accesses
    paused -- client is paused

  """

  ws_prefix = 'ws'
  files_prefix = 'guili'
  files_base_path = None  # disabled
  files_extensions = ['.html', '.css', '.js', '.svg', '.png', '.eot', '.ttf', '.woff']
  files_index = 'guili.html'


  def do_GET(self):
    # remove query and normalize the path
    path = self.path.split('?', 1)[0]
    path = posixpath.normpath(urllib.unquote(path))
    path = path.strip('/')
    # handle websocket case
    if path == self.ws_prefix:
      return self.handle_websocket()

    if self.files_base_path is None:
      return self.send_error(404)

    parts = path.split('/')
    if parts.pop(0) != self.files_prefix:
      return self.send_error(404)
    if not len(parts):
      # index
      parts = self.files_index.split('/')

    # build filesystem path from (sanitized) request path
    fspath = self.files_base_path
    for p in parts:
      p = os.path.splitdrive(p)[1]
      p = os.path.split(p)[1]
      if p in (os.curdir, os.pardir):
        continue
      fspath = os.path.join(fspath, p)

    # filter by extension
    ext = os.path.splitext(fspath)[1]
    if ext not in self.files_extensions:
      return self.send_error(404)

    try:
      f = open(fspath, 'rb')
    except IOError:
      return self.send_error(404)
    # send HTTP reply
    mimetype = mimetypes.types_map.get(ext, 'application/octet-stream')
    self.send_response(200)
    self.send_header('Content-type', mimetype)
    fstat = os.fstat(f.fileno())
    self.send_header('Content-Length', str(fstat[6]))
    self.send_header('Last-Modified', self.date_time_string(fstat.st_mtime))
    self.end_headers()
    # output file content
    shutil.copyfileobj(f, self.wfile)
    f.close()


  def ws_setup(self):
    self.lock = threading.RLock()
    self.paused = True

  def ws_finish(self):
    with self.server.lock:
      self.server.requests.discard(self)

  def send_event(self, name, params):
    """Send an event"""
    with self.lock:
      self.ws_send_frame(1, json.dumps({'event': name, 'params': params}))

  def on_message(self, fo):
    data = json.load(fo)
    try:
      getattr(self, 'wsdo_'+data['method'].replace('-', '_'))(**data['params'])
    except Exception as e:
      self.send_event('log', {'severity': 'error', 'message': "%s: %s" % (e.__class__.__name__, str(e))})

  def wsdo_init(self):
    """Initialize a client"""
    self.paused = False
    with self.server.lock:
      self.server.requests.add(self)

  def wsdo_pause(self, paused):
    """Pause or unpause a client"""
    self.paused = bool(paused)

  def wsdo_rome(self, name, params):
    """Send a ROME message"""
    raise NotImplementedError

  def wsdo_rome_messages(self):
    """Send ROME message definitions"""
    messages = { msg.name: [(k,t.name) for k,t in msg.ptypes] for msg in rome.messages.values() }
    self.send_event('messages', {'messages': messages})

  def wsdo_configurations(self):
    """Send portlets configurations"""
    self.send_event('configurations', {'configurations': self.server.configurations})


class GuiliServer(ThreadingMixIn, WebSocketServer):
  """
  Guili application server

  Attributes:
    lock -- lock for concurrent accesses
    requests -- set of request handlers of initialized clients

  """

  daemon_threads = True
  GuiliRequestHandlerClass = GuiliRequestHandler

  def __init__(self, addr):
    self.data = None
    self.requests = set()
    self.lock = threading.RLock()
    WebSocketServer.__init__(self, addr, self.GuiliRequestHandlerClass)
    # load configurations
    try:
      with open(os.path.join(os.path.dirname(__file__), 'configurations.json')) as f:
        self.configurations = json.load(f)
    except IOError:
      self.configurations = {}

  def on_frame(self, frame):
    data = {'name': frame.msg.name, 'params': dict(zip(frame.params._fields, frame.params))}
    with self.lock:
      for r in self.requests:
        if not r.paused:
          r.send_event('frame', data)

  def start(self):
    self.serve_forever()


class TestGuiliServer(GuiliServer):
  """
  Dummy server, for tests
  """

  class GuiliRequestHandlerClass(GuiliRequestHandler):
    def wsdo_rome(self, name, params):
      print "ROME: %s %r" % (name, params)

  def __init__(self, addr):
    # define only our messages
    rome.frame.unregister_all_messages()
    rome.frame.register_messages(
        (0x20, [
          ('asserv_tm_xya',   [('x','dist'), ('y','dist'), ('a','angle')]),
          ]),
        )
    GuiliServer.__init__(self, addr)
    self._gen_frames = self.gen_frames()

  def start(self):
    TickThread(0.1, self.on_robot_event).start()
    GuiliServer.start(self)

  def on_robot_event(self, ev):
    """Called on new event from the robot"""
    self.on_frame(self._gen_frames.next())

  def gen_frames(self):
    import itertools
    import math
    r = 600
    N = 100
    for i in itertools.cycle(range(N)):
      yield rome.Frame('asserv_tm_xya',
          int(r * math.cos(2*i*math.pi/N)),
          int(r * math.sin(2*i*math.pi/N)),
          0)


class TickThread(threading.Thread):
  """
  Dummy thread to trigger periodic GulliServer.on_robot_event() calls
  """

  def __init__(self, dt, callback):
    threading.Thread.__init__(self)
    self.callback = callback
    self.dt = dt
    self.daemon = True

  def run(self):
    while True:
      self.callback(None)
      time.sleep(self.dt)


class RomeClientGuiliServer(GuiliServer):

  class GuiliRequestHandlerClass(GuiliRequestHandler):
    def wsdo_rome(self, name, params):
      #TODO use cb_result/cb_ack when needed
      frame = rome.Frame(name, **params)
      self.server.client.send(frame)

  class RomeClientClass(rome.ClientEcho):
    def on_frame(self, frame):
      rome.ClientEcho.on_frame(self, frame)
      self.guili_server.on_frame(frame)

  def __init__(self, addr, rome_fo):
    GuiliServer.__init__(self, addr)
    self.client = self.RomeClientClass(rome_fo)
    self.client.guili_server = self

  def start(self):
    self.client.start(self)
    GuiliServer.start(self)



def main():
  import argparse
  parser = argparse.ArgumentParser()
  parser.add_argument('--web-dir',
      default=os.path.join(os.path.dirname(__file__), '..', 'web'),
      help="path to web files")
  parser.add_argument('port', type=int,
      help="guili WebSocket server port")
  parser.add_argument('device',
      help="ROME serial device, 'TEST' for a dummy packet generator")

  args = parser.parse_args()
  if args.web_dir != '':
    GuiliRequestHandler.files_base_path = os.path.abspath(args.web_dir)

  print "starting server on port %d" % args.port
  if args.device == 'TEST':
    server = TestGuiliServer(('', args.port))
  else:
    import serial
    server = RomeClientGuiliServer(('', args.port), serial.Serial(args.device, 38400))
  server.start()

if __name__ == '__main__':
  main()

