
Portlet.register({
  name: 'field',
  pretty_name: 'Field',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    this.svg_robots = {};
    this.svg_carrots = {};

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

      // set portlet properties
      self.field = field;
      self.frame = frame;

      // create SVG robots and carrots
      self.initSvgElements(gs.robots);

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

      self.bindFrame(null, 'asserv_tm_xya', self.updatePosition);
      self.bindFrame(null, 'asserv_tm_htraj_carrot_xy', function(robot, params) {
        self.svg_carrots[robot].setAttributes({x: params.x, y: params.y});
      });

      df.resolve();
    };
  },

  initSvgElements: function(robots) {
    // remove existing elements
    for(var robot in this.svg_robots) {
      this.frame.removeChild(this.svg_robots[robot]);
    }
    for(var robot in this.svg_carrots) {
      this.frame.removeChild(this.svg_carrots[robot]);
    }

    var self = this;
    robots.forEach(function(robot) {
      // create SVG robot
      var svg_robot = self.field.createElement('use');
      svg_robot.setAttributes({
        'xlink:href': '#def-galipeur',
      });
      self.frame.appendChild(svg_robot);

      // create SVG carrot
      var svg_carrot = self.field.createElement('use');
      svg_carrot.setAttributes({
        'xlink:href': '#def-carrot',
      });
      self.frame.appendChild(svg_carrot);

      self.svg_robots[robot] = svg_robot;
      self.svg_carrots[robot] = svg_carrot;
    });
  },

  updatePosition: function(robot, params) {
    this.svg_robots[robot].setAttributes({
      'transform': "translate("+params.x+","+params.y+") rotate("+(params.a*180/Math.PI)+")",
    });
  },

});


