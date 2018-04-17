Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    var barillet = document.getElementById("barillet");

    // wait for the SVG document to be loaded before using it
    var self = this;
    var df = $.Deferred();
    var object = this.content.children('object')[0];
    object.onload = function() {
      self.barillet = object.getSVGDocument().getElementById('barillet');

      self.bindFrame(null, 'meca_tm_state', function(robot, params) {
        //TODO
      });
      self.bindFrame(null, 'meca_tm_cylinder_state', function(robot, params) {
        //TODO
      });
    };

    return df.promise();
  },
});

