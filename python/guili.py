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
from cStringIO import StringIO
from websocket import WebSocketServer, WebSocketRequestHandler
from SocketServer import ThreadingMixIn
import rome
from contextlib import contextmanager
import serial

if not mimetypes.inited:
  mimetypes.init()

# define bootloader client, if bootloader module is available
try:
  import bootloader
except ImportError:
  bootloader = None


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
  bootloader_prefix = 'bl'
  bootloader_sync_tries = 3
  bootloader_sync_timeout = 2


  def do_GET(self):
    # remove query and normalize the path
    path = self.path.split('?', 1)[0]
    path = posixpath.normpath(urllib.unquote(path))
    path = path.strip('/')

    # dispatch to the correct handler
    if self.command == 'GET' and path == self.ws_prefix:
      return self.handle_websocket()
    parts = path.split('/', 1)
    prefix = parts[0]
    subpath = parts[1] if len(parts) > 1 else ''
    if prefix == self.files_prefix:
      return self.handle_files(subpath)
    elif prefix == self.bootloader_prefix:
      return self.handle_bootloader(subpath)
    else:
      return self.send_error(404)

  do_POST = do_GET


  def handle_files(self, path):
    if self.command != 'GET':
      return self.send_error(405)
    if self.files_base_path is None:
      return self.send_error(404)

    if path:
      parts = path.split('/')
    else:
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
    #self.send_header('Last-Modified', self.date_time_string(fstat.st_mtime))
    self.end_headers()
    # output file content
    shutil.copyfileobj(f, self.wfile)
    f.close()


  def handle_bootloader(self, path):
    if self.command != 'POST':
      return self.send_error(405)

    if path == 'program':
      fhex = StringIO(self.rfile.read(int(self.headers.getheader('content-length'))))
      return self.bootloader_program(fhex)
    else:
      return self.send_error(404)

  def bootloader_program(self, robot, fhex):
    if bootloader is None:
      return self.send_error(400, "Bootloader client not found")
    if 'reset' not in rome.frame.messages_by_name:
      return self.send_error(400, "No reset message")
    reset_frame_data = rome.Frame('reset').data()

    # prepare the bootloader client
    client = self.server.clients[robot]
    bl = bootloader.Client(client.fo)
    self.log_message("prepare to program using bootloader")

    with client.exclusive_mode(robot):
      for i in range(self.bootloader_sync_tries):
        client.fo.write(reset_frame_data)
        try:
          with bl.timeout(self.bootloader_sync_timeout):
            bl.synchronize()
          # we're synchronized and ready to program
          self.log_message("synchronized with bootloader")
          bl.program(fhex)
          self.log_message("program uploaded")
          bl.boot()
          self.send_response(200)
          return
        except bootloader.TimeoutError:
          continue
      else:
        return self.send_error(500, "Bootloader timeout")


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

  def wsdo_robots(self):
    """Send list of handled robots"""
    self.send_event('robots', {'robots': self.server.robots})

  def wsdo_pause(self, paused):
    """Pause or unpause a client"""
    self.paused = bool(paused)

  def wsdo_rome(self, robot, name, params):
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
    robots -- list of handled robots
    configurations -- list of portlets configurations

  """

  daemon_threads = True
  GuiliRequestHandlerClass = GuiliRequestHandler

  def __init__(self, addr, robots):
    self.data = None
    self.requests = set()
    self.lock = threading.RLock()
    WebSocketServer.__init__(self, addr, self.GuiliRequestHandlerClass)
    self.robots = robots
    # load configurations
    try:
      with open(os.path.join(os.path.dirname(__file__), 'configurations.json')) as f:
        self.configurations = json.load(f)
    except IOError:
      self.configurations = {}

  def on_frame(self, robot, frame):
    data = {'robot': robot, 'name': frame.msg.name, 'params': dict(zip(frame.params._fields, frame.params))}
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
    def wsdo_rome(self, robot, name, params):
      print "ROME[%s]: %s %r" % ('' if robot is None else robot, name, params)

  def __init__(self, addr, devices):
    # define only our messages
    rome.frame.unregister_all_messages()
    rome.frame.register_messages(
        (0x20, [
          ('asserv_tm_xya',   [('x','dist'), ('y','dist'), ('a','angle')]),
          ('order_dummy', [('arg1','dist'), ('arg2','uint8')]),
          ]),
        )
    GuiliServer.__init__(self, addr, [d[0] for d in devices])
    self._frame_threads = [
        TickThread(0.1, self.on_robot_event, [d[0], self.gen_frames(i, d[0])])
        for i,d in enumerate(devices) ]

  def start(self):
    for th in self._frame_threads:
      th.start()
    GuiliServer.start(self)

  def on_robot_event(self, robot, gen_frame):
    """Called on new event from a robot"""
    while True:
      frame = gen_frame.next()
      if frame is None:
        break
      self.on_frame(robot, frame)

  def gen_frames(self, idev, robot):
    import itertools
    import math
    r = 600 / (idev + 1)
    N = 100 / (idev + 1)
    for i in itertools.cycle(range(N)):
      if i == 0:
        yield rome.Frame('log', 'notice', "%s: new turn" % robot)
      elif i == N/2:
        yield rome.Frame('log', 'info', "%s: half turn" % robot)
      yield rome.Frame('asserv_tm_xya',
          int(r * math.cos(2*i*math.pi/N)),
          int(r * math.sin(2*i*math.pi/N))+1000,
          math.pi*(2.0*i/N))
      yield None


class TickThread(threading.Thread):
  """
  Dummy thread to trigger periodic GulliServer.on_robot_event() calls
  """

  def __init__(self, dt, callback, args):
    threading.Thread.__init__(self)
    self.callback = callback
    self.args = args
    self.dt = dt
    self.daemon = True

  def run(self):
    while True:
      self.callback(*self.args)
      time.sleep(self.dt)


class RomeClientGuiliServer(GuiliServer):

  class GuiliRequestHandlerClass(GuiliRequestHandler):
    def wsdo_rome(self, robot, name, params):
      #TODO use cb_result/cb_ack when needed
      frame = rome.Frame(name, **params)
      if robot is None:
        for cl in self.clients.values():
          cl.send(frame)
      else:
        self.server.clients[robot].send(frame)

  class RomeClientClass(rome.ClientEcho):

    def __init__(self, server, robot, fo):
      rome.ClientEcho.__init__(self,fo)
      self.guili_server = self
      self.guili_robot = robot
      self.__lock = threading.RLock()

    def on_frame(self, frame):
      rome.ClientEcho.on_frame(self, frame)
      self.guili_server.on_frame(self.guili_robot, frame)

    @contextmanager
    def exclusive_mode(self, robot):
      """Return a context with exclusive access to the UART connection

      The ROME client is stopped and the UART connection can be used directly.
      """
      with self.__lock:
        try:
          self.stop()
          yield
        finally:
          self.start()

  def __init__(self, addr, devices):
    GuiliServer.__init__(self, addr, [d[0] for d in devices])
    self.clients = { robot: self.RomeClientClass(self, robot, fo) for robot, fo in devices }
    self.__exclusive_mode_lock = threading.Lock()

  def start(self):
    for cl in self.clients.values():
      cl.start(self)
    GuiliServer.start(self)


def main():
  import argparse
  parser = argparse.ArgumentParser()
  parser.add_argument('--web-dir',
      default=os.path.join(os.path.dirname(__file__), '..', 'web'),
      help="path to web files")
  parser.add_argument('port', type=int,
      help="guili WebSocket server port")
  parser.add_argument('devices', nargs='+',
      help="ROME serial devices, 'TEST' for a dummy packet generator. Device can be named by a 'name:' prefix.")

  args = parser.parse_args()
  if args.web_dir != '':
    GuiliRequestHandler.files_base_path = os.path.abspath(args.web_dir)
  rome.Frame.set_ack_range(128, 256)

  devices = []  # (name, address)
  is_test = None
  for device in args.devices:
    if ':' in device:
      name, addr = device.split(':', 1)
    elif len(args.devices) > 1:
      parser.error("multiple devices must be named")
    else:
      name, addr = 'robot', device
    if is_test is not None:
      if (addr == 'TEST') is not is_test:
        parser.error("cannot mix test and regular devices")
    else:
      is_test = addr == 'TEST'
    if is_test:
      devices.append((name, None))
    else:
      devices.append((name, serial.Serial(addr, 38400, timeout=0.5)))

  if is_test:
    server_class = TestGuiliServer
  else:
    server_class = RomeClientGuiliServer
  print "starting server on port %d" % args.port
  server = server_class(('', args.port), devices)
  server.start()

if __name__ == '__main__':
  main()

