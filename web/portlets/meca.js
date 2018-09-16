
Portlet.register('meca', 'Meca', class extends Portlet {

  async init(options) {
    await super.init(options);
    this.node.style.width = '200px';
    this.enableResize({ min_w: 100, ratio: true });

    // wait for the SVG document to be loaded before using it
    await new Promise((resolve, reject) => {
      const object = this.content.querySelector('object');
      object.onload = () => {
        const svg = object.getSVGDocument()
        this.cylinder = svg.getElementById('cylinder');
        this.state = svg.getElementById('state')
        this.emptying_move = svg.getElementById('emptying_move')
        this.rotate_cylinder = svg.getElementById('rotate-cylinder')
        this.last_angle = 0;

        this.bindFrame(null, 'meca_tm_cylinder_state', (frame) => {
          for(const [i, color] of frame.params.color) {
            svg.getElementById('slot-'+i).setAttribute('class', 'slot color-'+color);
          }
        });
        this.bindFrame(null, 'meca_tm_cylinder_position', (frame) => {
          const angle = frame.params.a * 180 / Math.PI;
          if(angle == this.last_angle) {
            return;
          }
          const da = Math.abs(angle - this.last_angle);
          this.rotate_cylinder.setAttribute('from', this.last_angle);
          this.rotate_cylinder.setAttribute('dur', (da / 300)+'s');
          this.rotate_cylinder.setAttribute('to', angle);
          this.rotate_cylinder.beginElement();
          this.last_angle = angle;
        });
        this.bindFrame(null, 'meca_tm_state', (frame) => {
          this.state.setAttribute('class', frame.params.state);
        });
        this.bindFrame(null, 'meca_tm_optimal_emptying_move', (frame) => {
          this.emptying_move.setAttribute('class', frame.params.move);
        });
        resolve();
      }
    });
  }
});

