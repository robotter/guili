
/*
 * Menu opened by clicking on an element
 *
 * button -- jQuery object used to show/hide the menu
 * opts -- menu widget option object
 */

(function($) {
  $.fn.clickMenu = function(button, opts) {
    var self = this;
    this.addClass('clickmenu');

    var hide_handler = function() {
      self.hide();
      $(this).unbind('click', hide_handler);
    };

    opts = $.extend({}, opts); // clone
    var select = opts.select;
    opts.select = function(ev, ui) {
      if(select) {
        select(ev, ui);
      }
      $(this).unbind('click', hide_handler);
    }
    var menu = this.menu(opts);
    menu.hide();

    button.click(function(ev) {
      self.toggle();
      if(self.is(":visible")) {
        $(document).bind('click', hide_handler);
      } else {
        $(document).unbind('click', hide_handler);
      }
      ev.stopPropagation();
    });

    return menu;
  };
}(jQuery));

