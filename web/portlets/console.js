
Portlet.register({
  name: 'console',
  pretty_name: 'Console',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    var self = this;

    // init worker
    this.request_id = 0;
    this.callbacks = {};
    this.worker = new Worker("portlets/console-worker.js");

    this.worker.onmessage = function(ev) {
      var data = ev.data;
      var type = data.type;
      if(type == 'response') {
        var cb = self.callbacks[data.id];
        if(cb) {
          delete self.callbacks[data.id];
          cb(data);
        }
      } else if(type == 'rome') {
        gs.sendRome(data.name, data.params);
      } else if(type == 'log') {
        console.log(data.data);  // for debug
      }
    };

    this.worker.send = function(method, params, cb) {
      var id = self.request_id++;
      self.callbacks[id] = cb;
      this.postMessage({ id: id, method: method, params: params });
    };

    $(document).on('rome-messages', function(ev, messages) {
      self.worker.send('messages', { messages: messages }, null);
    });
    gs.callMethod('rome_messages', {});

    // init HTML
    this.node.css('width', '300px');
    this.node.css('height', '200px');
    this.node.resizable({ containment: 'parent', minWidth: 100, minHeight: 40 });

    this.input = $(this.content.children('input')[0]);
    this.backlog = $(this.content.find('div.portlet-code')[0]);
    this.history = [];
    this.history_index = 0;
    this.history_last = null;
    this.history_size = 200;

    this.input.keydown(function(ev) {
      if(ev.keyCode == 13) {
        // enter: validate input
        var text = self.input.val();
        if(text != "") {
          self.validateInput(text);
          if(text != self.history[self.history.length-1]) {
            self.history.push(text);
            if(self.history.length > self.history_size) {
              self.history.pop();
            }
          }
          self.history_index = self.history.length;
          self.input.val("");
        }
        ev.stopPropagation();

      } else if(ev.keyCode == 38) {
        // up: previous history entry
        if(self.history_index == self.history.length) {
          self.history_last = self.input.val();
        }
        if(self.history_index > 0) {
          self.input.val(self.history[--self.history_index]);
        }
      } else if(ev.keyCode == 40) {
        // down: next history entry
        if(self.history_index == self.history.length) {
          // nothing to do
        } else {
          if(++self.history_index == self.history.length) {
            self.input.val(self.history_last);
          } else {
            self.input.val(self.history[self.history_index]);
          }
        }
      }
    });

    $(document).on('ws-log', function(ev, sev, msg) {
      var entry = $('<div class="portlet-console-entry" />').appendTo(self.backlog);
      entry.addClass('log-'+sev).append(msg);
    });

    // create the clean icon
    $('<i class="fa fa-trash-o" />').prependTo(this.header).click(function() {
      self.backlog.empty();
    });
  },

  update: function(data) {
    // nothing to do
  },

  validateInput: function(text) {
    var backlog = this.backlog;
    var entry = $('<div class="portlet-console-entry" />').appendTo(backlog);
    $('<div class="portlet-console-input" />').append(text).appendTo(entry);
    backlog.scrollTop(backlog[0].scrollHeight);
    this.worker.send('eval', {code: text}, function(ev) {
      var out = $('<div class="portlet-console-output" />').appendTo(entry);
      if(ev.error) {
        out.addClass('log-error').append(ev.error);
      } else {
        out.append("=> "+ev.data);
      }
      backlog.scrollTop(backlog[0].scrollHeight);
    });
  },

});

