import struct
import threading
import queue
import itertools


api_id_to_cls = {}

class XBeeAPIPacketMeta(type):
  def __new__(mcls, name, bases, fields):
    tcls = type.__new__(mcls, name, bases, fields)
    aid = fields.get('api_id')
    if aid is not None:
      if aid in api_id_to_cls:
        raise ValueError("packet with API ID %r already defined" % aid)
      assert len(aid) == 1
      api_id_to_cls[aid[0]] = tcls
    return tcls

class XBeeAPIPacket(metaclass=XBeeAPIPacketMeta):

  START_BYTE = b'\x7e'

  packet_maximum_size = 500
  api_id = None  # to be defined in subclasses

  def pack(self):
    """Return the formatted packet data"""
    raise NotImplementedError

  def toframe(self):
    """Return the formatted XBee frame data"""
    payload = self.pack()
    frame = self.START_BYTE
    frame += struct.pack('>H', len(payload))
    frame += payload
    frame += struct.pack('B', 0xFF-self.checksum(payload))
    return frame

  @staticmethod
  def unpack(payload):
    aid = payload[0]
    return api_id_to_cls[aid].unpack(payload)

  @classmethod
  def extract_gen(cls):
    """Generator to extract packets from data

    Generator is intended to be resumed by calling send() with new incoming
    data. When there is not enough data, None is yielded.
    """

    data = b''
    while True:
      pos = data.find(cls.START_BYTE)
      if pos == -1:
        # no start byte, no frame
        data = yield None
        continue
      data = data[pos:]
      while len(data) < 4:
        # not enough data for a whole frame
        data += yield None
      size, = struct.unpack('>H', data[1:3])
      # cap size to avoid having to wait 65535 bytes on transmission error
      if size > cls.packet_maximum_size:
        continue
      end = 4 + size
      while len(data) < end:
        data += yield None
      # assert checksum validity
      if cls.checksum(data[3:end]) == 0xFF:
        data += yield data[3:end-1]
      data = data[end:]

  @classmethod
  def read(cls, fo):
    """Read a frame from a file object

    Return frame payload or None on EOF.
    Invalid frames are skipped.
    """

    if hasattr(fo, 'eof'):
      feof = fo.eof
    else:
      feof = lambda: False

    while True:
      # start byte
      data = fo.read(1)
      if not data and feof():
        return None
      if data != cls.START_BYTE:
        continue

      # payload size
      while len(data) < 3:
        c = fo.read(1)
        if c:
          data += c
        elif feof():
          return None
      size, = struct.unpack('>H', data[1:3])
      # read remaining frame data
      toread = size + 1
      while toread > 0:
        s = fo.read(toread)
        if not s:
          if feof():
            return None
          continue
        data += s
        toread -= len(s)

      # assert checksum validity
      if cls.checksum(data[3:]) == 0xFF:
        return data[3:-1]

  @staticmethod
  def checksum(payload):
    """Compute XBee API checksum on payload"""
    return sum( c for c in payload ) % 256


class XBeeAPIPacketStatus(XBeeAPIPacket):
  api_id = b'\x8a'

  status_values = {
      0: 'HRESET',
      1: 'WATCHDOG',
      2: 'ASSOC',
      3: 'DISASSOC',
      4: 'SYNCLOST',
      5: 'COORDREALIGNED',
      6: 'COORDSTART',
      }

  def __init__(self, status):
    if status in self.status_values:
      self.status = self.status_values[status]
    else:
      self.status = status
    self._status = status

  def pack(self):
    return self.api_id + struct.pack('B', self._status)

  @classmethod
  def unpack(cls, payload):
    return cls(payload[1])

  def __repr__(self):
    return "<%s status=%s>" % (self.__class__, self.status)


class XBeeAPIPacketATCommand(XBeeAPIPacket):
  """
  AT command packet

  Attributes:
    fid -- frame ID
    at -- AT command
    value -- AT command value

  """

  api_id = b'\x08'

  def __init__(self, fid, at, value=None):
    self.fid = fid
    self.at = at
    if value is None:
      self.value = ''
    else:
      self.value = value

  def pack(self):
    return self.api_id + struct.pack('>B2s', self.fid, self.at) + self.value

  @classmethod
  def unpack(cls, payload):
    fid, atc = struct.unpack('>B2s', payload[1:4])
    return cls(fid, atc, payload[5:])


class XBeeAPIPacketATResponse(XBeeAPIPacket):
  """
  AT response packet

  Attributes:
    fid -- frame ID
    at -- AT command
    status -- AT status (string)
    value -- AT response value

  """

  api_id = b'\x88'
  status_values = {0: 'OK'}

  def __init__(self, fid, at, status, value):
    self.fid = fid
    self.at = at
    self._status = status
    self.status = self.status_values.get(status, 'ERROR')
    self.value = value

  def pack(self):
    return self.api_id + struct.pack('>B2sB', self.fid, self.at, self._status) + self.value

  @classmethod
  def unpack(cls, payload):
    fid, atc, status = struct.unpack('>B2sB', payload[1:5])
    return cls(fid, atc, status, payload[5:])

  def __repr__(self):
    return "<%s fid=%d AT=%s status=%s %s>" % (
        self.__class__, self.fid, self.at, self.status, [hex(c) for c in self.value])


class XBeeAPITXStatus(XBeeAPIPacket):
  """
  TX status packet

  Attributes:
    fid -- frame ID
    status -- TX status (string)

  """

  api_id = b'\x89'
  status_values = {
      0: 'SUCCESS',
      1: 'NOACK',
      2: 'CCAFAIL',
      3: 'PURGED',
      }

  def __init__(self, fid, status):
    self.fid = fid
    self._status = status
    self.status = self.status_values.get(status, 'ERROR')

  def pack(self):
    return self.api_id + struct.pack('>BB', self.fid, self._status)

  @classmethod
  def unpack(cls, payload):
    fid, status = struct.unpack('>BB', payload[1:3])
    return cls(fid, status)

  def __repr__(self):
    return "<%s fid=%d status=%s>" % (self.__class__, self.fid, self.status)


class XBeeAPIPacketRX(XBeeAPIPacket):
  """
  RX packet

  Attributes:
    addr -- sender address
    rssi -- received signal strength indicator in dBm
    options -- information on RX event
    data -- RX data

  """

  pack_fmt = None  # to be defined in subclasses

  def __init__(self, addr, rssi, options, data):
    self.addr = addr
    self.rssi = rssi
    self.options = options
    self.data = data

  def pack(self):
    return self.api_id + struct.pack(self.pack_fmt, self.addr, -self.rssi, self.options) + self.data

  @classmethod
  def unpack(cls, payload):
    n = struct.calcsize(cls.pack_fmt)
    addr, rssi, options = struct.unpack(cls.pack_fmt, payload[1:1+n])
    packet = cls(addr, -rssi, options, payload[1+n:])
    return packet

  def __repr__(self):
    return '<%s addr=0x%04x rssi=%s opt=0x%02x %r>' % (self.__class__, self.addr, self.rssi, self.options, self.data)


class XBeeAPIPacketRX64(XBeeAPIPacketRX):
  api_id = b'\x80'
  pack_fmt = '>QBB'

class XBeeAPIPacketRX16(XBeeAPIPacketRX):
  api_id = b'\x81'
  pack_fmt = '>HBB'


class XBeeAPIPacketTX(XBeeAPIPacket):
  """
  TX packet

  Attributes:
    fid -- frame ID
    addr -- destination address
    options -- information on TX event
    data -- data to send

  """

  pack_fmt = None  # to be defined in subclasses

  def __init__(self, fid, addr, data, broadcast=False, disable_ack=False):
    self.addr = addr
    self.fid = fid
    self.options = 0
    if broadcast:
      self.options |= 0x01
    if disable_ack:
      self.options |= 0x04
    self.data = data

  def pack(self):
    return self.api_id + struct.pack(self.pack_fmt, self.fid, self.addr, self.options) + self.data

  @classmethod
  def unpack(cls, payload):
    n = struct.calcsize(cls.pack_fmt)
    fid, addr, options = struct.unpack(cls.pack_fmt, payload[1:1+n])
    packet = cls(fid, addr, payload[1+n:])
    packet.options = options
    return packet

  def __repr__(self):
    return '<%s fid=0x%X addr=%s>' % (self.__class__, self.fid, self.addr)


class XBeeAPIPacketTX64(XBeeAPIPacketTX):
  api_id = b'\x00'
  pack_fmt = '>BQB'

class XBeeAPIPacketTX16(XBeeAPIPacketTX):
  api_id = b'\x01'
  pack_fmt = '>BHB'


class XBeeAPIHub(object):
  """
  Expose XBee API remote points

  Attributes:
    conn -- serial connection
    rthread -- thread used for reading while running
    wthread -- thread used for writing while running
    wqueue -- write queue, see send() for values
    _stop_threads -- used internally to stop the hub

  """

  _stop_threads_period = 0.5

  def __init__(self, conn):
    self.conn = conn
    self.rthread = self.wthread = None
    self.wqueue = queue.Queue()
    self._stop_threads = False
    self.next_fid = itertools.cycle(range(0, 0x100)).__next__

  def start(self, background=True):
    """Start threads

    If background is True, reading is made in a new thread. Otherwise, current
    thread is used.
    """
    if self.rthread is not None or self.wthread is not None:
      raise RuntimeError("already started")
    self._stop_threads = False
    # write thread
    self.wthread = threading.Thread(target=self.run_wthread, name='XBeeAPIWrite')
    self.wthread.daemon = True
    self.wthread.start()
    # read thread
    if background:
      self.rthread = threading.Thread(target=self.run_rthread, name='XBeeAPIRead')
      self.rthread.daemon = True
      self.rthread.start()
    else:
      self.run_rthread()

  def stop(self):
    if self.rthread is None or self.wthread is None:
      raise RuntimeError("not started")
    self._stop_threads = True
    if self.rthread is not None:
      self.rthread.join()
      self.rthread = None
    if self.wthread is not None:
      self.wthread.join()
      self.wthread = None


  def send_packet(self, packet):
    """Queue a packet to send"""
    self.wqueue.put(packet)

  def send_frame(self, fid, addr, frame):
    """Queue a frame to send"""
    if fid is None:
      fid = self.next_fid()
    # chunk data into 100-byte frames
    for i in range(0, len(frame), 100):
      self.send_packet(XBeeAPIPacketTX16(fid, addr, frame[i:i+100]))


  def on_packet(self, packet):
    """Method called to handle incoming packets"""
    raise NotImplementedError

  def on_sent_packet(self, packet):
    """Method called when a packet is sent"""
    pass


  def run_rthread(self):
    """Process input data"""

    try:
      while not self._stop_threads:
        #XXX use self._stop_threads_period instead of blocking
        payload = XBeeAPIPacket.read(self.conn)
        if payload is None:
          break
        packet = XBeeAPIPacket.unpack(payload)
        self.on_packet(packet)
    finally:
      self._stop_threads = True  # to also stop wthread

  def run_wthread(self):
    """Process pending write requests"""

    while not self._stop_threads:
      try:
        packet = self.wqueue.get(True, self._stop_threads_period)
      except queue.Empty:
        continue
      self.conn.write(packet.toframe())
      self.on_sent_packet(packet)


class XBeeAPIHubFiles(XBeeAPIHub):
  """
  XBee API hub with fileobject-like access to remote devices

  File objects are non-blocking.

  Attributes:
    devices -- map of connected devices, ind, autoexed by address
    auto_add -- automatically add new devices 

  """

  max_device_rbuf = 1024

  class DeviceFile(object):
    """Emulate a file object remote device accesses"""

    def __init__(self, hub, addr):
      self.hub = hub
      self.addr = addr
      self.rbuf = b''
      self._cond = threading.Condition()

    def write(self, data):
      self.hub.send_frame(None, self.addr, data)

    def read(self, n=None):
      with self._cond:
        while not len(self.rbuf):
          self._cond.wait()
        if n is None:
          data, self.rbuf = self.rbuf, b''
        else:
          data, self.rbuf = self.rbuf[:n], self.rbuf[n:]
        return data

    def eof(self):
      return len(self.rbuf) == 0

  def __init__(self, conn, auto_add=True):
    XBeeAPIHub.__init__(self, conn)
    self.devices = {}
    self.auto_add = auto_add

  def add_device(self, addr):
    if addr not in self.devices:
      self.devices[addr] = self.DeviceFile(self, addr)

  def on_packet(self, packet):
    if isinstance(packet, XBeeAPIPacketRX):
      try:
        device = self.devices[packet.addr]
      except KeyError:
        if self.auto_add:
          self.add_device(packet.addr)
          device = self.devices[packet.addr]
        else:
          raise
      with device._cond:
        device.rbuf += packet.data
        device.rbuf = device.rbuf[-self.max_device_rbuf:]
        device._cond.notify()

