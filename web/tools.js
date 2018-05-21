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

