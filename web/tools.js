'use strict';


function isString(v) {
  return Object.prototype.toString.call(v) === '[object String]';
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Create an element from HTML
function createElementFromHtml(html) {
  const el = document.createElement('template');
  el.innerHTML = html;
  return el.content.cloneNode(true).firstChild;
}


// Add time to URLs to avoid cache
function noCacheUrl(url) {
  return url + ((/\?/).test(url) ? '&' : '?') + '_=' + (new Date()).getTime();
}

// Load file, return its content
async function loadFile(url) {
  const xhr = new XMLHttpRequest();

  return await new Promise((resolve, reject) => {
    xhr.onload = function() {
      if(this.responseText !== null) {
        resolve(this.responseText);
      } else {
        reject();
      }
    };
    xhr.open('GET', noCacheUrl(url));
    xhr.send();
  });
}

// Load a JS script
async function loadScript(url) {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = noCacheUrl(url);
    script.async = true;
    script.onload = () => { resolve(); };
    document.querySelector('head').appendChild(script);
  });
}


// Observer, for custom non-DOM events
//
// Handlers can be associated to an owner using addHandlerFor().
// All events of a given owner can be removed at once using removeHandlersOf().
class EventObserver {
  constructor() {
    this.callbacks = {};
    this.owners = new Map();
  }

  addHandler(name, cb) {
    const callbacks = this.callbacks[name];
    if(callbacks === undefined) {
      this.callbacks[name] = [cb];
    } else {
      callbacks.push(cb);
    }
  }

  removeHandler(name, cb) {
    const callbacks = this.callbacks[name];
    if(callbacks !== undefined) {
      callbacks.splice(callbacks.indexOf(cb), 1);
    }
  }

  addHandlerFor(owner, name, cb) {
    const callbacks = this.owners.get(owner);
    if(callbacks === undefined) {
      this.owners.set(owner, [[name, cb]]);
    } else {
      callbacks.push([name, cb]);
    }
    this.addHandler(name, cb);
  }

  removeHandlersOf(owner) {
    const callbacks = this.owners.get(owner);
    if(callbacks !== undefined) {
      for(const [name, cb] of callbacks) {
        this.removeHandler(name, cb);
      }
    }
  }

  trigger(name, ...args) {
    const callbacks = this.callbacks[name];
    if(callbacks !== undefined) {
      for(const cb of callbacks) {
        cb(...args);
      }
    }
  }
}


// Create a clickable menu
//
// The following options are defined:
//   menu -- menu `ul` element (if not set, a new one is created)
//   button -- element used to toggle the menu
//   items -- list of menu items to add (see below)
//
// Items are objects with the following items:
//   node -- item DOM node, or text string
//   onselect -- handler called when item is clicked on
//
// Either `element` or `text` must be set, but not both.
//
// Return the menu element.
function createClickMenu(options) {
  let menu = options.menu;
  if(menu) {
    for(const el of menu.querySelectorAll(':scope > li')) {
      el.remove();
    }
  } else {
    menu = document.createElement('ul');
  }
  menu.classList.add('clickmenu');
  menu.style.display = 'none';  // start hidden

  const hide_handler = () => {
    menu.style.display = 'none';
    menu.removeEventListener('click', hide_handler);
  };

  // build menu items
  for(const item of options.items) {
    const li = document.createElement('li');
    li.innerHTML = '<a href="#"></a>';
    if(isString(item.node)) {
      li.firstChild.textContent = item.node;
    } else if(item.node) {
      li.firstChild.appendChild(item.node);
    }
    if(item.onselect) {
      li.addEventListener('click', (ev) => {
        item.onselect();
        hide_handler();
        ev.stopPropagation();
      });
    }
    menu.appendChild(li);
  }

  //TODO hide menu after clicking on a menu item
  // setup button handler to toggle the menu
  options.button.addEventListener('click', (ev) => {
    if(menu.style.display == 'block') {
      menu.style.display = 'none';
      document.removeEventListener('click', hide_handler);
    } else {
      menu.style.display = 'block';
      document.addEventListener('click', hide_handler);
    }
    ev.stopPropagation();
  });

  return menu;
}


// Modal window
class Modal {

  // Create a modal
  //
  // The provided element will be wrapped and moved to `container`.
  // Buttons will be appended after the content element.
  //
  // Note: do not recreate a modal with an already wrapped element.
  //
  // options:
  //   content -- modal content
  //   container -- modal container (default: `content.parentNode`)
  //   buttons -- an map of buttons: {text: onclick(modal, ev)}
  //   id -- ID to set to the wrapper element
  //
  constructor(options) {
    const content = options.content;
    const container = options.container || content.parentNode;

    // wrap
    const dom = createElementFromHtml('<div class="modal"><div class="modal-content"></div></div>');
    if(options.id) {
      dom.id = options.id;
    }
    if(content.parentNode) {
      content.parentNode.insertBefore(dom, content);
    }
    const modal_content = dom.querySelector('.modal-content')
    modal_content.appendChild(content);

    // add buttons
    if(options.buttons) {
      const buttons = createElementFromHtml('<div class="modal-buttons"></div>');
      for (let [txt, handler] of options.buttons) {
        const button = document.createElement('button');
        button.textContent = txt;
        button.onclick = (ev) => handler(this, ev);
        buttons.appendChild(button);
      }
      modal_content.appendChild(buttons);
    }

    if(dom.parentNode !== container) {
      container.appendChild(dom);
    }

    this.dom = dom;

    // bind handlers
    this.onOutsideClick = this.onOutsideClick.bind(this);
    this.onEscapeKey = this.onEscapeKey.bind(this);
  }

  // Open the modal
  open() {
    this.dom.style.display = 'block';
    this.dom.addEventListener('click', this.onOutsideClick);
    document.addEventListener('keydown', this.onEscapeKey);
  }

  // Close the modal
  close() {
    this.dom.style.display = 'none';
    this.dom.removeEventListener('click', this.onOutsideClick);
    document.removeEventListener('keydown', this.onEscapeKey);
  }

  // Handler to close the modal when clicking outside of it
  onOutsideClick(ev) {
    if(ev.target === this.dom) {
      this.close();
      ev.preventDefault();
    }
  }

  // Handler to close modal when pressing Escape
  onEscapeKey(ev) {
    if(ev.which == 27) {
      this.close();
      ev.preventDefault();
    }
  }
}


// Snap an rectangle to given elements
//
// `rect` must contain keys `x0`, `y0`, `x1`, `y1`.
// `sides` is an array of sides (`rect` keys) to snap to.
// Computations use `offset*` values from elements
// Therefore, they should share the same `offsetParent`.
//
// Return a [side, pos] pair.
//   `side` is a `rect` key
//   `pos` is the snap position (in pixels)
function snapToElements(rect, sides, margin, elements) {
  const {x0, y0, x1, y1} = rect;
  const snap_x0 = sides.includes('x0');
  const snap_y0 = sides.includes('y0');
  const snap_x1 = sides.includes('x1');
  const snap_y1 = sides.includes('y1');

  let snap_side = undefined;  // side of the moved element
  let snap_pos = undefined;
  for(const e of elements) {
    const e_x0 = e.offsetLeft;
    const e_y0 = e.offsetTop;
    const e_x1 = e.offsetLeft + e.offsetWidth;
    const e_y1 = e.offsetTop + e.offsetHeight;
    if(e_y0 < y1 && y0 < e_y1) {
      if(snap_x0 && Math.abs(e_x1 - x0) < margin) {
        margin = Math.abs(e_x1 - x0);
        snap_side = 'x0';
        snap_pos = e_x1;
      }
      if(snap_x1 && Math.abs(e_x0 - x1) < margin) {
        margin = Math.abs(e_x0 - x1);
        snap_side = 'x1';
        snap_pos = e_x0;
      }
    }
    if(e_x0 < x1 && x0 < e_x1) {
      if(snap_y0 && Math.abs(e_y1 - y0) < margin) {
        margin = Math.abs(e_y1 - y0);
        snap_side = 'y0';
        snap_pos = e_y1;
      }
      if(snap_y1 && Math.abs(e_y0 - y1) < margin) {
        margin = Math.abs(e_y0 - y1);
        snap_side = 'y1';
        snap_pos = e_y0;
      }
    }
  }

  return [snap_side, snap_pos];
}

// Enable/disable mouse event on embedded elements
//
// By default, <object> elements capture mouse events, including `mousemove`.
// This makes drag operations very quirky to use.
function toggleMouseOnObjects(enable) {
  for(const o of document.querySelectorAll('object')) {
    o.classList.toggle('disable-mouse-on-objects', !enable);
  }
}


// Move an element around
//
// The following options are supported:
//   handle -- element to click on to start moving (default: whole element)
//   snap_on -- elements on which snap, selector resolved from `offsetParent`
//   snap_margin -- snapping distance (default: none)
//
// Moving is contained to the `offsetParent`.
//
// The target element must fulfill these requirements:
//  - style.position must be set to `absolute)`
//  - style.left and style.top must be set to a pixel value
class MouseMover {
  constructor(el, options) {
    this.startMove = this.startMove.bind(this);
    this.updateMove = this.updateMove.bind(this);
    this.endMove = this.endMove.bind(this);

    this.el = el;
    this.handle = options.handle || el;
    this.handle.addEventListener('mousedown', this.startMove);
    this.snap_on = options.snap_on || null;
    this.snap_margin = options.snap_margin || null;

    this.cssOffset = null;
    this.offset0 = null;
    this.limits = null;
    this.snap_elements = null;
  }

  startMove(ev) {
    const style = window.getComputedStyle(this.el);
    this.cssOffset = {
      x: parseInt(style.left, 10) - this.el.offsetLeft,
      y: parseInt(style.top, 10) - this.el.offsetTop,
    };
    this.offset0 = {
      x: this.el.offsetLeft - ev.clientX,
      y: this.el.offsetTop - ev.clientY,
    };
    this.limits = {
      x: this.el.offsetParent.offsetWidth - this.el.offsetWidth,
      y: this.el.offsetParent.offsetHeight - this.el.offsetHeight,
    };
    if(this.snap_on) {
      this.snap_elements = Array.from(this.el.offsetParent.querySelectorAll(this.snap_on))
        .filter(e => (e !== this));
    }

    this.handle.removeEventListener('mousedown', this.startMove);
    window.addEventListener('mousemove', this.updateMove);
    window.addEventListener('mouseup', this.endMove);
    toggleMouseOnObjects(false);
    ev.stopPropagation();
    ev.preventDefault();
  }

  updateMove(ev) {
    let x0 = clamp(ev.clientX + this.offset0.x, 0, this.limits.x);
    let y0 = clamp(ev.clientY + this.offset0.y, 0, this.limits.y);

    if(this.snap_elements) {
      const rect = {
        x0: x0,
        y0: y0,
        x1: x0 + this.el.offsetWidth,
        y1: y0 + this.el.offsetHeight,
      };
      const [snap_side, snap_pos] = snapToElements(rect, ['x0', 'y0', 'x1', 'y1'], this.snap_margin, this.snap_elements);
      switch(snap_side) {
        case 'x0': x0 = snap_pos; break;
        case 'x1': x0 = snap_pos - this.el.offsetWidth; break;
        case 'y0': y0 = snap_pos; break;
        case 'y1': y0 = snap_pos - this.el.offsetHeight; break;
      }
    }

    this.el.style.left = (x0 + this.cssOffset.x) + 'px';
    this.el.style.top = (y0 + this.cssOffset.y) + 'px';
    ev.stopPropagation();
    ev.preventDefault();
  }

  endMove(ev) {
    window.removeEventListener('mousemove', this.updateMove);
    window.removeEventListener('mouseup', this.endMove);
    this.handle.addEventListener('mousedown', this.startMove);
    toggleMouseOnObjects(true);
    ev.stopPropagation();
    ev.preventDefault();
  }

  destroy() {
    // unbind all possible events
    window.removeEventListener('mousemove', this.updateMove);
    window.removeEventListener('mouseup', this.endMove);
    this.handle.removeEventListener('mousedown', this.startMove);
    toggleMouseOnObjects(true);
  }
}


// Allow to resize an element using handles
//
// The following options are supported:
//   snap_on -- elements on which snap, selector resolved from `offsetParent`
//   snap_margin -- snapping distance (default: none)
//   min_w, min_h -- minimum size
//   ratio -- preserve size ratio (default: false)
//
// Resizing is contained to the `offsetParent`.
//
// The target element must fulfill these requirements:
//  - style.position must be set to `absolute)`
//  - style.left, style.top, style.width and style.height must be set to a pixel value
class MouseResizer {
  constructor(el, options) {
    this.startResize = this.startResize.bind(this);
    this.updateResize = this.updateResize.bind(this);
    this.endResize = this.endResize.bind(this);

    this.el = el;
    this.snap_on = options.snap_on || null;
    this.snap_margin = options.snap_margin || null;
    this.ratio = options.ratio || false;
    this.min_size = { w: options.min_w || 10, h: options.min_h || 10 };

    this.cssOffset = null;
    this.offset0 = null;
    this.rect0 = null;
    this.kmin = this.kmax = null;
    this.snap_elements = null;
    this.resize_dir = null;
    this.snap_sides = null;

    // create handles
    const directions = [
      ['n',  {x:  0, y: -1}],
      ['e',  {x: +1, y:  0}],
      ['s',  {x:  0, y: +1}],
      ['w',  {x: -1, y:  0}],
      // corner handles must be added last, for z-index
      ['ne', {x: +1, y: -1}],
      ['nw', {x: -1, y: -1}],
      ['se', {x: +1, y: +1}],
      ['sw', {x: -1, y: +1}],
    ];

    this.handles = {};
    this.handle_to_directions = new Map();
    for(const [dir, dxy] of directions) {
      const handle = document.createElement('div');
      handle.classList.add('resize-handle-' + dir);
      this.el.appendChild(handle);
      this.handles[dir] = handle;
      this.handle_to_directions.set(handle, dxy);
    }

    // add the mousedown listeners
    this.endResize(null);
  }

  startResize(ev) {
    const dir = this.resize_dir = this.handle_to_directions.get(ev.currentTarget);
    if(dir === undefined) {
      return;  // should not happen
    }

    const style = window.getComputedStyle(this.el);
    this.cssOffset = {
      x: parseInt(style.left, 10) - this.el.offsetLeft,
      y: parseInt(style.top, 10) - this.el.offsetTop,
      w: parseInt(style.width, 10) - this.el.offsetWidth,
      h: parseInt(style.height, 10) - this.el.offsetHeight,
    };
    this.rect0 = {
      x0: this.el.offsetLeft,
      y0: this.el.offsetTop,
      x1: this.el.offsetLeft + this.el.offsetWidth,
      y1: this.el.offsetTop + this.el.offsetHeight,
      w: this.el.offsetWidth,
      h: this.el.offsetHeight,
    };
    this.offset0 = {
      x0: this.rect0.x0 - ev.clientX,
      y0: this.rect0.y0 - ev.clientY,
      x1: this.rect0.x1 - ev.clientX,
      y1: this.rect0.y1 - ev.clientY,
    };
    if(this.ratio) {
      this.kmin = Math.max(this.min_size.w / this.rect0.w, this.min_size.h / this.rect0.h);
      // by default, extend from bottom/right to preserve ratio
      this.kmax = Math.min(
        (dir.x < 0 ? this.rect0.x1 : this.el.offsetParent.offsetWidth - this.rect0.x0) / this.rect0.w,
        (dir.y < 0 ? this.rect0.y1 : this.el.offsetParent.offsetHeight - this.rect0.y0) / this.rect0.h
      );
    }
    if(this.snap_on) {
      this.snap_sides = [];
      if(dir.x < 0) {
        this.snap_sides.push('x0');
      } else if(dir.x > 0) {
        this.snap_sides.push('x1');
      }
      if(dir.y < 0) {
        this.snap_sides.push('y0');
      } else if(dir.y > 0) {
        this.snap_sides.push('y1');
      }
      this.snap_elements = Array.from(this.el.offsetParent.querySelectorAll(this.snap_on))
        .filter(e => (e !== this));
    }

    window.addEventListener('mousemove', this.updateResize);
    window.addEventListener('mouseup', this.endResize);
    toggleMouseOnObjects(false);
    ev.stopPropagation();
    ev.preventDefault();
  }

  updateResize(ev) {
    const dir = this.resize_dir;
    const rect = {...this.rect0};

    if(this.ratio) {
      let k = 0;
      // first, compute resize ratio (use larger one)
      if(dir.x < 0) {
        k = Math.max(k, (rect.x1 - (this.offset0.x0 + ev.clientX)) / rect.w);
      } else if(dir.x > 0) {
        k = Math.max(k, ((this.offset0.x1 + ev.clientX) - rect.x0) / rect.w);
      }
      if(dir.y < 0) {
        k = Math.max(k, (rect.y1 - (this.offset0.y0 + ev.clientY)) / rect.h);
      } else if(dir.y > 0) {
        k = Math.max(k, ((this.offset0.y1 + ev.clientY) - rect.y0) / rect.h);
      }
      // apply min/max limits
      k = clamp(k, this.kmin, this.kmax);

      // then apply it
      if(dir.x < 0) {
        rect.x0 = rect.x1 - k * rect.w;
      } else {
        rect.x1 = rect.x0 + k * rect.w;
      }
      if(dir.y < 0) {
        rect.y0 = rect.y1 - k * rect.h;
      } else {
        rect.y1 = rect.y0 + k * rect.h;
      }

    } else {
      if(dir.x < 0) {
        rect.x0 = clamp(this.offset0.x0 + ev.clientX, 0, rect.x1 - this.min_size.w);
      } else if(dir.x > 0) {
        rect.x1 = clamp(this.offset0.x1 + ev.clientX, rect.x0 + this.min_size.w, this.el.offsetParent.offsetWidth);
      }
      if(dir.y < 0) {
        rect.y0 = clamp(this.offset0.y0 + ev.clientY, 0, rect.y1 - this.min_size.h);
      } else if(dir.y > 0) {
        rect.y1 = clamp(this.offset0.y1 + ev.clientY, rect.y0 + this.min_size.h, this.el.offsetParent.offsetHeight);
      }
    }

    if(this.snap_elements) {
      const [snap_side, snap_pos] = snapToElements(rect, this.snap_sides, this.snap_margin, this.snap_elements);
      if(snap_side) {
        rect[snap_side] = snap_pos;
      }
    }

    if(this.ratio || dir.x != 0) {
      this.el.style.left = (rect.x0 + this.cssOffset.x) + 'px';
      this.el.style.width = (rect.x1 - rect.x0 + this.cssOffset.w) + 'px';
    }
    if(this.ratio || dir.y != 0) {
      this.el.style.top = (rect.y0 + this.cssOffset.y) + 'px';
      this.el.style.height = (rect.y1 - rect.y0 + this.cssOffset.h) + 'px';
    }

    ev.stopPropagation();
    ev.preventDefault();
  }

  endResize(ev) {
    window.removeEventListener('mousemove', this.updateResize);
    window.removeEventListener('mouseup', this.endResize);

    for(const o of Object.values(this.handles)) {
      o.addEventListener('mousedown', this.startResize);
    }

    if(ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }

    toggleMouseOnObjects(true);
  }

  destroy() {
    // remove handle elements (this will remove their events)
    for(const o of Object.values(this.handles)) o.remove();
    // unbind all possible events
    window.removeEventListener('mousemove', this.updateResize);
    window.removeEventListener('mouseup', this.endResize);
    toggleMouseOnObjects(true);
  }
}

