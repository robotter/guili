
Portlet.register('detection', 'Detection', class extends Portlet {

  async init(options) {
    await super.init(options);
    this.node.style.width = '400px';
    $(this.node).resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    this.detections = new Map();

    // wait for the SVG document to be loaded before using it
    await new Promise((resolve, reject) => {
      const object = this.content.querySelector('object');
      object.onload = () => {
        this.field = object.getSVGDocument().getElementById('drawing');
        // explicitely initialize object height, webkit does not compute it
        // according to SVG viewBox ratio
        const viewBox = this.field.viewBox.baseVal;
        this.node.style.height = (this.node.clientWidth * viewBox.height / viewBox.width) + 'px';

        gs.robots.forEach(r => { this.detections[r] = []; });

        this.bindFrame(null, 'r3d2_tm_detection', this.updateDetections);
        this.bindFrame(null, 'r3d2_tm_arcs', this.updateArcs);
        resolve();
      }
    });
  }

  addDetection(robot) {
    const d = {};

    let irobot = gs.robots.indexOf(robot);
    if(irobot < 0 || irobot > 1) {
      irobot = 1;
    }

    const ref_frame = this.field.getElementById('reference-frame');
    const txt_frame = this.field.getElementById('coords-frame-' + irobot);

    // add container SVG object
    d.svg = this.field.createElement('g');
    ref_frame.appendChild(d.svg);

    // add "ping" SVG object
    d.ping = this.field.createElement('circle');
    d.ping.setAttributes({
      'class': 'ping-' + irobot,
      'cx': '100', 'cy': '0', 'r': '4',
    });
    d.svg.appendChild(d.ping);

    // add arc SVG objects (two lines)
    ['arc1', 'arc2'].forEach((name) => {
      const arc = this.field.createElement('line');
      arc.setAttributes({
        'class': 'arc arc-'+irobot,
        'x1': '0', 'y1': '0',
      });
      d.svg.appendChild(arc);
      d[name] = arc;
    });

    const detections = this.detections[robot];

    // add texts for coordinates
    d.txt_r = this.field.createElement('text');
    d.txt_r.setAttributes({
      'x': 0, 'y': 18 * detections.length,
      'text-align': 'right', 'text-anchor': 'end',
      'font-size': 15,
      'class': 'ping-'+irobot,
    });
    d.txt_r.textContent = '?'
    txt_frame.appendChild(d.txt_r);
    d.txt_a = this.field.createElement('text');
    d.txt_a.setAttributes({
      'x': 60, 'y': 18 * detections.length,
      'text-align': 'right', 'text-anchor': 'end',
      'font-size': 15,
      'class': 'ping-'+irobot,
    });
    d.txt_a.textContent = '?'
    txt_frame.appendChild(d.txt_a);

    detections.push(d);
    return d;
  }

  updateDetections(robot, params) {
    let d = this.detections[robot][params.i];
    if(d === undefined) {
      d = this.addDetection(robot);
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

    let r = params.r/10.0;
    let radius;
    if(params.r < 0) {
      radius = 40;
      r = 175;
    }
    else {
      radius = 4;
    }

    const x = -r*Math.cos(params.a);
    const y = r*Math.sin(params.a);

    d.ping.setAttributes({
      'r':radius,
      'cx':x,
      'cy':y,
    });
  }

  updateArcs(robot, params) {
    let d = this.detections[robot][params.i];
    if(d === undefined) {
      d = this.addDetection(robot);
    }

    let x,y,r = 200;
    x = -r*Math.cos(params.a1);
    y = r*Math.sin(params.a1);
    d.arc1.setAttributes({'x2':x, 'y2':y});
    x = -r*Math.cos(params.a2);
    y = r*Math.sin(params.a2);
    d.arc2.setAttributes({'x2':x, 'y2':y});
  }

});


