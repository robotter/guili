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
  }

  updateMove(ev) {
    let x0 = clamp(ev.clientX + this.offset0.x, 0, this.limits.x);
    let y0 = clamp(ev.clientY + this.offset0.y, 0, this.limits.y);

    if(this.snap_elements) {
      const x1 = x0 + this.el.offsetWidth;
      const y1 = y0 + this.el.offsetHeight;
      let margin = this.snap_margin;  // get the closer element
      let snap_side = null;  // side of the moved element
      let snap_pos = null;
      for(const e of this.snap_elements) {
        const e_x0 = e.offsetLeft;
        const e_y0 = e.offsetTop;
        const e_x1 = e.offsetLeft + e.offsetWidth;
        const e_y1 = e.offsetTop + e.offsetHeight;
        if(e_y0 < y1 && y0 < e_y1) {
          if(Math.abs(e_x1 - x0) < margin) {
            margin = Math.abs(e_x1 - x0);
            snap_side = 'x0';
            snap_pos = e_x1;
          }
          if(Math.abs(e_x0 - x1) < margin) {
            margin = Math.abs(e_x0 - x1);
            snap_side = 'x1';
            snap_pos = e_x0;
          }
        }
        if(e_x0 < x1 && x0 < e_x1) {
          if(Math.abs(e_y1 - y0) < margin) {
            margin = Math.abs(e_y1 - y0);
            snap_side = 'y0';
            snap_pos = e_y1;
          }
          if(Math.abs(e_y0 - y1) < margin) {
            margin = Math.abs(e_y0 - y1);
            snap_side = 'y1';
            snap_pos = e_y0;
          }
        }
      }

      switch(snap_side) {
        case 'x0': x0 = snap_pos; break;
        case 'x1': x0 = snap_pos - this.el.offsetWidth; break;
        case 'y0': y0 = snap_pos; break;
        case 'y1': y0 = snap_pos - this.el.offsetHeight; break;
      }
    }

    this.el.style.left = (x0 + this.cssOffset.x) + 'px';
    this.el.style.top = (y0 + this.cssOffset.y) + 'px';
  }

  endMove(ev) {
    window.removeEventListener('mousemove', this.updateMove);
    window.removeEventListener('mouseup', this.endMove);
    this.handle.addEventListener('mousedown', this.startMove);
  }

  destroy() {
    // unbind all possible events
    window.removeEventListener('mousemove', this.updateMove);
    window.removeEventListener('mouseup', this.endMove);
    this.handle.removeEventListener('mousedown', this.startMove);
  }
}

