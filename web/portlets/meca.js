Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    var cylinder = document.getElementById("cylinder");

    // wait for the SVG document to be loaded before using it
    var self = this;
    var df = $.Deferred();
    var object = this.content.children('object')[0];
    object.onload = function() {
      self.cylinder = object.getSVGDocument().getElementById('cylinder');

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

