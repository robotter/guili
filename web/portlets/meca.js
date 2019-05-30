
Portlet.register('meca', 'Meca', class extends Portlet {

  async init(options) {
    await super.init(options);

    var state_to_color = {
      busy: 'red',
      ready: 'green',
      ground_clear: 'orange',
    };

    this.bindFrame(null, 'meca_tm_state', (frame) => {
      const td = this.content.querySelector('td');
      td.firstChild.style.color = state_to_color[frame.params.state];
      console.log(td.firstChild.style.color);
    });

    this.bindFrame(null, 'meca_tm_arms_state', (frame) => {
      const params = frame.params;
      const tds = this.content.querySelectorAll('td');

      tds[1].textContent = params.l_pos < 0 ? '✗' : params.l_pos.toFixedHtml(0);
      for(var i = 0; i < 3; i++) {
        tds[2+i].firstChild.style.color = params.l_atoms[i] ? 'black' : 'gray';
      }

      tds[5].textContent = params.r_pos < 0 ? '?' : params.r_pos.toFixedHtml(0);
      for(var i = 0; i < 3; i++) {
        tds[6+i].firstChild.style.color = params.r_atoms[i] ? 'black' : 'gray';
      }
    });
  }
});

