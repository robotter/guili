/*
 * Console use a Web Worker to execute commands in a sandboxed environment.
 *
 * Main and worker threads communicate using messages. Message data is an
 * Object with (at least) a method property giving the type of the message.
 * Other properties depend on the method.
 * - main -> worker
 *   - id: unique ID identifying the message
 *   Methods and their parameters are given below
 *     - eval: evaluate a Javascript expression
 *       - code: code to execute (string)
 *     - scope: add values to worker scope
 *       - scope: Object to merge to current scope
 *     - complete: autocomplete given dotted variable
 *       - variable: a dotted variable name
 * - worker -> main
 *   - response: response to a message
 *     - id: id of the origin message
 *     - data: response data (depends on method)
 *     - error: error message string, in case of error
 *   - log: a message to log to the browser console (used for debug)
 *     - data: data to log
 *   - rome: a ROME message to send
 *     - name: name of the ROME message
 *     - params: ROME message parameters as an Object
 */

Portlet.register('console', 'Console', class extends Portlet {

  async init(options) {
    await super.init(options);

    // init worker
    this.request_id = 0;
    this.callbacks = {};
    this.worker = new Worker("portlets/console-worker.js?_="+(new Date().getTime()));

    this.worker.onmessage = (ev) => {
      const data = ev.data;
      const method = data.method;
      if(method == 'response') {
        const cb = this.callbacks[data.id];
        if(cb) {
          delete this.callbacks[data.id];
          cb(data);
        }
      } else if(method == 'rome') {
        gs.sendRomeMessage(data.robot, data.name, data.params);
      } else if(method == 'log') {
        console.log(data.data);  // for debug
      }
    };

    this.worker.send = (method, params, cb) => {
      const id = this.request_id++;
      this.callbacks[id] = cb;
      const data = { id: id, method: method };
      Object.assign(data, params);
      this.worker.postMessage(data);
    };

    gevents.addHandlerFor(this, 'rome-messages', (messages) => {
      this.worker.send('messages', { robots: gs.robots, messages: messages }, null);
    });
    gs.callMethod('rome_messages', {});

    // init HTML
    this.node.style.width = '300px';
    this.node.style.height = '200px';
    this.enableResize({ min_w: 100, min_h: 40, ratio: true });

    this.input = this.content.querySelector('input');
    this.backlog = this.content.querySelector('div.portlet-code');
    this.backlog_size = options.backlog_size || 5000;
    this.history = [];
    this.history_index = 0;
    this.history_last = null;
    this.history_size = 200;

    this.input.addEventListener('keydown', (ev) => {
      if(ev.keyCode == 13) {
        // enter: validate input
        const text = this.input.value;
        if(text != "") {
          this.validateInput(text);
          if(text != this.history[this.history.length-1]) {
            this.history.push(text);
            if(this.history.length > this.history_size) {
              this.history.pop();
            }
          }
          this.history_index = this.history.length;
          this.input.value = "";
        }
      } else if(ev.keyCode == 9) {
        // tab: autocomplete
        ev.preventDefault();
        this.completeCurrent();
      } else if(ev.keyCode == 38) {
        // up: previous history entry
        if(this.history_index == this.history.length) {
          this.history_last = this.input.value;
        }
        if(this.history_index > 0) {
          this.input.value = this.history[--this.history_index];
        }
      } else if(ev.keyCode == 40) {
        // down: next history entry
        if(this.history_index == this.history.length) {
          // nothing to do
        } else {
          if(++this.history_index == this.history.length) {
            this.input.value = this.history_last;
          } else {
            this.input.value = this.history[this.history_index];
          }
        }
      } else {
        return; // skip stopPropagation()
      }
      ev.stopPropagation();
    });

    // create the clean icon
    const clean_icon = createElementFromHtml('<i class="fa fa-trash-o" />');
    this.header.insertBefore(clean_icon, this.header.childNodes[0]);
    clean_icon.addEventListener('click', () => { this.backlog.innerHTML = ''; });
  }

  validateInput(text) {
    const entry = document.createElement('div');
    entry.classList.add('portlet-console-entry');
    this.backlog.appendChild(entry);

    const input_entry = document.createElement('div');
    entry.classList.add('portlet-console-input');
    entry.textContent = text;
    entry.appendChild(input_entry);

    while(this.backlog.childNodes.length > this.backlog_size) {
      this.backlog.childNodes[0].remove();
    }
    this.backlog.scrollTop = this.backlog.scrollHeight;

    this.worker.send('eval', {code: text}, (ev) => {
      const out = document.createElement('div');
      out.classList.add('portlet-console-output');
      if(ev.error) {
        out.classList.add('log-error');
        out.textContent = ev.error;
      } else {
        out.textContent = "=> " + ev.data;
      }
      entry.appendChild(out);
      this.backlog.scrollTop = this.backlog.scrollHeight;
    });
  }

  completeCurrent() {
    // complete suggestions for current input
    const text = this.input.value;
    let start = this.input.selectionStart;
    if(start != this.input.selectionEnd) {
      return;
    }
    const text_end = text.substring(start);
    const m = text.substring(0, start).match(/((?:[a-zA-Z_]\w*\.)*)([a-zA-Z_]\w*)?$/);
    if(m === null) {
      return;
    }
    this.worker.send('complete', { variable: m[0] }, (ev) => {
      const words = ev.data;
      start -= (m[2] || '').length;
      if(words.length == 0) {
        return; // nothing to do
      } if(words.length == 1) {
        m[2] = words[0];
      } else {
        // find longest common prefix
        const wfirst = words[0];
        const wlast = words[words.length-1];
        let i;
        for(i=0; wfirst.charAt(i) == wlast.charAt(i); i++) ;
        m[2] = wfirst.substring(0, i);
      }
      this.input.value = m.input.substring(0, m.index) + m[1] + m[2] + text_end;
      this.input.selectionStart = this.input.selectionEnd = start + m[2].length
    });
  }

});

