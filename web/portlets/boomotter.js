
Portlet.register('boomotter', 'Boomotter', class extends Portlet {

  async init(options) {
    await super.init(options);
    this.enableResize({ min_w: 100 });

    const select_mode = this.content.querySelector('select.boomotter-mode');
    const submit_button = this.content.querySelector('button.boomotter-submit');

    const modes = [
      //TODO retrieve values from enum definition
      'match',
      'music',
      'silent',
      'nyancat',
      'loituma',
    ];
    for(const v of modes) {
      select_mode.appendChild(createElementFromHtml(`<option value="${v}">${v}</option>`));
    }

    select_mode.addEventListener('change', () => {
      gs.robots.forEach(r => {
        if(normalizeRobotName(r) == 'boomotter') {
          gs.sendRomeMessage(r, 'boomotter_set_mode', {mode: select_mode.value});
        }
      });
    });

    submit_button.addEventListener('click', () => {
      const volume = this.content.querySelector('.boomotter-volume').value;
      gs.robots.forEach(r => {
        if(normalizeRobotName(r) == 'boomotter') {
          gs.sendRomeMessage(r, 'boomotter_mp3_cmd', {cmd: 6, param: volume});
        }
      });
    });
  }

});

