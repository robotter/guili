'use strict';


function isString(v) {
  return Object.prototype.toString.call(v) === '[object String]';
}

// Create an element from HTML
function createElementFromHtml(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.firstChild;
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
      menu.removeChild(el);
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

