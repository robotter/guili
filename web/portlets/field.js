
Portlet.register({
  name: 'field',
  pretty_name: 'Field',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });

    // wait for the SVG document to be loaded before using it
    var self = this;
    var df = $.Deferred();
    var object = this.content.children('object')[0];
    object.onload = function() {
      var field = object.getSVGDocument().getElementById('drawing');
      // explicitely initialize object height, webkit does not compute it
      // according to SVG viewBox ratio
      var viewBox = field.viewBox.baseVal;
      self.node.height(self.node.width() * viewBox.height / viewBox.width);
      var frame = field.getElementById('reference-frame');

      // create SVG robot
      var svg_robot = field.createElement('use');
      svg_robot.setAttributes({
        'id': 'galipeur',
        'xlink:href': '#def-galipeur',
      });
      frame.appendChild(svg_robot);

      // create SVG carrot
      var svg_carrot = field.createElement('use');
      svg_carrot.setAttributes({
        'id': 'carrot',
        'xlink:href': '#def-carrot',
      });
      frame.appendChild(svg_carrot);

      // send event when clicking on field
      $(field).on('mousedown', function(ev) {
        // get drawing position from mouse position
        var pos = field.createSVGPoint();
        pos.x = ev.clientX;
        pos.y = ev.clientY;
        pos = pos.matrixTransform(frame.getScreenCTM().inverse());
        // send event
        $.event.trigger('field-point-xy', [pos.x, pos.y]);
      });

      // set portlet properties
      self.field = field;
      self.frame = frame;
      self.svg_robot = svg_robot;
      self.svg_carrot = svg_carrot;

      self.bindFrame('asserv_tm_xya', self.updatePosition);
      self.bindFrame('asserv_tm_htraj_carrot_xy', function(params) {
        self.svg_carrot.setAttributes({x: params.x, y: params.y});
      });

      df.resolve();
    };

    return df.promise();
  },

  updatePosition: function(params) {
    this.svg_robot.setAttributes({
      'transform': "translate("+params.x+","+params.y+") rotate("+(params.a*180/Math.PI)+")",
    });
  },

});


