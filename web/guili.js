
// Same as Number.fixed() but use U+2212 minus sign
Number.prototype.toFixedHtml = function(n) {
  if(this < 0) {
    return '\u2212' + (-this).toFixed(n);
  } else {
    return this.toFixed(n);
  }
}


// Global event observer
const gevents = new EventObserver();


/*
 * WebSocket
 *
 * A custom 'ws-status' event is triggered on WebSocket status change.
 * The following event parameters are provided:
 *   WebSocket event (null if type is 'connect')
 *   event type ('open', 'error', 'close' or 'connect')
 *   WebSocket readyState value
 */

const gs = new class {
  constructor() {
    this.ws = null;  // WebSocket object
    this.robots = null;  // list of handled robots
    this.voltages = {};  // voltages, indexed by robot

    // event handlers
    this.event_handler = {
      frame: function(params) {
        Portlet.handleFrame(params.robot, params.name, params.params);
        gevents.trigger('rome-frame', params.robot, params.name, params.params);
      },
      messages: function(params) {
        gevents.trigger('rome-messages', params.messages);
      },
      log: function(params) {
        gevents.trigger('ws-log', params.severity, params.message);
      },
      robots: function(params) {
        gevents.trigger('robots', params.robots);
      },
      configurations: function(params) {
        gevents.trigger('portlets-configurations', params.configurations);
      },
    };
  }

  // start or restart the socket
  async start(uri) {
    if(this.ws !== null && !uri) {
      uri = this.ws.url;
    }
    await new Promise((resolve, reject) => {
      this.ws = new WebSocket(uri);
      this.triggerStatusEvent(null, 'connect');
      this.ws.onopen = (ev, type) => {
        this.triggerStatusEvent(ev, 'open');
        this.callMethod('init', {});
        resolve();
      };
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onerror = ev => this.triggerStatusEvent(ev, 'error');
      this.ws.onclose = ev => this.triggerStatusEvent(ev, 'close');
    });
  }

  // trigger a ws-status event
  triggerStatusEvent(ev, type) {
    gevents.trigger('ws-status', ev, type, this.ws.readyState);
  }

  // WebSocket onmessage handler
  onMessage(ev) {
    let data;
    try {
      data = JSON.parse(ev.data);
    } catch(e) {
      console.error("invalid WebSocket message data");
      return;
    }
    if(data.event) {
      const f = this.event_handler[data.event];
      if(f) {
        f.call(this, data.params);
      }
    }
  }

  // send a method call
  callMethod(name, params) {
    this.ws.send(JSON.stringify({method: name, params: params}));
  }

  // send a ROME message
  sendRomeMessage(robot, name, params) {
    this.callMethod('rome', { robot: robot, name: name, params: params });
  }
};



/*
 * Portlets
 */

class Portlet {
  // Register a Portlet subclass
  static register(name, pretty_name, subclass) {
    if(!subclass.prototype instanceof Portlet) {
      throw "Portlet.register() must decorate a Portlet subclass"
    }
    subclass.portlet_name = name;
    subclass.pretty_name = pretty_name;
    Portlet.classes[name] = subclass;
  }

  constructor(node) {
    this.node = node;
    this.header = node.querySelector('div.portlet-header');
    this.content = node.querySelector('div.portlet-content');
  }

  // Initialize the portlet
  //
  // The base method should be called after portlet size is known.
  // In fact, it should be called after subclass initialization.
  async init(options) {
    const handle = this.node.querySelector('.portlet-header .fa-arrows');
    this.mover = new MouseMover(this.node, { handle: handle, snap_on: 'div.portlet', snap_margin: 5 });
    this.node.querySelector('.portlet-header .fa-times').addEventListener('click', (ev) => this.destroy());
  }

  // destroy the portlet
  destroy() {
    // unregister the portlet instance
    Portlet.instances.splice(Portlet.instances.indexOf(this), 1);
    // unregister the portlet handlers
    gevents.removeHandlersOf(this);
    this.unbindFrame();
    this.node.remove();
    this.mover.destroy();
  }

  // return portlet's configuration options
  getOptions() {
    return {position: this.getPosition()};
  }

  // Return a rect of portlet's coordinates (x, y, w, h)
  // Parent offset is subtracted, border is included
  getPosition() {
    const prect = this.node.parentNode.getBoundingClientRect();
    const rect = this.node.getBoundingClientRect();
    return {
      x: rect.x - prect.x, y: rect.y - prect.y,
      w: rect.width,
      h: rect.height,
    };
  }

  // set portlet's position and/or size
  setPosition(rect) {
    // assume a 1px border on each side
    if(rect.x !== undefined) this.node.style.left = rect.x + 'px';
    if(rect.y !== undefined) this.node.style.top = rect.y + 'px';
    if(rect.w !== undefined) this.node.style.width = (rect.w - 2) + 'px';
    if(rect.h !== undefined) this.node.style.height = (rect.h - 2) + 'px';
  }

  // set position to an empty space, if available
  // note: this cannot be called before portlet size is known
  positionAuto(margin) {
    margin = margin === undefined ? 3 : margin; // default margin

    // get dimensions of an object
    const getBox = (o, margin) => {
      const rect = o.getBoundingClientRect();
      return {
        x0: rect.left - margin,
        y0: rect.top - margin,
        x1: rect.right + margin,
        y1: rect.bottom + margin,
      };
    };

    // portlet dimensions
    const w = this.node.clientWidth;
    const h = this.node.clientHeight;
    // container bonding box
    const limits = getBox(this.node.parentNode, -margin);
    // portlets bonding boxes
    const boxes = [];
    Portlet.instances.forEach(p => {
      if(p !== this) {
        boxes.push(getBox(p.node, margin));
      }
    });
    // sort bonding boxes by y0
    boxes.sort((a,b) => { a.y0 - b.y0 });

    // find an empty place from top to bottom, from left to right
    let next_y;
    for(let y=limits.y0; y+h<limits.y1; y=next_y) {
      next_y = limits.y1;
      let next_x;
      for(let x=limits.x0; x+w<limits.x1; x=next_x) {
        next_x = limits.x1;
        let ok = true;
        for(let i=0; i<boxes.length; ++i) {
          const box = boxes[i];
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
          const prect = this.node.parentNode.getBoundingClientRect();
          this.setPosition({x: x - prect.x, y: y - prect.y});
          return;
        }
      }
    }

  }

  // register a ROME frame handler
  bindFrame(robot, name, cb) {
    Portlet.frame_handlers.push([this, robot, name, cb]);
  }

  // unregister ROME frame handlers
  // robot and name filter are optional
  unbindFrame(robot, name) {
    Portlet.frame_handlers = Portlet.frame_handlers.filter((elem) => {
      return !(elem[0] === this && (!robot || elem[1] == robot) && (!name || elem[2] == name));
    });
  }

  // Add or update for robot selection
  // The menu is stored as view_menu property.
  // If null is found in robots, an "all" entry is added
  setRobotViewMenu(robots, onselect) {
    for(const el of this.header.querySelectorAll('.view-menu')) {
      el.remmove();
    }

    const icon = createElementFromHtml('<i class="fa fa-eye" />');
    const menu = createClickMenu({
      button: icon,
      items: robots.map(robot => ({
        node: robot === null ? createElementFromHtml('<span style="font-style: italic">all</span>') : robot,
        onselect: () => onselect(robot),
      })),
    });
    menu.classList.add('portlet-header-menu');

    this.header.insertBefore(icon, this.header.firstChild);
    this.header.appendChild(menu);
    this.view_menu = menu;
  }

  // Load all portlet
  static async loadAll(names) {
    await Promise.all(names.map(v => loadScript(`portlets/${v}.js`)));
  }

  // Create a new portlet, add it to the DOM tree, return it
  static async create(root, name, options) {
    if(!this.classes[name]) {
      throw `undefined portlet: ${name}`;
    }
    if(options === undefined) {
      options = {};
    }
    // create the HTML node
    const template = document.querySelector('#portlet-template');
    const div = document.importNode(template.content.querySelector('div'), true);

    // load portlet's content div
    const content = div.querySelector('div.portlet-content');
    content.innerHTML = await loadFile(`portlets/${name}.html`)
    root.appendChild(div);
    // create the Portlet instance and initialize it
    const portlet = new this.classes[name](div);
    await portlet.init(options);

    this.instances.push(portlet);
    // set position when element is initialized, because the size needs to be known
    let pos = options.position || {};
    if(pos.x === undefined && pos.y === undefined) {
      portlet.positionAuto();
    }
    portlet.setPosition(pos);

    return portlet;
  }

  // Trigger ROME frame handlers
  static handleFrame(robot, name, params) {
    Portlet.frame_handlers.forEach(handler => {
      if(handler[2] == name && (!handler[1] || handler[1] == robot)) {
        handler[3].call(handler[0], robot, params);
      }
    });
  }

  // Get current portlets configuration
  static getConfiguration() {
    return Portlet.instances.map(p => [p.constructor.portlet_name, p.getOptions()]);
  }

  // Set a new portlets configuration
  static setConfiguration(conf) {
    if(!conf) {
      return;
    }

    // remove current portlets
    Portlet.instances.slice(0).forEach(p => p.destroy());

    // create new ones
    conf.forEach(o => Portlet.create(document.getElementById('portlets'), o[0], o[1]));
  }
}

// Map of registered portlet classes
Portlet.classes = {};
// List of portlet instances
Portlet.instances = [];
// List or ROME frame handlers
// Values are lists of (portlet, robot, msg_name, handler) pairs
// where robot is optional
Portlet.frame_handlers = [];


/*****/

// Normalize robot name
function normalizeRobotName(name, index) {
  if(name == 'galipeur' || name == 'galipette' || name == 'boomotter') {
    return name;
  } else if(name == 'pmi') {
    return 'galipette';
  } else if(name == 'boom') {
    return 'boomotter';
  } else if(index == 0) {
    return 'galipeur';
  } else if(index == 1) {
    return 'galipette';
  } else {
    return null;
  }
}


// set handler for WS status display
gevents.addHandler('ws-status', function(wsev, type, state) {
  let classes;
  let text;
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
  document.querySelector('#ws-status-text').textContent = text;
  document.querySelector('#ws-status-icon').className = classes;

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
gevents.addHandler('ws-status', function(wsev, type, state) {
  if(type == 'connect') {
    document.getElementById('play-pause-icon').className = 'fa fa-refresh fa-spin';
  } else if(type == 'open') {
    document.getElementById('play-pause-icon').className = 'fa fa-refresh fa-pause';
  } else if(state == WebSocket.CLOSED) {
    document.getElementById('play-pause-icon').className = 'fa fa-refresh fa-refresh';
  }
});

// play/pause actions
document.querySelector('#play-pause-icon').addEventListener('click', function() {
  if(this.classList.contains('fa-refresh')) {
    if(gs.ws.readyState == WebSocket.CLOSED) {
      gs.start();
    }
  } else if(this.classList.contains('fa-pause')) {
    gs.callMethod('pause', { paused: true });
    this.className = 'fa fa-play';
  } else if(this.classList.contains('fa-play')) {
    gs.callMethod('pause', { paused: false });
    this.className = 'fa fa-pause';
  }
});

// reopen socket when clicking on WS status
document.querySelector('#ws-status').addEventListener('click', function() {
  if(gs.ws.readyState == WebSocket.CLOSED) {
    gs.start();
  }
});

// battery check
gevents.addHandler('rome-frame', function(robot, name, params) {
  if(name == 'tm_battery') {
    gs.voltages[robot] = params.voltage;
    const text = [];
    if(gs.robots !== null) {
      gs.robots.forEach(r => {
        const voltage = gs.voltages[r];
        if(voltage !== undefined) {
          text.push(r + ": " + (voltage/1000).toFixedHtml(1) + ' V');
        }
      });
    }
    document.querySelector('#battery-status').textContent = text.join(' | ');
    document.querySelector('body').classList.toggle('battery-low',
      Object.entries(gs.voltages).some(([k,v]) => (
        v < (normalizeRobotName(k) == 'boomotter' ? 12000 : 13500)
      ))
    );
  }
});

gevents.addHandler('robots', function(robots) {
  gs.robots = robots;
});

gevents.addHandler('portlets-configurations', function(configs) {
  // create/update the menu to change configuration

  const menu = createClickMenu({
    menu: document.querySelector('#set-configuration-menu'),
    button: document.querySelector('#set-configuration-icon'),
    items: Object.keys(configs).sort().map(k => ({
      node: k,
      onselect: () => Portlet.setConfiguration(configs[k]),
    })),
  });

  // if there are no portlets, assume startup and load the default conf
  if(Portlet.instances.length == 0) {
    let conf = window.location.hash.substr(1);
    if(conf == "" || configs[conf] === undefined) {
      conf = "default";
    }
    Portlet.setConfiguration(configs[conf]);
  }
});



document.addEventListener('DOMContentLoaded', async () => {
  // open WS socket, create portlets
  const url = document.createElement('a');
  url.href = document.location;
  const hostname = url.hostname || 'localhost';
  const port = url.port || '80';

  // load portlets
  await Portlet.loadAll([
    'asserv', 'field', 'console', 'meca', 'logs', 'detection',
    'match', 'boomotter',
  ]);

  // initialize websocket
  await gs.start(`ws://${hostname}:${port}/ws`);

  // create menu to add portlets
  createClickMenu({
    menu: document.querySelector('#add-portlet-menu'),
    button: document.querySelector('#add-portlet-icon'),
    items: Object.keys(Portlet.classes).sort().map(k => {
      const cls = Portlet.classes[k];
      return {
        node: cls.pretty_name,
        onselect: () => {
          Portlet.create(document.getElementById('portlets'), cls.portlet_name).then(portlet => portlet.positionAuto());
        },
      }
    }),
  });

  // get a list of robots
  gs.callMethod('robots', {});
  // load configurations
  gs.callMethod('configurations', {});

});


// initialize modals
document.addEventListener('DOMContentLoaded', () => {

  const edit_configuration_modal = new Modal({
    content: document.querySelector('#edit-configuration-modal'),
    buttons: new Map([
      ["Update", (modal, ev) => {
        let new_conf = null;
        try {
          new_conf = JSON.parse(document.querySelector('#edit-configuration-text').value);
        } catch(e) {
          console.error("invalid configuration:", e);
        }
        if(new_conf !== null) {
          Portlet.setConfiguration(new_conf);
        }
        modal.close();
      }],
      ["Cancel", (modal, ev) => modal.close()],
    ]),
    id: 'edit-configuration-modal-wrapper',
  });
  document.querySelector('#edit-configuration-icon').addEventListener('click', (ev) => {
    const conf = Portlet.getConfiguration();
    const txt = document.querySelector('#edit-configuration-text');
    txt.value = JSON.stringify(conf, null, '  ');
    edit_configuration_modal.open();
  });

  const show_info_modal = new Modal({
    content: document.querySelector('#show-info-modal')
  });
  document.querySelector('#show-info-icon').addEventListener('click', (ev) => {
    const bootload_commands = document.querySelector('#show-info-bootload-commands');
    bootload_commands.innerHTML = '';
    gs.robots.forEach(robot => {
      const cmd = `curl --data-binary @main.hex "http://${window.location.host}/bl/program/${robot}"`;
      const item = createElementFromHtml(`<li>${robot}: <span style="font-family: monospace">${cmd}</span></li>`);
      bootload_commands.appendChild(item);
    });
    show_info_modal.open();
  });
});

