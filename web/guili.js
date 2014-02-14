
// Same as Number.fixed() but use U+2212 minus sign
Number.prototype.toFixedHtml = function(n) {
  if(this < 0) {
    return '\u2212' + (-this).toFixed(n);
  } else {
    return this.toFixed(n);
  }
}


/*
 * WebSocket
 *
 * A custom 'ws-status' event is triggered on WebSocket status change.
 * The following event parameters are provided:
 *   WebSocket event (null if type is 'connect')
 *   event type ('open', 'error', 'close' or 'connect')
 *   WebSocket readyState value
 */

var gs = {
  ws: null,  // WebSocket object

  // start or restart the socket
  // return a Deferred object resolved when connection is opened
  start: function(uri) {
    if(this.ws !== null && !uri) {
      uri = this.ws.url;
    }
    var self = this;
    this.start_deferred = $.Deferred();
    this.ws = new WebSocket(uri);
    this.triggerStatusEvent(null, 'connect');
    this.ws.onopen = this.handle.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onerror = function(ev) { self.triggerStatusEvent(ev, 'error'); }
    this.ws.onclose = function(ev) { self.triggerStatusEvent(ev, 'close'); }
    return this.start_deferred;
  },

  // handle the connection once opened
  handle: function(ev) {
    this.triggerStatusEvent(ev, 'open');
    this.callMethod('init', {});
    if(this.start_deferred !== null) {
      this.start_deferred.resolve();
      this.start_deferred = null;
    }
  },

  // trigger a ws-status event
  triggerStatusEvent: function(ev, type) {
    $.event.trigger('ws-status', [ev, type, this.ws.readyState]);
  },

  // WebSocket onmessage handler
  onMessage: function(ev) {
    try {
      var data = JSON.parse(ev.data);
    } catch(e) {
      console.error("invalid WebSocket message data");
    }
    if(data.event) {
      var f = this.event_handler[data.event];
      if(f) {
        f.call(this, data.params);
      }
    }
  },

  // send a method call
  callMethod: function(name, params) {
    this.ws.send(JSON.stringify({method: name, params: params}));
  },

  // send a ROME message
  sendRomeMessage: function(name, params) {
    this.callMethod('rome', { name: name, params: params });
  },

  // event handlers
  event_handler: {
    frame: function(params) {
      Portlet.handleFrame(params.name, params.params);
      $.event.trigger('rome-frame', [params.name, params.params]);
    },
    messages: function(params) {
      $.event.trigger('rome-messages', [params.messages]);
    },
    log: function(params) {
      $.event.trigger('ws-log', [params.severity, params.message]);
    },
    configurations: function(params) {
      $.event.trigger('portlets-configurations', [params.configurations]);
    },
  },

};



/*
 * Portlets
 */

var Portlet = function() {};

Portlet.prototype = {
  // must be set by subclass
  name: null,
  pretty_name: null,
  // set to the portlet's jQuery object
  node: null,
  content: null,
  header: null,

  // initialize the portlet
  // return a Promise if init is asynchronous
  // The base method should be called after portlet size is known.
  // In fact, it should be called after subclass initialization.
  init: function(options) {
    var self = this;
    var handle = this.node.find('.portlet-header .fa-arrows');
    this.node.draggable({ containment: 'parent', handle: handle, snap: true, snapTolerance: 5 });
    this.node.find('.portlet-header .fa-times').click(function() {
      self.destroy();
    });
  },

  // destroy the portlet
  destroy: function() {
    // unregister the portlet instance
    Portlet.instances.splice($.inArray(this, Portlet.instances), 1);
    // unregister the portlet handlers
    this.unbindFrame();
    this.node.remove();
  },

  // set portlet's position
  position: function(left, top) {
    var offset = this.node.parent().offset();
    this.node.offset({ left: left+offset.left, top: top+offset.top });
  },

  // set position to an empty space, if available
  // note: this cannot be called before portlet size is known
  positionAuto: function(margin) {
    var self = this;
    margin = margin === undefined ? 3 : margin; // default margin

    // get dimensions of an object
    var getBox = function(o, margin) {
      var offset = o.offset();
      return {
        x0: offset.left - margin,
        y0: offset.top - margin,
        x1: offset.left + o.width() + margin,
        y1: offset.top + o.height() + margin,
      };
    }

    // portlet dimensions
    var w = this.node.width();
    var h = this.node.height();
    // container bonding box
    var limits = getBox(this.node.parent(), -margin);
    // portlets bonding boxes
    var boxes = [];
    Portlet.instances.forEach(function(p) {
      if(p !== self) {
        boxes.push(getBox(p.node, margin+2)); // +2 for borders
      }
    });
    // sort bonding boxes by y0
    boxes.sort(function(a,b) { return a.y0 - b.y0; });

    // find an empty place from top to bottom, from left to right
    var next_x, next_y;
    for(var y=limits.y0; y+h<limits.y1; y=next_y ) {
      next_y = limits.y1;
      for(var x=limits.x0; x+w<limits.x1; x=next_x) {
        next_x = limits.x1;
        var ok = true;
        for(var i=0; i<boxes.length; ++i) {
          var box = boxes[i];
          if(box.y1 <= y) {
            // this box will not be needed anymore
            boxes.splice(i--, 1);
            continue;
          }
          if(box.x1 > x && box.x1 < next_x) {
            next_x = box.x1
          }
          if(box.y1 > y && box.y1 < next_y) {
            next_y = box.y1
          }
          if(ok && box.y0 < y+h && x < box.x1 && x+w > box.x0) {
            ok = false;
          }
        }
        if(ok) {
          this.node.offset({ left: x, top: y });
          return;
        }
      }
    }

  },

  // register a ROME frame handler
  bindFrame: function(name, cb) {
    if(!(name in Portlet.frame_handlers)) {
      Portlet.frame_handlers[name] = [];
    }
    Portlet.frame_handlers[name].push([this, cb]);
  },

  // unregister ROME frame handlers
  // if name is not provided, unregister all frame handlers
  unbindFrame: function(name) {
    if(name) {
      var handlers = Portlet.frame_handlers[name];
      for(var i=handlers.length-1; i>=0; i--) {
        if(handlers[i][0] === this) {
          handlers.splice(i, 1);
        }
      }
    } else {
      for(var name in Portlet.frame_handlers) {
        this.unbindFrame(name);
      }
    }
  },

};

// Load all portlet, return a Deferred object
Portlet.loadAll = function(names) {
  var deferreds = names.map(function(name) {
    return $.getScript("portlets/"+name+".js");
  });
  return $.when.apply($.when, deferreds);
};

// Register a new portlet (use by portlet scripts)
Portlet.register = function(attrs) {
  var subclass = function() {};
  subclass.prototype = new Portlet();
  for(var k in attrs) {
    subclass.prototype[k] = attrs[k];
  }
  this.classes[attrs.name] = subclass;
};

// Create a new portlet, add it to the DOM tree
// Return a Promise resolved when portlet initialization is done, with this
// being the portlet instance
Portlet.create = function(root, name, options) {
  if(options === undefined) {
    options = {};
  }
  var self = this;
  // create the HTML node
  var div = $('#portlet-template').clone(false).removeAttr('id');
  root.append(div);

  var deferred = $.Deferred();

  // get portlet's content div and initialize it
  var content = div.children('div:last');
  content.load("portlets/"+name+".html", function() {
    // create the Portlet instance
    var portlet = new self.classes[name]();
    portlet.node = div;
    portlet.content = content;
    portlet.header = div.children('div:first');

    var init_df = portlet.init(options);
    var on_init_done = function() {
      self.instances.push(portlet);
      deferred.resolveWith(portlet);
      // set position when element is initialized, because the size needs to be known
      if(options.position) {
        var pos = options.position;
        if(pos.x !== undefined && pos.y !== undefined) {
          portlet.position(pos.x, pos.y);
        }
        if(pos.h) {
          portlet.node.height(pos.h);
        }
        if(pos.w) {
          portlet.node.width(pos.w);
        }
      } else {
        portlet.positionAuto();
      }
    };
    if(init_df) {
      init_df.done(on_init_done);
    } else {
      on_init_done();
    }
  });
  return deferred.promise();
};

// Trigger ROME frame handlers
Portlet.handleFrame = function(name, params) {
  var handlers = this.frame_handlers[name];
  if(handlers) {
    handlers.forEach(function(v) { v[1].call(v[0], params); });
  }
};

// Set a new portlets configuration
Portlet.setConfiguration = function(conf) {
  if(!conf) {
    return;
  }

  // remove current portlets
  Portlet.instances.slice(0).forEach(function(p) {
    p.destroy();
  });

  // create new ones
  var container = $('#portlets');
  conf.forEach(function(o) {
    Portlet.create(container, o[0], o[1]);
  });
};

// Map of registered portlet classes
Portlet.classes = {};
// List of portlet instances
Portlet.instances = [];
// Map or ROME frame handlers
// indexes are frame name, values are lists of (portlet, handler) pairs
Portlet.frame_handlers = {};


/*****/

// set handler for WS status display
$(document).on('ws-status', function(ev, wsev, type, state) {
  var classes;
  var text;
  switch(state) {
    case WebSocket.CONNECTING:
      classes = 'status-neutral fa fa-spinner fa-spin';
      text = 'connecting...';
      break;
    case WebSocket.OPEN:
      classes = 'status-opened fa fa-circle';
      text = 'connected';
      break;
    case WebSocket.CLOSING:
      classes = 'status-closed fa fa-circle';
      text = 'closing...'
      break;
    case WebSocket.CLOSED:
      classes = 'status-closed fa fa-circle';
      text = 'disconnected'
      break;
  }
  $('#ws-status-text').text(text);
  $('#ws-status-icon').removeClass().addClass(classes);

  if(type == 'error') {
    if(wsev.data) {
      console.log("WS error: "+wsev.data);
    }
  } else if(type == 'close') {
    if(wsev.reason) {
      console.log("WS close: "+wsev.reason);
    } else {
      console.log("WS close");
    }
  } else if(type == 'open') {
    console.log("WS connected");
  }
});

// change play/pause item on WS status change
$(document).on('ws-status', function(ev, wsev, type, state) {
  if(type == 'connect') {
    $('#play-pause-icon').removeClass().addClass('fa fa-refresh fa-spin');
  } else if(type == 'open') {
    $('#play-pause-icon').removeClass().addClass('fa fa-pause');
  } else if(state == WebSocket.CLOSED) {
    $('#play-pause-icon').removeClass().addClass('fa fa-refresh');
  }
});

// play/pause actions
$('#play-pause-icon').click(function() {
  var self = $(this);
  if(self.hasClass('fa-refresh')) {
    if(gs.ws.readyState == WebSocket.CLOSED) {
      gs.start();
    }
  } else if(self.hasClass('fa-pause')) {
    gs.callMethod('pause', { paused: true });
    self.removeClass().addClass('fa fa-play');
  } else if(self.hasClass('fa-play')) {
    gs.callMethod('pause', { paused: false });
    self.removeClass().addClass('fa fa-pause');
  }
});

// reopen socket when clicking on WS status
$('#ws-status').click(function() {
  if(gs.ws.readyState == WebSocket.CLOSED) {
    gs.start();
  }
});


$(document).on('portlets-configurations', function(ev, configs) {
  var set_default = false;

  // create/update the menu to change configuration
  var icon = $('#set-configuration-icon');
  var menu = $('#set-configuration-menu');
  // sort configurations by name, to preserve order
  Object.keys(configs).sort().map(function(k) {
    var conf = configs[k];
    var item = $('<li><a href="#"></a></li>').appendTo(menu);
    item.data('name', k);
    item.children('a').text(k)
  });

  menu.clickMenu(icon, {
    select: function(ev, ui) {
      Portlet.setConfiguration(configs[ui.item.data('name')]);
    },
  });

  // if there are no portlets, assume startup and load the default conf
  if(Portlet.instances.length == 0) {
    Portlet.setConfiguration(configs['default']);
  }
});



$(document).ready(function() {
  // open WS socket, create portlets
  var hostname = $('<a>').prop('href', document.location).prop('hostname');
  if(!hostname) {
    hostname = 'localhost';
  }

  $.when(
    gs.start("ws://"+hostname+":2080/ws"),
    Portlet.loadAll(['coordinates', 'field', 'graph', 'console'])
  ).done(function() {
    // create menu to add portlets
    {
      var icon = $('#add-portlet-icon');
      var menu = $('#add-portlet-menu');
      // sort portlets on name, to preserve order
      Object.keys(Portlet.classes).sort().map(function(k) {
        var cls = Portlet.classes[k].prototype;
        var item = $('<li><a href="#"></a></li>').appendTo(menu);
        item.data('name', cls.name);
        item.children('a').text(cls.pretty_name)
      });

      menu.clickMenu(icon, {
        select: function(ev, ui) {
          Portlet.create($('#portlets'), ui.item.data('name'))
            .done(function() {
              this.positionAuto();
            });
        },
      });
    }

    // load configurations
    gs.callMethod('configurations', {});
  });

});

