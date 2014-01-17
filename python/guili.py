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

if not mimetypes.inited:
  mimetypes.init()


class GuiliServer(ThreadingMixIn, WebSocketServer):
  """
  Guili application server

  Attributes:
    lock -- lock for concurrent accesses
    requests -- set of request handlers of initialized clients

  """

  daemon_threads = True

  def __init__(self, addr):
    self.data = None
    self.requests = set()
    self.lock = threading.RLock()
    WebSocketServer.__init__(self, addr, GuiliRequestHandler)
    self._gen_data = self.gen_data() #XXX
    #XXX
    self.messages = {
        'goto_xy': [('x', 'int16'), ('y', 'int16')],
        'dummy': [],
        }

  def on_new_data(self, data):
    with self.lock:
      for r in self.requests:
        if not r.paused:
          r.send_event('data', {'data': data})

  def on_robot_event(self, ev):
    """Called on new event from the robot"""
    #XXX
    self.on_new_data(self._gen_data.next())

  #XXX
  def gen_data(self):
    data = {
        'robot': {
          'x': None, 'y': None,
          'vx': 120., 'vy': -200.,
          'ax': 34., 'ay': 78.,
          },
        }

    import itertools
    import math
    r = 600
    N = 100
    for i in itertools.cycle(range(N)):
      data['robot']['x'] = r * math.cos(2*i*math.pi/N)
      data['robot']['y'] = r * math.sin(2*i*math.pi/N)
      yield data

  def rome_goto_xy(self, x, y):
    print "received goto_xy(%r, %r)" % (x, y)



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
  files_extensions = ['.html', '.css', '.js', '.svg']
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
    except Exception:
      pass #TODO send back error

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
    getattr(self.server, 'rome_'+name)(**params)

  def wsdo_rome_messages(self):
    """Send ROME message definitions"""
    self.send_event('messages', {'messages': self.server.messages})


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



def main():
  import argparse
  parser = argparse.ArgumentParser()
  parser.add_argument('--web-dir',
      help="path to web files")
  parser.add_argument('port', type=int,
      help="guili WebSocket server port")

  args = parser.parse_args()
  if args.web_dir:
    GuiliRequestHandler.files_base_path = os.path.abspath(args.web_dir)

  print "starting server on port %d" % args.port
  server = GuiliServer(('', args.port))
  TickThread(0.1, server.on_robot_event).start() #XXX
  server.serve_forever()

if __name__ == '__main__':
  main()

