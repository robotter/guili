#!/usr/bin/env python2.7
import sys
import json
import threading
import time
from websocket import WebSocketServer, WebSocketRequestHandler
from SocketServer import ThreadingMixIn


class GulliverServer(ThreadingMixIn, WebSocketServer):
  """
  Gulliver application server

  Attributes:
    lock -- lock for concurrent accesses
    requests -- set of request handlers of initialized clients

  """

  def __init__(self, addr):
    self.data = None
    self.requests = set()
    self.lock = threading.RLock()
    WebSocketServer.__init__(self, addr, GulliverRequestHandler)
    self._gen_data = self.gen_data() #XXX

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



class GulliverRequestHandler(WebSocketRequestHandler):
  """
  Gulliver request handler

  Messages are json-encoded maps with the following fields:
    method -- message type
    params -- map of message parameters

  When receiving a message with method 'method', the 'do_method' method is
  called with 'params' as keyword parameters.

  Attributes:
    lock -- lock for concurrent accesses
    paused -- client is paused

  """

  def handle(self):
    self.lock = threading.RLock()
    self.paused = True
    WebSocketRequestHandler.handle(self)

  def finish(self):
    with self.server.lock:
      self.server.requests.discard(self)
    WebSocketRequestHandler.finish(self)

  def send_event(self, name, params):
    """Send an event"""
    with self.lock:
      self.send_frame(1, json.dumps({'event': name, 'params': params}))

  def on_message(self, fo):
    data = json.load(fo)
    getattr(self, 'do_'+data['method'].replace('-', '_'))(**data['params'])


  def do_init(self):
    """Initialize a client"""
    self.paused = False
    with self.server.lock:
      self.server.requests.add(self)

  def do_pause(self, paused):
    """Pause or unpause a client"""
    self.paused = bool(paused)


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
  parser.add_argument('port', type=int,
      help="gulliver WebSocket server port")

  args = parser.parse_args()
  print "starting server on port %d" % args.port
  server = GulliverServer(('', args.port))
  TickThread(0.1, server.on_robot_event).start() #XXX
  server.serve_forever()

if __name__ == '__main__':
  main()

