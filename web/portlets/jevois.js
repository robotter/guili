
Portlet.register('jevois', 'JeVois', class extends Portlet {

  async init(options) {
    await super.init(options);

    var object_to_color = {
      none: 'white',
      blue: 'blue',
      gold: 'gray',
      red: 'red',
      green: 'green',
    };


    this.bindFrame(null, 'jevois_tm_objects', (frame) => {
      const params = frame.params;
      const tds = this.content.querySelectorAll('td');
      tds[0].firstChild.style.color = object_to_color[params.object_color];
      tds[1].textContent = params.x;
      tds[2].textContent = params.y;
      tds[3].textContent = params.z;
    });
  }
});

