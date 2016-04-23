/*
 * Web worker for console portlet
 */

(function(self, myeval) {
  "use strict";

  // copy some global variables to local scope
  // global scope will be cleaned afterwards
  var postMessage = self.postMessage;

  // for debug
  var log = function(data) { postMessage({ method: 'log', data: data }); };

  // pack positional message parameters into an object
  var packRomeParams = function(msg, args) {
    var ptypes = msg.ptypes
    var nargs = args.length;
    var kw;
    if(args[nargs-1] instanceof Object && !args[nargs-1] instanceof Array) {
      // last parameter contains keyword parameters
      kw = args[--nargs];
    }

    var params = {};
    // pack positional arguments
    if(nargs > ptypes.length) {
      throw "invalid parameter count";
    }
    for(var i=0; i<nargs; i++) {
      var v = args[i];
      if(v === undefined || v === null) {
        continue;
      }
      params[ptypes[i][0]] = v;
    }
    // pack keyword arguments
    if(kw !== undefined) {
      for(var k in kw) {
        var v = kw[k];
        if(v === undefined || v === null) {
          continue;
        } else if(params[k] !== undefined) {
          throw "parameter "+k+" set twice";
        } else if(!k in msg.name2type) {
          throw "unknown parameter: "+k;
        }
        params[k] = v;
      }
    }

    if(Object.keys(params).length != ptypes.length) {
      throw "invalid parameter count";
    }
    return params
  };

  // pretty-print response data
  var stringify = function(o) {
    switch(typeof(o)) {
      case 'undefined': return 'undefined';
      case 'boolean':
      case 'number':
        return o.toString();
      case 'string': return '"'+o.replace(/["\\]/g, '\\$&')+'"';
      case 'function': return 'function '+(o.name||'')+'()';
      case 'object':
        if(o === null) {
          return 'null';
        } else if(o instanceof Array) {
          return '['+o.map(stringify).join(', ')+']';
        } else {
          return '{'+Object.keys(o).map(function(k){ return String(k)+': '+stringify(o[k]); }).join(', ')+'}';
        }
      default: return String(o);
    }
  };

  var message_handler = function(ev) {
    var request = ev.data;
    var method = request.method;

    var response = { method: 'response', id: request.id };
    try {
      if(method == 'eval') {
        // evaluate an expression
        response.data = stringify(myeval(request.code));

      } else if(method == 'scope') {
        // add values to worker scope
        for(var k in request.scope) {
          self[k] = request.scope[k];
        }

      } else if(method == 'complete') {
        // autocomplete the given dotted variable
        // return a list of suggestions
        var v = self;
        var words = request.variable.split('.');
        var last = words.pop();
        for(var i; i<words.length; i++) {
          v = self[words[k]];
          if(! v instanceof Object) {
            break;
          }
        }
        if(v instanceof Object) {
          response.data = Object.keys(v).filter(function(k) {
            return k.substring(0, last.length) == last;
          });
          response.data.sort();
        } else {
          response.data = [];
        }

      } else if(method == 'messages') {
        // defined ROME messages
        if(self.rome instanceof Object) {
          // delete existing variables
          for(var k in self.rome) {
            if(self.rome[k] === self[k]) {
              delete self[k];
            }
          }
        }
        // define new ones
        self.rome = {};
        request.robots.forEach(function(robot) {
          self[robot] = {};
        });
        for(var k in request.messages) {
          (function() {
            var name = k;
            var ptypes = request.messages[k];
            var msg = { name: k, ptypes: ptypes, name2type: {} };
            for(var i=0; i<ptypes.length; i++) {
              var p = ptypes[i];
              msg.name2type[p[0]] = p[1];
            }
            var f = function() {
              var args = Array.from(arguments);
              var robot = args.shift();
              postMessage({ method: 'rome', robot: robot, name: name, params: packRomeParams(msg, args) });
            };
            self.rome[k] = f.bind(null, null);
            request.robots.forEach(function(robot) {
              self[robot][k] = f.bind(null, robot);
            });
            if(self[k] === undefined) {
              self[k] = self.rome[k];
            }
          })();
        }

      } else {
        response.error = "unknown console worker method";
      }
    } catch(e) {
      response.error = String(e);
    }
    postMessage(response);
  };

  // use addEventListener to avoid defining "onmessage" in the global scope
  self.addEventListener('message', message_handler, false);

  // predefine some variables
  self.rome = {};

  // clean the global scope
  self.Worker =
  self.postMessage =
  self.addEventListener =
  self.removeEventListener =
  self.importScripts =
  self.XMLHttpRequest =
  undefined;

}(self, eval));

