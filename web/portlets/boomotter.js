
Portlet.register({
  name: 'boomotter',
  pretty_name: 'Boomotter',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.resizable({ containment: 'parent', minWidth: 100 });

    var select_mode = this.content.find('select.boomotter-mode');
    var submit_button = this.content.find('button.boomotter-submit')

    var modes = [
      //TODO retrieve values from enum definition
      'match',
      'music',
      'silent',
      'nyancat',
      'loituma',
    ];
    modes.forEach(function(v) {
      $('<option value="' + v + '">' + v + '</option>').appendTo(select_mode);
    });

    var self = this;

    select_mode.on('change', function() {
      gs.robots.forEach(function(r) {
        if(normalizeRobotName(r) == 'boomotter') {
          gs.sendRomeMessage(r, 'boomotter_set_mode', {mode: select_mode.val()});
        }
      });
    });

    submit_button.on('click', function() {
      var volume = self.content.find('.boomotter-volume').val();
      gs.robots.forEach(function(r) {
        if(normalizeRobotName(r) == 'boomotter') {
          gs.sendRomeMessage(r, 'boomotter_mp3_cmd', {cmd: 6, param: volume});
        }
      });
    });
  },

});

