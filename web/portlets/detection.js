Portlet.register({
  name: 'detection',
  pretty_name: 'Detection',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '400px');
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

      self.detections = {};
      gs.robots.forEach(function(robot) {
        self.detections[robot] = [];
      });
      self.field = field;

      self.bindFrame(null, 'r3d2_tm_detection', self.updateDetections);
      self.bindFrame(null, 'r3d2_tm_arcs', self.updateArcs);
      df.resolve();
    };

    return df.promise();
  },

  addDetection: function(robot) {
    var self = this;
    var d = {};
    var ref_frame = self.field.getElementById('reference-frame');
    var txt_frame = self.field.getElementById('coords-frame');


    // add container SVG object
    d.svg = this.field.createElement('g');
    ref_frame.appendChild(d.svg);

    // add "ping" SVG object
    d.ping = this.field.createElement('circle');
    d.ping.setAttributes({
      'class': 'ping-red',
      'cx': '100', 'cy': '0', 'r': '4',
    });
    d.svg.appendChild(d.ping);

    // add arc SVG objects (two lines)
    ['arc1', 'arc2'].forEach(function(name) {
      var arc = self.field.createElement('line');
      arc.setAttributes({
        'class': 'arc',
        'x1': '0', 'y1': '0',
      });
      d.svg.appendChild(arc);
      d[name] = arc;
    });

    var detections = this.detections[robot];

    // add texts for coordinates
    d.txt_r = this.field.createElement('text');
    d.txt_r.setAttributes({
      'x': 0, 'y': 18 * detections.length,
      'text-align': 'right', 'text-anchor': 'end',
      'font-size': 15, 'fill': 'red',
    });
    d.txt_r.textContent = '?'
    txt_frame.appendChild(d.txt_r);
    d.txt_a = this.field.createElement('text');
    d.txt_a.setAttributes({
      'x': 60, 'y': 18 * detections.length,
      'text-align': 'right', 'text-anchor': 'end',
      'font-size': 15, 'fill': 'red',
    });
    d.txt_a.textContent = '?'
    txt_frame.appendChild(d.txt_a);

    detections.push(d);
    return d;
  },

  updateDetections: function(robot, params) {
    var d = this.detections[robot][params.i];
    if(d === undefined) {
      d = this.addDetection();
    }
    if(params.detected) {
      d.svg.setAttribute('opacity', 1);
      d.txt_r.textContent = params.r.toFixedHtml(0);
      d.txt_a.textContent = params.a.toFixedHtml(2);
    } else {
      d.svg.setAttribute('opacity', 0);
      d.txt_r.textContent = '';
      d.txt_a.textContent = '';
      return;
    }

    var r = params.r/10.0;
    var radius;
    if(params.r < 0) {
      radius = 40;
      r = 175;
    }
    else {
      radius = 4;
    }

    var x = -r*Math.cos(params.a);
    var y = r*Math.sin(params.a);

    d.ping.setAttributes({
      'r':radius,
      'cx':x,
      'cy':y,
    });
  },

  updateArcs: function(robot, params) {
    var d = this.detections[robot][params.i];
    if(d === undefined) {
      d = this.addDetection();
    }

    var x,y,r = 200;
    x = -r*Math.cos(params.a1);
    y = r*Math.sin(params.a1);
    d.arc1.setAttributes({'x2':x, 'y2':y});
    x = -r*Math.cos(params.a2);
    y = r*Math.sin(params.a2);
    d.arc2.setAttributes({'x2':x, 'y2':y});
  },

});


