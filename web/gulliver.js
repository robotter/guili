
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
 */

var gs = {
  ws: null,  // WebSocket object

  // initialize the socket
  start: function(uri) {
    if(this.ws !== null) {
      throw "WebSocket already started";
    }
    var self = this;
    this.ws = new WebSocket(uri);
    this.updateStatus();
    this.ws.onopen = this.handle.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onerror = function(ev) { self.updateStatus(ev.data); }
    this.ws.onclose = function(ev) { self.updateStatus(ev.reason ? "disconnected: "+ev.reason : null); }
  },

  // handle the connection once opened
  handle: function() {
    this.updateStatus();
    this.callMethod('init', {});
  },

  // update WS status indicator (icon and text)
  updateStatus: function(text) {
    var classes;
    var default_text;
    switch(this.ws.readyState) {
      case WebSocket.CONNECTING:
        classes = 'status-neutral icon-spinner icon-spin';
        default_text = 'connecting...';
        break;
      case WebSocket.OPEN:
        classes = 'status-ok icon-circle';
        default_text = 'connected';
        break;
      case WebSocket.CLOSING:
        classes = 'status-error icon-circle';
        default_text = 'closing...'
        break;
      case WebSocket.CLOSED:
        classes = 'status-error icon-circle';
        default_text = 'disconnected'
        break;
    }

    if(!text) {
      text = default_text;
    }
    $('#ws-status-text').text(text);
    $('#ws-status-icon').removeClass().addClass(classes);
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
    this.ws.send(JSON.stringify({'method': name, 'params': params}));
  },

  // event handlers
  event_handler: {
    data: function(params) { Portlet.updateAll(params.data); },
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
    var handle = this.node.find('.portlet-header .icon-move');
    this.node.draggable({ containment: 'parent', handle: handle, snap: true, snapTolerance: 5 });
    this.node.find('.portlet-header .icon-remove').click(function() {
      self.destroy();
    });
  },

  // destroy the portlet
  destroy: function() {
    // unregister the portlet instance
    Portlet.instances.splice($.inArray(this, Portlet.instances), 1);
    this.node.remove();
  },
  
  // update the portlet with new data
  update: function(data) {},

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
        portlet.position(options.position.x, options.position.y);
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

// Update all portlet instances
Portlet.updateAll = function(data) {
  this.instances.forEach(function(p) {
    p.update(data);
  });
};

// Map of registered portlet classes
Portlet.classes = {};
// List of portlet instances
Portlet.instances = [];


/*****/

$(document).ready(function() {
  var hostname = $('<a>').prop('href', document.location).prop('hostname');
  if(!hostname) {
    hostname = 'localhost';
  }
  gs.start("ws://"+hostname+":2080/");

  Portlet.loadAll(['coordinates', 'field', 'graph']).done(function() {
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

    var container = $('#portlets');
    Portlet.create(container, 'coordinates');
    Portlet.create(container, 'field');
    Portlet.create(container, 'graph', { view: 'position' });
  });

});

