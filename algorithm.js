var Sudoku = {

  init: (function(B) {
  
  var lib = this;
  
  if (!B) { B = 3; }
  lib.B = B;
  
  lib.N = B * B;            
  lib.S = lib.N * lib.N;    
  lib.C = lib.N * B;        
  lib.M = (1 << lib.N) - 1; 
  
  function emptyboard() {
    var result = [];
    for (var pos = 0; pos < lib.S; pos++) {
      result.push(null);
    }
    return result;
  }
  
  function solution(board, limit) {
    if (typeof(limit) == 'undefined') limit = Infinity;
    return solvefast(board, limit).solution;
  }
  
  function solvable(board, limit) {
    if (typeof(limit) == 'undefined') limit = Infinity;
    return solvefast(board, limit).solution !== null;
  }
  
  function uniquesolution(board) {
    var s = solvefast(board, Infinity);
    if (s.solution === null) return false;
    s = solvenext(s.track, Infinity);
    return (s.solution === null);
  }
  
  function makepuzzle(seed, quick, symmetric) {
  
    var oldrandom = null;
    if (seed && 'seedrandom' in Math) {
      oldrandom = Math.random;
      Math.seedrandom('sudoku-' + seed);
    }
  
    var solved = solution(emptyboard());
  
    var puzzle = [];
    var deduced = emptyboard();
    for (var k = (symmetric ? 2 : 1); k > 0; --k) {
  
      var order = unconstrained(deduced);
      for (var i = 0; i < order.length; ++i) {
        var pos = order[i];
        if (deduced[pos] === null && (k < 2 || deduced[lib.S - pos-1] === null)) {
          var hint = {pos: pos, num: solved[pos]};
          deduced[pos] = solved[pos];
          if (symmetric) {
            hint.sym = solved[lib.S - pos-1];
            deduced[lib.S - pos-1] = solved[lib.S - pos-1];
          }
          puzzle.push(hint);
          deduce(deduced);
        }
      }
    }
  
    puzzle.reverse();
  
    if (oldrandom !== null) {
      Math.random = oldrandom;
    }
  
    if (!quick) {
      for (var i = puzzle.length - 1; i >= 0; i--) {
        var old = puzzle[i];
        puzzle.splice(i, 1);
        if (!uniquesolution(boardforentries(puzzle))) {
          puzzle.splice(i, 0, old);
        }
      }
    }
  
    return boardforentries(puzzle);
  }
  
  function solvefast(original, limit) {
    var turtle = solveboard(original, 100);
    var steps = 100;
    var rabbitsteps = 60;
    while (steps < limit) {
      if (turtle.solution !== null || turtle.track.length == 0) return turtle;
      var rabbit = solveboard(original, rabbitsteps);
      if (rabbit.solution !== null || rabbit.track.length == 0) return rabbit;
      turtle = solvenext(turtle.track, rabbitsteps);
      steps += 2 * rabbitsteps;
      rabbitsteps += 10;
    }
  }
  
  function solveboard(original, limit) {
    var board = original.slice();
    var guesses = deduce(board);
    if (guesses === null) return {track:[], solution:null};
    if (guesses.length == 0) return {track:[], solution:board};
    return solvenext([{guesses:guesses, c:0, board:board}], limit);
  }
  
  function solvenext(remembered, limit) {
    var steps = 0;
    while (remembered.length > 0 && steps < limit) {
      steps += 1;
      var r = remembered.pop();
      if (r.c >= r.guesses.length) continue;
      remembered.push({guesses:r.guesses, c:r.c+1, board:r.board});
      workspace = r.board.slice();
      workspace[r.guesses[r.c].pos] = r.guesses[r.c].num;
      newguesses = deduce(workspace);
      if (newguesses === null) continue;
      if (newguesses.length == 0) return {track:remembered, solution:workspace};
      remembered.push({guesses:newguesses, c:0, board:workspace});
    }
    return {track:remembered, solution:null};
  }
  
  function deduce(board) {
    while (true) {
      var choices = bestchoices(board);
      if (choices === null) return null;
      if (choices.length == 0) return [];
      if (choices[0].length != 1) return choices[0];
      var done = 0;
      for (i = 0; i < choices.length; i++) {
        var num = choices[i][0].num;
        var bit = 1 << num;
        if (!(done & bit)) {
          done |= bit;
          board[choices[i][0].pos] = num;
        }
      }
    }
  }
  
  function unconstrained(board) {
    var bits = figurebits(board);
    var results = [];
    for (var freedom = 0; freedom < lib.N + 1; freedom++) {
      results.push([]);
    }
    for (var pos = 0; pos < lib.S; pos++) {
      if (board[pos] === null) {
        results[listbits(bits.allowed[pos]).length].push(pos);
      }
    }
    var result = [];
    for (freedom = results.length - 1; freedom >= 0; --freedom) {
      shuffle(results[freedom]);
      result.push.apply(result, results[freedom]);
    }
    return result;
  }
  
  function bestchoices(board) {
    var result = [];
    var bits = figurebits(board);
    var emptycount = 0;
    for (var pos = 0; pos < lib.S; pos++) {
      if (board[pos] === null) {
        emptycount += 1;
        var numbers = listbits(bits.allowed[pos]);
        if (result.length && numbers.length > result[0].length) continue;
        var choices = [];
        for (var i = 0; i < numbers.length; i++) {
          choices.push({pos: pos, num: numbers[i]});
        }
        updatechoices(result, choices);
      }
    }
    if (emptycount == 0) return [];
    for (var axis = 0; axis < 3; axis++) {
      for (var x = 0; x < lib.N; x++) {
        var numbers = listbits(bits.needed[axis * lib.N + x]);
        for (var j = 0; j < numbers.length; j++) {
          bit = 1 << numbers[j];
          var choices = [];
          for (var y = 0; y < lib.N; y++) {
            var pos = posfor(x, y, axis);
            if (bits.allowed[pos] & bit) {
              choices.push({pos: pos, num: numbers[j]});
            }
          }
          updatechoices(result, choices);
        }
      }
    }
    if (result.length == 0 || result[0].length == 0) return null;
    shuffle(result);
    shuffle(result[0]);
    return result;
  }
  
  function figurebits(board) {
    var needed = [];
    var allowed = [];
    for (var i = 0; i < board.length; i++)  {
      allowed.push(board[i] === null ? lib.M : 0);
    }
    for (var axis = 0; axis < 3; axis++) {
      for (var x = 0; x < lib.N; x++) {
        var bits = axismissing(board, x, axis);
        needed.push(bits);
        for (var y = 0; y < lib.N; y++) {
          allowed[posfor(x, y, axis)] &= bits
        }
      }
    }
    return {allowed:allowed, needed:needed};
  }
  
  function blockpositions(B) {
    var posx = 0;
    var posy = 0;
    var Px = [];
    var Py = [];
    for (var x = 0; x < B; ++x) {
      for (var y = 0; y < B; ++y) {
        Px.push(posx);
        Py.push(posy);
        posx += B;
        posy += 1;
      }
      posx += (B * B * B) - (B * B)
      posy += (B * B) - B
    }
    return [Px, Py];
  }
  
  lib.P = blockpositions(B); 
  
  function posfor(x, y, axis) {
    if (axis == 0) return x * lib.N + y;
    if (axis == 1) return y * lib.N + x;
    return lib.P[0][x] + lib.P[1][y];
  }
  
  function axisfor(pos, axis) {
    if (axis == 0) return (pos - pos % lib.N) / lib.N;
    if (axis == 1) return pos % lib.N;
    return ((pos - pos % lib.C) / lib.C) * lib.B +
           ((pos - pos % lib.B) / lib.B) % lib.B;
  }
  
  function posforblock(block, axis, x, y) {
    var c = lib.B * (block % lib.B);
    var r = (block - block % lib.B);
    if (axis == 0) { c += x; r += y; }
    else { c += y; r += x; }
    c = c % lib.N;
    r = r % lib.N;
    return r * lib.N + c;
  }
  
  function axismissing(board, x, axis) {
    var bits = 0
    for (var y = 0; y < lib.N; y++) {
      var e = board[posfor(x, y, axis)];
      if (e !== null) bits |= 1 << e;
    }
    return lib.M ^ bits;
  }
  
  function listbits(bits) {
    var result = [];
    for (var y = 0; y < lib.N; y++) {
      if (0 != (bits & (1 << y))) result.push(y);
    }
    return result;
  }
  
  function updatechoices(result, choices) {
    if (result.length) {
      if (choices.length > result[0].length) return;
      if (choices.length < result[0].length) result.length = 0;
    }
    result.push(choices);
  }
  
  function boardforentries(entries) {
    var result = emptyboard();
    for (var i = 0; i < entries.length; i++) {
      result[entries[i].pos] = entries[i].num;
      if (entries[i].sym != null) {
        result[lib.S - entries[i].pos-1] = entries[i].sym;
      }
  
    }
    return result;
  }
  
  function shuffle(o) {
    for (var j, x, i = o.length; i;
         j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  }
  
  lib.emptyboard = emptyboard;
  lib.solution = solution;
  lib.solvable = solvable;
  lib.uniquesolution = uniquesolution;
  lib.makepuzzle = makepuzzle;
  
  lib.posfor = posfor;
  lib.posforblock = posforblock;
  lib.axisfor = axisfor;
  lib.figurebits = figurebits;
  lib.listbits = listbits;
  
  })
  };
  
  Sudoku.init();