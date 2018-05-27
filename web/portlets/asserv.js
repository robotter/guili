
Portlet.register('asserv', 'Asserv', class extends Portlet {

  async init(options) {
    await super.init(options);
    this.setRobotViewMenu(gs.robots, this.setRobot.bind(this));
    this.setRobot(options.robot ? options.robot : gs.robots[0]);

    gevents.addHandlerFor(this, 'field-point-xy', (x, y) => {
      const tds = this.content.querySelectorAll('td');
      tds[6].textContent = x.toFixedHtml(0);
      tds[7].textContent = y.toFixedHtml(0);
    });
  }

  setRobot(robot) {
    this.unbindFrame();
    this.robot = robot;
    if(robot) {
      this.content.querySelector('div.portlet-title').textContent = "Asserv › "+robot;
    }

    this.bindFrame(robot, 'asserv_tm_xya', (robot, params) => {
      const tds = this.content.querySelectorAll('td');
      tds[0].textContent = params.x.toFixedHtml(0);
      tds[1].textContent = params.y.toFixedHtml(0);
      tds[2].textContent = params.a.toFixedHtml(2);
    });
    this.bindFrame(robot, 'asserv_tm_htraj_carrot_xy', (robot, params) => {
      const tds = this.content.querySelectorAll('td');
      tds[3].textContent = params.x.toFixedHtml(0);
      tds[4].textContent = params.y.toFixedHtml(0);
    });
    this.bindFrame(robot, 'asserv_tm_htraj_done', (robot, params) => {
      const tds = this.content.querySelectorAll('td');
      tds[0].classList.toggle('portlet-asserv-done', params.xy);
      tds[1].classList.toggle('portlet-asserv-done', params.xy);
      tds[2].classList.toggle('portlet-asserv-done', params.a);
    });
    this.bindFrame(robot, 'asserv_tm_htraj_path_index', (robot, params) => {
      const tds = this.content.querySelectorAll('td');
      tds[5].textContent = params.i + " / " + params.size;
    });
    this.bindFrame(robot, 'tm_match_timer', (robot, params) => {
      const tds = this.content.querySelectorAll('td');
      tds[8].textContent = params.seconds + 's';
    });
  }

  getOptions() {
    return Object.assign(super.getOptions(), {
      robot: this.robot,
    });
  }

});

