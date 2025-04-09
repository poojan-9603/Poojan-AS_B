var ENABLE_NETWORK_LOGGING = true; 
var ENABLE_CONSOLE_LOGGING = true; 
var LOG_VERSION = 'B';             

var EVENT_TYPES_TO_LOG = {
  mousedown: true,
  keydown: true
};

var EVENT_PROPERTIES_TO_LOG = {
  which: true,
  pageX: true,
  pageY: true,
  key: true,
  code: true
};

var GLOBAL_STATE_TO_LOG = function() {
  return {
    keyInputs: window.keyInputCount || 0,
    mouseInputs: window.mouseInputCount || 0,
    errors: window.errorCount || 0
  };
};

(function() {

var uid = getUniqueId();

function hookEventsToLog() {

  for (var event_type in EVENT_TYPES_TO_LOG) {
    document.addEventListener(event_type, logEvent, true);
  }

  $(function() {
    console.log('Your unique id is', uid);
    $('#bottomtext').html('Logging to the network as <nobr>' + uid + '</nobr>')
  });

  $(document).on('log', logEvent);
}

function elementDesc(elt) {
  if (elt == document) {
    return 'document';
  } else if (elt == window) {
    return 'window';
  }
  function descArray(elt) {
    var desc = [elt.tagName.toLowerCase()];
    if (elt.id) {
      desc.push('#' + elt.id);
    }
    for (var j = 0; j < elt.classList.length; j++) {
      desc.push('.' + elt.classList[j]);
    }
    return desc;
  }
  var desc = [];
  while (elt && desc.length <= 1) {
    var desc2 = descArray(elt);
    if (desc.length == 0) {
      desc = desc2;
    } else if (desc2.length > 1) {
      desc2.push(' ', desc[0]);
      desc = desc2;
    }
    elt = elt.parentElement;
  }
  return desc.join('');
}

function findFirstString(str, choices) {
  for (var j = 0; j < choices.length; j++) {
    if (str.indexOf(choices[j]) >= 0) {
      return choices[j];
    }
  }
  return '?';
}

function getUniqueId() {
  if (!('uid' in localStorage)) {
    var browser = findFirstString(navigator.userAgent, [
      'Seamonkey', 'Firefox', 'Chromium', 'Chrome', 'Safari', 'OPR', 'Opera',
      'Edge', 'MSIE', 'Blink', 'Webkit', 'Gecko', 'Trident', 'Mozilla']);
    var os = findFirstString(navigator.userAgent, [
      'Android', 'iOS', 'Symbian', 'Blackberry', 'Windows Phone', 'Windows',
      'OS X', 'Linux', 'iOS', 'CrOS']).replace(/ /g, '_');
    var unique = ('' + Math.random()).substr(2);
    localStorage['uid'] = os + '-' + browser + '-' + unique;
  }
  return localStorage['uid'];
}

function logEvent(event, customName, customInfo) {
  var time = (new Date).getTime();
  var name = customName || event.type;

  var infoObj = GLOBAL_STATE_TO_LOG();

  for (var key in EVENT_PROPERTIES_TO_LOG) {
    if (key in event) {
      infoObj[key] = event[key];
    }
  }

  if (customInfo) {
    $.extend(infoObj, customInfo);
  }
  var info = JSON.stringify(infoObj);
  var target = elementDesc(event.target);
  var state = location.hash;

  if (ENABLE_CONSOLE_LOGGING) {
    console.log(uid, time, name, target, info, state, LOG_VERSION);
  }
  if (ENABLE_NETWORK_LOGGING) {
    sendNetworkLog(uid, time, name, target, info, state, LOG_VERSION);
  }
}

if (ENABLE_NETWORK_LOGGING) {
  hookEventsToLog();
}

})();

function sendNetworkLog(
    uid,
    time,
    name,
    target,
    info,
    state,
    version) {

  var formid = "e/1FAIpQLScblSF52Q4qW-WYZzEwbzOewrun2qxeD8kIXtJUQPGQwQqCYQ";

  var data = {
    "entry.495562003": uid,
    "entry.2026310043": time,
    "entry.1497685527": name,
    "entry.1319202593": target,
    "entry.935175275": info,
    "entry.351493819": state,
    "entry.1168984780": version
  };
  var params = [];
  for (key in data) {
    params.push(key + "=" + encodeURIComponent(data[key]));
  }

  console.log("Sending log data to form:", formid);

  (new Image).src = "https://docs.google.com/forms/d/" + formid +
     "/formResponse?" + params.join("&");
}