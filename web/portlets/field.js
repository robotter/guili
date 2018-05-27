
Portlet.register('field', 'Field', class extends Portlet {

  async init(options) {
    await super.init(options);
    this.node.style.width = '200px';
    $(this.node).resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    this.svg_robots = {};
    this.svg_carrots = {};
    this.pathfindings = {};

    // wait for the SVG document to be loaded before using it
    await new Promise((resolve, reject) => {
      const object = this.content.querySelector('object');
      object.onload = () => {
        this.field = object.getSVGDocument().getElementById('drawing');
        // explicitely initialize object height, webkit does not compute it
        // according to SVG viewBox ratio
        const viewBox = this.field.viewBox.baseVal;
        this.node.style.height = (this.node.clientWidth * viewBox.height / viewBox.width) + 'px';
        this.frame = this.field.getElementById('reference-frame');

        // create SVG robots and carrots
        this.initSvgElements(gs.robots);

        // send event when clicking on field
        this.field.addEventListener('mousedown', (ev) => {
          // get drawing position from mouse position
          let pos = this.field.createSVGPoint();
          pos.x = ev.clientX;
          pos.y = ev.clientY;
          pos = pos.matrixTransform(this.frame.getScreenCTM().inverse());
          // send event
          gevents.trigger('field-point-xy', pos.x, pos.y);
        });

        this.bindFrame(null, 'asserv_tm_xya', this.updatePosition);
        this.bindFrame(null, 'asserv_tm_htraj_carrot_xy', (robot, params) => {
          this.svg_carrots[robot].setAttributes({x: params.x, y: params.y});
        });

        this.bindFrame(null, 'pathfinding_node', (robot, params) => {
          const pf = this.pathfindings[robot];
          // remove node and vertices, if any
          pf.svg_nodes.querySelector('.graph-node-'+params.i).remove();
          pf.svg_vertices.querySelector('.graph-vertex-'+params.i).remove();
          // create new node
          const node = this.field.createElement('circle');
          node.setAttributes({
            'r': 25, 'cx': params.x, 'cy': params.y,
            'class': 'graph-node graph-node-'+params.i,
          });
          pf.svg_nodes.appendChild(node);
          // create vertices
          params.neighbors.forEach(n => {
            const node2 = pf.svg_nodes.querySelector('.graph-node-'+n);
            if(!node2) {
              return;
            }
            const vertex = this.field.createElement('line');
            vertex.setAttributes({
              'class': `graph-vertex graph-vertex-${params.i} graph-vertex-${n}`,
              'x1': params.x, 'y1': params.y,
              'x2': node2.getAttribute('cx'), 'y2': node2.getAttribute('cy'),
            });
            pf.svg_vertices.appendChild(vertex);
          });
        });

        this.bindFrame(null, 'pathfinding_path', (robot, params) => {
          const pf = this.pathfindings[robot];
          pf.svg.querySelectorAll('.active').forEach(o => { o.classList.remove('active') });
          pf.svg_nodes.querySelectorAll('.start').forEach(o => { o.classList.remove('start') });
          pf.svg_nodes.querySelectorAll('.goal').forEach(o => { o.classList.remove('goal') });
          for(const [i, node1] of params.nodes.entries()) {
            pf.svg_nodes.querySelector('.graph-node-'+node1).classList.add('active');
            if(i > 0) {
              const node2 = params.nodes[i-1];
              pf.svg_vertices.querySelector(`.graph-vertex-${node1}.graph-vertex-${node2}`).classList.add('active');
            }
          }
          pf.svg_nodes.querySelector('.graph-node-'+params.nodes[0]).classList.add('start');
          pf.svg_nodes.querySelector('.graph-node-'+params.nodes[params.nodes.length-1]).classList.add('goal');
        });

        resolve();
      };
    });
  }

  initSvgElements(robots) {
    // remove existing elements
    for(const o of Object.values(this.svg_robots)) o.remove();
    for(const o of Object.values(this.svg_carrots)) o.remove();
    for(const o of Object.values(this.pathfindings)) o.remove();

    robots.forEach((robot, irobot) => {
      // create SVG robot
      const svg_robot = this.field.createElement('use');
      const svg_name = normalizeRobotName(robot, irobot);
      if(svg_name != 'galipeur' && svg_name != 'galipette') {
        return;
      }

      svg_robot.setAttributes({
        'xlink:href': '#def-' + svg_name,
        'class': svg_name,
      });
      this.frame.appendChild(svg_robot);

      // create SVG carrot
      const svg_carrot = this.field.createElement('use');
      svg_carrot.setAttributes({
        'xlink:href': '#def-carrot',
        'class': svg_name,
      });
      this.frame.appendChild(svg_carrot);

      // create SVG pathfindings (prepare groups)
      const pathfinding = {
        svg: this.field.createElement('g'),
        svg_vertices: this.field.createElement('g'),
        svg_nodes: this.field.createElement('g'),
      };
      this.frame.appendChild(pathfinding.svg);
      pathfinding.svg.appendChild(pathfinding.svg_vertices);
      pathfinding.svg.appendChild(pathfinding.svg_nodes);

      this.svg_robots[robot] = svg_robot;
      this.svg_carrots[robot] = svg_carrot;
      this.pathfindings[robot] = pathfinding;
    });
  }

  updatePosition(robot, params) {
    const a = params.a * 180 / Math.PI;
    this.svg_robots[robot].setAttributes({
      'transform': `translate(${params.x},${params.y}) rotate(${a})`,
    });
  }

});

