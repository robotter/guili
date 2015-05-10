
Portlet.register({
  name: 'logs',
  pretty_name: 'Logs',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    var self = this;

    // init HTML
    this.node.css('width', '300px');
    this.node.css('height', '200px');
    this.node.resizable({ containment: 'parent', minWidth: 100, minHeight: 40 });

    this.backlog = $(this.content.find('div.portlet-code')[0]);
    this.backlog_size = options.backlog_size ? options.backlog_size : 5000;

    this.bindFrame('log', function(params) {
      var entry = $('<div class="portlet-logs-entry" />').appendTo(self.backlog);
      var date = new Date();
      var str_date = ("0"+date.getHours()).slice(-2) +
        ':' + ("0"+date.getMinutes()).slice(-2) +
        ':' + ("0"+date.getSeconds()).slice(-2) +
        '.' + ("00"+date.getMilliseconds()).slice(-3);
      entry.append('<span class="log-date">'+str_date+'</span><span class="log-msg">'+params.msg+'</span>');
      entry.addClass('log-'+params.sev);

      var nremove = self.backlog.children().length - self.backlog_size;
      if(nremove > 0) {
        self.backlog.children(':lt('+nremove+')').remove();
      }
      self.backlog.scrollTop(self.backlog[0].scrollHeight);
    });

    // create the clean icon
    $('<i class="fa fa-trash-o" />').prependTo(this.header).click(function() {
      self.backlog.empty();
    });
  },

});

