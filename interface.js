Sudoku.init(2);

var DISABLE_CONTEXTMENU = false; 
var USE_LOCAL_STORAGE = true;    
var SYMMETRIC_PUZZLES = false;   

var starttime = (new Date).getTime();  
var runningtime = false;               
var visiblefocus = null;               
var curnumber = null;                  

window.keyInputCount = 0;
window.mouseInputCount = 0;
window.errorCount = 0;

$(function() {
  var sinit;
  setup_screen();
  if (window.location.hash && (sinit = currentstate()).seed) {
    starttime = (new Date).getTime() - sinit.elapsed;
    $(document).trigger('log', ['linkgame', {seed: sinit.seed}]);
    saveseed(sinit.seed);
  } else {
    setupgame(0);
  }
  redraw();
  $(window).bind('hashchange', function() {
    redraw();
  });
  setcurnumber(0);
  if (currentstate().seed == 1) {
    showpopup('#intro');
  }

  $(document).on('click', function(ev) {
    if (!$(ev.target).closest('.sudoku-cell, .numberkey-cell').length) {
      setcurnumber(null);
    }
  });

});

function setupgame(seed) {
  if (!seed) { seed = loadseed(); }
  $(document).trigger('log', ['setupgame', {seed: seed}]);
  saveseed(seed);
  if (loadgame(storagename(seed))) { return; }
  var quick = false;
  var puzzle = Sudoku.makepuzzle(seed, quick, SYMMETRIC_PUZZLES);
  var gentime = (new Date).getTime();
  commitstate({
    puzzle: puzzle,
    seed: seed,
    answer: [],
    work: [],
    elapsed: 0,
    gentime: gentime,
  });
}

function currentstate() {
  return decodeboardstate(gethashdata());
}

function commitstate(state) {
  var now = (new Date).getTime();
  if (state.gentime > starttime) {
    starttime = state.gentime;
  }
  if (!victorious(state) || !victorious(currentstate())) {
    state.elapsed = (now - starttime);
  }
  sethashdata(encodeboardstate(state));
  savestate(storagename(state.seed), state);
}

function gethashdata() {
  var result = {};
  window.location.hash.replace(/^\W*/, '').split('&').forEach(function (pair) {
    if (pair === '') return;
    var parts = pair.split('=');
    result[parts[0]] = parts[1] && decodeURIComponent(
           parts[1].replace(/\+/g, ' '));
  });
  return result;
}

function sethashdata(data) {
  if (!window.location.hash && window.history.replaceState) {

    window.history.replaceState(null, null, '#' + $.param(data));
  } else {

    window.location.hash = $.param(data);
  }
}

function encodeboardstate(state) {

  var result = {
    puzzle: encodepuzzle(state.puzzle)
  }

  if ('answer' in state) { result.answer = encodepuzzle(state.answer); }

  if ('work' in state) { result.work = arraytobase64(state.work); }

  if ('seed' in state) { result.seed = state.seed; }

  if ('gentime' in state) { result.gentime = state.gentime; }

  if ('elapsed' in state) { result.elapsed = state.elapsed; }

  result.size = Sudoku.B;
  return result;
}

function decodeboardstate(data) {
  if ('size' in data) {

    if (Sudoku.B != data.size) {
      data = {}
    }
  }
  var puzzle = decodepuzzle('puzzle' in data ? data.puzzle : '');
  var answer = decodepuzzle('answer' in data ? data.answer : '');
  var work = base64toarray('work' in data ? data.work : '');
  var result = {
    puzzle: puzzle,
    answer: answer,
    work: work
  };
  if ('seed' in data) { result.seed = data.seed; }
  if ('gentime' in data) { result.gentime = data.gentime; }
  if ('elapsed' in data) { result.elapsed = data.elapsed; }
  return result;
}

function redraw(givenstate, pos) {
  var state = givenstate ? givenstate : currentstate();
  var startpos = 0;
  var endpos = Sudoku.S;
  if (typeof pos != 'undefined') { startpos = pos; endpos = pos + 1; }
  var puzzle = state.puzzle;
  var answer = state.answer;
  var work = state.work;
  var victory = victorious(state);
  var seed = state.seed;

  var title = seed ? ('Puzzle #' + seed) : 'Custom Puzzle';
  $('#grade').html(title);

  if (victory) {
    runningtime = false;
    $('.timer').text(formatelapsed(state.elapsed));
  } else {
    $('#victory').css('display', 'none');
  }

  $('.progress').css('display', victory ? 'none' : 'inline');
  $('.finished').css('display', victory ? 'inline' : 'none');
  if (!victory) {
    $('.timer').text(formatelapsed((new Date).getTime() - starttime));
  }

  $('.timescore').css({visibility: state.seed == 1 && !victory
                      ? 'hidden' : 'visible'});

  if (!victory && !runningtime) {
    runningtime = true;
    updatetime();
  }

  for (var j = startpos; j < endpos; j++) {
    if (puzzle[j] !== null) {

      $("#sn" + j).attr('class', 'sudoku-given').html(puzzle[j] + 1);
    } else {
      if (answer[j] !== null || work[j] == 0) {

        $("#sn" + j).attr('class', 'sudoku-answer').html(
            answer[j] === null ? '&nbsp;' : handglyph(answer[j] + 1));
      } else {

        var text = '<table class="sudoku-work-table">';
        for (var n = 0; n < Sudoku.N; n++) {
          if (n % Sudoku.B == 0) { text += '<tr>'; }
          text += '<td><div>' +
          ((work[j] & (1 << n)) ? handglyph(n + 1) : '&nbsp;') +
          '</div></td>';
          if (n % Sudoku.B == Sudoku.B - 1) { text += '</tr>'; }
        }
        text += '</table>'
        $("#sn" + j).attr('class', 'sudoku-work').html(text);
      }
    }
  }
}

function handglyph(text) {

  if ('' + text === '1') { return 'I'; }
  return text;
}

$(document).on('click', 'td.numberkey-cell', function(ev) { mouseInputCount++;
  var num = parseInt($(this).attr('id').substr(2));
  setcurnumber(num);
  ev.stopPropagation();
});

function setcurnumber(num) {
  curnumber = num;
  $('.numberkey-cell').removeClass('selected');
  if (num !== null) {
    $('#nk' + num).addClass('selected');
  }
}

$(document).on('mousedown', 'td.sudoku-cell', function(ev) {
  ev.preventDefault();
  hidepopups();

  $('.sudoku-cell').removeClass('clicked-focus');
  $(this).addClass('clicked-focus');

  var pos = parseInt($(this).attr('id').substr(2));
  var state = currentstate();

  setvisiblefocus(this);

  if (state.puzzle[pos] !== null) return;

  if (curnumber !== null) {
    var num = curnumber - 1; 
    state.answer[pos] = num;  
    state.work[pos] = 0;

    var sofar = boardsofar(state);
    var conflicts = SudokuHint.conflicts(sofar);

    if (conflicts.length > 0) {
      $('#sc' + pos).addClass('input-error');
      conflicts.forEach(function(conflict) {
        var conflictPos = typeof conflict === 'object' ? conflict.position : conflict;
        if (conflictPos !== pos) {
          $('#sc' + conflictPos).addClass('conflict-cell');
        }
      });

      setTimeout(function() {
        $('#sc' + pos).removeClass('input-error');
        conflicts.forEach(function(conflict) {
          var conflictPos = typeof conflict === 'object' ? conflict.position : conflict;
          $('#sc' + conflictPos).removeClass('conflict-cell');
        });
      }, 1000);

      $(document).trigger('log', ['input-error', {position: pos, value: num + 1}]);
    } else {
      $('#sc' + pos).addClass('input-correct');
      setTimeout(function() {
        $('#sc' + pos).removeClass('input-correct');
      }, 500);
      moveToNextEmptyCell(state, pos);
    }

    if (victorious(state)) {
      var now = (new Date).getTime();
      if (state.gentime > starttime) {
        starttime = state.gentime;
      }
      state.elapsed = (now - starttime);

      $(document).trigger('log', ['victory', {
        elapsed: state.elapsed,
        seed: currentstate().seed
      }]);
    }

    redraw(state, pos, pos + 1);

    setTimeout(function() {
      commitstate(state);
    }, 0);
  }
});

$(document).on('click', 'td.sudoku-cell', function(ev) {
  ev.stopPropagation();
});

function isalt(ev) {
  return (ev.which == 3) || (ev.ctrlKey) || (ev.shiftKey);
}

$(document).on('click', '#nextbutton', function(ev) {
  flippage(1);
});

$(document).on('click', '#prevbutton', function(ev) {
  flippage(-1);
});

function moveToNextEmptyCell(state, currentPos) {

  $('.sudoku-cell').removeClass('input-error conflict-cell');

  for (var i = 1; i < Sudoku.S; i++) {
    var nextPos = (currentPos + i) % Sudoku.S;
    if (state.puzzle[nextPos] === null && state.answer[nextPos] === null) {

      $('.sudoku-cell').removeClass('clicked-focus');

      $('#sc' + nextPos).addClass('clicked-focus');

      setvisiblefocus($('#sc' + nextPos)[0]);
      break;
    }
  }
}

function flippage(skip) {
  var state = currentstate();
  var seed = parseInt(state.seed);
  if (seed >= 1 && seed <= 1e9) {
    savestate(storagename(seed), state);
  }
  seed += skip;
  if (!(seed >= 1 && seed <= 1e9)) {
    seed = 1;
  }
  setupgame(seed);
}

$(document).on('click', '#clearbutton', function(ev) {
  hidepopups();
  var state = currentstate();
  var cleared = {puzzle: state.puzzle, seed: state.seed,
                 answer:[], work:[], gentime: (new Date).getTime()};
  commitstate(cleared);
});

$(document).on('mousedown touchstart', '#checkbutton', function(ev) {
  hidepopups();
  var state = currentstate();
  var sofar = boardsofar(state);

  var conflicts = SudokuHint.conflicts(sofar);
  if (conflicts.length == 0) {

    showpopup(countfilled(sofar) == Sudoku.S ? '#victory' : '#ok');
  } else {

    showpopup('#errors');
  }
  ev.stopPropagation();
});

$(document).on('mouseup mouseleave touchend', '#checkbutton', function() {
  if ($('#victory').css('display') != 'none') {
    return;
  }
  hidepopups();
  var state = currentstate();
  redraw(state);
});

$(document).on('click', '#checkbutton', function(ev) {
  if ($('#victory').css('display') != 'none') {
    ev.stopPropagation();
  }
});

function setvisiblefocus(kf) {

  $('.sudoku-cell').removeClass('related-cell same-value conflict-cell input-error');

  if (visiblefocus !== null) {
    $(visiblefocus).find('div.sudoku-border').toggleClass('focus', false);
  }

  visiblefocus = kf;

  if (visiblefocus !== null) {
    var pos = parseInt($(visiblefocus).attr('id').substr(2));
    $(visiblefocus).find('div.sudoku-border').toggleClass('focus', true);

    var row = Math.floor(pos / Sudoku.N);
    var col = pos % Sudoku.N;
    var blockRow = Math.floor(row / Sudoku.B);
    var blockCol = Math.floor(col / Sudoku.B);

    for (var c = 0; c < Sudoku.N; c++) {
      if (c !== col) {
        $('#sc' + (row * Sudoku.N + c)).addClass('related-cell');
      }
    }

    for (var r = 0; r < Sudoku.N; r++) {
      if (r !== row) {
        $('#sc' + (r * Sudoku.N + col)).addClass('related-cell');
      }
    }

    for (var r = blockRow * Sudoku.B; r < (blockRow + 1) * Sudoku.B; r++) {
      for (var c = blockCol * Sudoku.B; c < (blockCol + 1) * Sudoku.B; c++) {
        if (r !== row || c !== col) {
          $('#sc' + (r * Sudoku.N + c)).addClass('related-cell');
        }
      }
    }

    var state = currentstate();
    var board = boardsofar(state);
    var value = board[pos];

    if (value !== null) {
      for (var i = 0; i < Sudoku.S; i++) {
        if (i !== pos && board[i] === value) {
          $('#sc' + i).addClass('same-value');
        }
      }
    }
  }
}

function setcurnumber(num) {
  $('td.numberkey-cell').toggleClass('selected', false);
  $('#nk' + num).toggleClass('selected', true);
  curnumber = num;
}

function hidepopups() {
  $('div.sudoku-popup').css('display', 'none');
}

function showpopup(id) {
  var velt = $(id);
  var telt = $('table.sudoku');
  var position = telt.offset();
  position.left += (telt.outerWidth() - velt.outerWidth()) / 2;
  position.top += (telt.outerHeight() - velt.outerHeight()) / 3;
  velt.css({
    display: 'block',
    left: position.left,
    top: position.top
  });
}

function formatelapsed(elapsed) {
  if (!(elapsed >= 0)) { return '-'; }
  var seconds = Math.floor(elapsed / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  seconds -= minutes * 60;
  minutes -= hours * 60;
  var formatted = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  if (hours > 0) {
    formattted = hours + ':' + (minutes < 10 ? '0' : '') + formatted;
  }
  return formatted;
}

function updatetime() {
  if (runningtime && $('.timer').is(':visible')) {
    $('.timer').text(formatelapsed((new Date).getTime() - starttime));
    setTimeout(updatetime,
        1001 - (((new Date).getTime() - starttime) % 1000));
  } else {
    runningtime = false;
  }
}

function boardsofar(state) {
  var sofar = state.puzzle.slice();
  for (var j = 0; j < Sudoku.S; j++) {
    if (state.answer[j] !== null) sofar[j] = state.answer[j];
  }
  return sofar;
}

function countfilled(board) {
  var count = 0;
  for (var j = 0; j < Sudoku.S; j++) {
    if (board[j] !== null) count += 1;
  }
  return count;
}

function victorious(state) {
  var sofar = boardsofar(state);
  if (countfilled(sofar) != Sudoku.S) return false;
  if (SudokuHint.conflicts(sofar).length != 0) return false;
  return true;
}

function storagename(seed) {
  return 'sudoku' + location.pathname.replace(/[\W]+/g, '-') + '-' + seed;
}

function loadgame(name) {
  var state = loadstate(name);
  if (!state) return false;
  if (!state.puzzle || !state.puzzle.length) return false;
  if ('elapsed' in state) {
    starttime = (new Date).getTime() - state.elapsed;
  }
  commitstate(state);
  return true;
}

function loadstate(name) {
  if (!USE_LOCAL_STORAGE ||
      !('localStorage' in window) || !('JSON' in window) ||
      !(name in window.localStorage)) {
    return null;
  }
  var data = localStorage[name];
  var state = JSON.parse(data);
  return state;
}

function savestate(name, state) {
  if (!USE_LOCAL_STORAGE ||
      !('localStorage' in window) || !('JSON' in window)) {
    return;
  }
  localStorage[name] = JSON.stringify(state);
}

function loadseed() {
  return loadstate(storagename('seed')) || 1;
}

function saveseed(seed) {
  savestate(storagename('seed'), seed);
}

$(document).keydown(function(e) {

{}

  if ((e.which >= 49 && e.which <= 57) || (e.which >= 97 && e.which <= 105)) {
    keyInputCount++;

    var num = (e.which <= 57) ? e.which - 48 : e.which - 96;

    if (num <= Sudoku.N) {

      var clickedCell = $('.clicked-focus')[0];
      if (clickedCell) {
        var pos = parseInt($(clickedCell).attr('id').substr(2));
        var state = currentstate();

        if (state.puzzle[pos] !== null) return false;

        state.answer[pos] = num - 1;
        state.work[pos] = 0;

        var sofar = boardsofar(state);
        var conflicts = SudokuHint.conflicts(sofar);

if (conflicts.length > 0) {

  $(document).trigger('log', ['input-conflict', {
    position: pos,
    value: num,
    conflicts: conflicts,
    timestamp: Date.now()

  }]);
  console.log('Conflict detected at pos', pos, 'value:', num, 'DOM content:', $('#sc' + pos).html());

  $('#sc' + pos).addClass('input-error');
  console.log('After error class added:', $('#sc' + pos).attr('class'));

  conflicts.forEach(function(conflict) {

    var conflictPos = typeof conflict === 'object' ? conflict.position : conflict;
    if (conflictPos !== pos) {
      $('#sc' + conflictPos).addClass('conflict-cell');
    }
  });

  setTimeout(function() {
    console.log('Timeout cleanup - cell state:', {
      answer: state.answer[pos],
      work: state.work[pos],
      html: $('#sc' + pos).html()
    });
    $('#sc' + pos).removeClass('input-error');
    conflicts.forEach(function(conflict) {
      var conflictPos = typeof conflict === 'object' ? conflict.position : conflict;
      $('#sc' + conflictPos).removeClass('conflict-cell');
    });
  }, 1000);

          $(document).trigger('log', ['input-error', {position: pos, value: num}]);
        } else {

          $('#sc' + pos).addClass('input-correct');
          setTimeout(function() {
            $('#sc' + pos).removeClass('input-correct');
          }, 500);
          moveToNextEmptyCell(state, pos);

        }

        if (victorious(state)) {
          $(document).trigger('log', ['game-complete', {
            time: state.elapsed,
            seed: state.seed,
            difficulty: state.size,
            totalErrors: errorCount,
            keyInputs: keyInputCount,
            mouseInputs: mouseInputCount,
            timestamp: Date.now()
          }]);
          var now = (new Date).getTime();
          if (state.gentime > starttime) {
            starttime = state.gentime;
          }
          state.elapsed = (now - starttime);

          $(document).trigger('log', ['victory', {
            elapsed: state.elapsed,
            seed: currentstate().seed
          }]);
        }

        redraw(state, pos);

        setTimeout(function() {
          commitstate(state);
        }, 0);
      }

      return false; 
    }
  }

  if (e.which === 8 || e.which === 46) {
    var clickedCell = $('.clicked-focus')[0];
    if (clickedCell) {
      var pos = parseInt($(clickedCell).attr('id').substr(2));
      var state = currentstate();

      if (state.puzzle[pos] !== null) return false;

      state.answer[pos] = null;
      state.work[pos] = 0;

      redraw(state, pos);

      setTimeout(function() {
        commitstate(state);
      }, 0);
    }
    return false; 
  }

  if (e.which >= 37 && e.which <= 40) {
    var newPos;
    var clickedCell = $('.clicked-focus')[0];

    if (clickedCell) {
      var pos = parseInt($(clickedCell).attr('id').substr(2));
      var row = Math.floor(pos / Sudoku.N);
      var col = pos % Sudoku.N;

      switch(e.which) {
        case 37: 
          col = Math.max(0, col - 1);
          break;
        case 38: 
          row = Math.max(0, row - 1);
          break;
        case 39: 
          col = Math.min(Sudoku.N - 1, col + 1);
          break;
        case 40: 
          row = Math.min(Sudoku.N - 1, row + 1);
          break;
      }

      newPos = row * Sudoku.N + col;
    } else {

      newPos = 0;
    }

    var newCell = $('#sc' + newPos)[0];
    if (newCell) {

      $('.sudoku-cell').removeClass('clicked-focus');

      $(newCell).addClass('clicked-focus');

      setvisiblefocus(newCell);
    }

    return false; 
  }

  if (e.which === 9) {
    var state = currentstate();
    var startPos = 0;
    var clickedCell = $('.clicked-focus')[0];

    if (clickedCell) {
      startPos = parseInt($(clickedCell).attr('id').substr(2)) + 1;
    }

    var found = false;
    for (var i = 0; i < Sudoku.S; i++) {
      var pos = (startPos + i) % Sudoku.S;
      if (state.puzzle[pos] === null && state.answer[pos] === null) {

        var newCell = $('#sc' + pos)[0];
        if (newCell) {

          $('.sudoku-cell').removeClass('clicked-focus');

          $(newCell).addClass('clicked-focus');

          setvisiblefocus(newCell);
          found = true;
          break;
        }
      }
    }

    return false; 
  }
});

function encodepuzzle(puzzle) {
  if (!puzzle) return '';
  var result = [];
  for (var j = 0; j < puzzle.length; j++) {
    result.push(puzzle[j] === null ? 0 : puzzle[j] + 1);
  }
  return result.join('');
}

function decodepuzzle(str) {
  var puzzle = [];
  var c = 0;
  for (var j = 0; j < str.length; j++) {
    var num = str.charCodeAt(j) - '0'.charCodeAt(0);
    puzzle.push(num == 0 ? null : (num - 1));
  }
  for (; j < Sudoku.S; j++) {
    puzzle.push(null);
  }
  return puzzle;
}

function shorttobase64(int18) {
  return base64chars[(int18 >> 6) & 63] +
         base64chars[int18 & 63];
}

function base64toshort(base64, index) {
  return (base64chars.indexOf(base64.charAt(index)) << 6) +
          base64chars.indexOf(base64.charAt(index + 1));
}

function arraytobase64(numbers) {
  var result = [];
  for (var end = numbers.length; end > 0; end--) {
    if (numbers[end - 1]) break;
  }
  for (var j = 0; j < end; j++) {
    result.push(shorttobase64(numbers[j]));
  }
  return result.join('');
}

function base64toarray(base64) {
  var result = [];
  for (var j = 0; j + 1 < base64.length; j += 2) {
    result.push(base64toshort(base64, j));
  }
  for (j /= 2; j < Sudoku.S; j++) {
    result.push(0);
  }
  return result;
}

var base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                  "abcdefghijklmnopqrstuvwxyz" +
                  "0123456789" +
                  "-_";

function boardhtml() {
  var text = "<table class=sudoku id=grid cellpadding=1px>\n";
  text += "<tr><td colspan=13 class=sudoku-border>" +
          "<img class=sudoku-border></td></tr>\n";
  for (var y = 0; y < Sudoku.N; y++) {
    text += "<tr>"
    text += "<td class=sudoku-border></td>"
    for (var x = 0; x < Sudoku.N; x++) {
      var c = y * Sudoku.N + x;
      text += "<td class=sudoku-cell id=sc" + c + ">" +
              "<div class=sudoku-border>" +
              "<div class=sudoku-number id=sn" + c + ">" +
              "&nbsp;</div></div>";
      if (x % Sudoku.B == Sudoku.B - 1) text += "<td class=sudoku-border></td>";
    }
    text += "</tr>\n";
    if (y % Sudoku.B == Sudoku.B - 1) {
      text += "<tr><td colspan=13 class=sudoku-border>" +
              "<img class=sudoku-border></td></tr>\n";
    }
  }
  text += "<tr><td colspan=" + Sudoku.N + " id=caption></td></tr>\n";
  text += "</table>\n";
  return text;
}

function numberkeyhtml() {
  var result = '<table class="numberkey">';
  for (var j = 1; j <= Sudoku.N; ++j) {
    result += '<tr><td class="numberkey-cell" id="nk' + j + '">' +
        '<div class="sudoku-answer nk' + j + '">' +
          handglyph(j) + '</div></td></tr>';
  }
  result += '<tr><td class="numberkey-cell" id="nk0">' +
        '<div class="eraser nk0">' +
        '&#xf12d;</div></td></tr>';
  result += '</table>';
  return result;
}

function setup_screen() {
  $('#centerlayout').prepend(boardhtml());
  $('#leftlayout').prepend(numberkeyhtml());
}