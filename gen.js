
function assert(rs,msg){
  console.log((rs?'passed':'failed') + " | " + msg);
}

var gen = {};

gen.S = {OK:'OK',ERROR:'ERROR'};

gen.P = {
	  EOF:'EOF',
	  WS:'WS',
	  RANGE:'RANGE',
	  ALPH:'ALPH',
	  UNICODE:'UNICODE',
	  DIGIT:'DIGIT',
	  HEX_DIGIT:'HEX_DIGIT',
	  NUM:'NUM',
	  INT:'INT',
	  UINT:'UINT',
	  SYM:'SYM',
	  IN:'IN',
	  NOT_IN:'NOT_IN',
	  Q_STR:'Q_STR',
	  DQ_STR:'DQ_STR',
	  SQ_STR:'SQ_STR',
	  OR:'OR',
	  SEQ:'SEQ',
	  CONCAT:'CONCAT',
          LIST:'LIST',
          OPT_LIST:'OPT_LIST',
          EN_LIST:'EN_LIST',
          REPEAT:'REPEAT',
          OPT:'OPT',
          RULE:'RULE', 
          PERMU:'PERMU'
	};
	
function Position(index,line,column){
	this.index = index;
	this.line = line;
	this.column = column;
}

gen.Position = Position;

function ErrorInfo(line, column, context) {
            this.line = line;
            this.column = column;
            this.context = context;
}
ErrorInfo.prototype.to_str = function () {
    return 'Error at line ' + this.line + ' column ' + this.column + ':\n' + this.context;
};

gen.ErrorInfo = ErrorInfo;

function R(status, rule, operator, index, length, children, extra, err) {
            this.status = status;
            this.rule = rule;
            this.operator = operator;
            this.index = index;
            this.length = length;
            this.children = children;
            this.extra = extra;
            this.err = err;
}
R.prototype.text = function () {
    return 0 != this.length ? _src.substring(this.index, this.index + this.length) : null;
};

R.prototype.matched = function () {
    return gen.S.OK == this.status;
};

R.ok = function (operator, index, length, children) {
    return new R(gen.S.OK, null, operator, index, length, children, null, null);
};

R.error = function (operator, index, children, err) {
    return new R(gen.S.ERROR, null, operator, index, 0, children, null, err);
};

gen.R = R;

function create(grammer,action){
  _grammar = grammer;
  _action = action;
  
  return {
  	  parse : function(rule,src){
  	  	  _src = src;
  	  	  _last_error = null;
  	  	  var r = $(rule)(src,0);
  	  	  if (!r.matched()) {
                    var err_pos = last_error_pos();
                    r.error_info = new ErrorInfo(err_pos.line, err_pos.column, last_error_context());
                  }
                  return r;
  	  	}
  	}	
}
gen.create = create;

function EOF(buffer,index){
  if(index >= buffer.length){
    return R.ok(gen.P.EOF,index,0,null);
  }else{
    return R.error(gen.P.EOF,index,null,'expect EOF');
  }	
}
gen.EOF = EOF;

function WS(min_len,max_len){
  if(typeof min_len === "undefined"){min_len = 1};
  if(typeof max_len === "undefined"){max_len = Number.MAX_VALUE};
  return _make(gen.P.WS,REPEAT(IN([' ', '\t', '\n', '\n'].join('')), min_len, max_len));
}
gen.WS = WS;

function RANGE(from,to){
        if (null == from || 1 != from.length || null == to || 1 != to.length) {
	    throw 'Invalid args for RANGE';
	}
	
	return function (buffer, index, depth) {
	    if (typeof depth === "undefined") { depth = 0; }
	    var r;
	    if (index < buffer.length && buffer.charAt(index) >= from && buffer.charAt(index) <= to) {
	        return R.ok(gen.P.RANGE, index, 1, null);
	    } else {
	        r = R.error(gen.P.RANGE, index, null, 'Expects number in range [' + from + ', ' + to + ']');
	        _update_last_error(r);
	        return r;
	    }
	};
}
gen.RANGE = RANGE;

function ALPH(){
	return _make(gen.P.ALPH,OR(RANGE('a', 'z'), RANGE('A', 'Z')));
}
gen.ALPH = ALPH;

/*TODO
function UNICODE(){
	
}
gen.UNICODE = UNICODE;
*/

function DIGIT(){
	return _make(gen.P.DIGIT,RANGE('0','9'));	
}
gen.DIGIT = DIGIT;

function HEX_DIGIT() {
        return _make(gen.P.HEX_DIGIT,OR(RANGE('0', '9'), RANGE('a', 'f'), RANGE('A', 'F')));
}
gen.HEX_DIGIT = HEX_DIGIT;

function NUM(){
	return _make(gen.P.NUM,SEQ(OPT('-'),
			           OR('0', SEQ(RANGE('1', '9'), REPEAT(DIGIT()))), 
			           OPT(SEQ('.', REPEAT(DIGIT(), 1))), 
			           OPT(SEQ(OR('e', 'E'), OPT(OR('+', '-')), REPEAT(DIGIT(), 1)))));
}
gen.NUM = NUM;

function INT(max_len){
	if (typeof max_len === "undefined") { max_len = Number.MAX_VALUE; }
	return _make(gen.P.INT,CONCAT(OPT(OR('+', '-')), REPEAT(DIGIT(), 1, max_len)));
}
gen.INT = INT;

function SYM(symbol){
	var _func = 'SYM("' + symbol + '")';
        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var r;
            if (index + symbol.length <= buffer.length && index == buffer.indexOf(symbol, index)) {
                _trace(_func, depth, false, gen.S.OK);
                return R.ok(gen.P.SYM, index, symbol.length, null);
            } else {
                r = R.error(gen.P.SYM, index, null, 'Expects string "' + symbol + '"');
                _update_last_error(r);
                _trace(_func, depth, false, gen.S.ERROR);
                return r;
            }
        };
}
gen.SYM = SYM;

// Quoted string: matches a quoted string, example: "a b c", 'a b c'
function Q_STR(quote) {
        if ('string' != typeof (quote) || 1 != quote.length) {
            throw 'Invalid quote for Q_STR';
        }
        
        return _make(gen.P.Q_STR, SEQ(quote, 
        		              REPEAT(OR('\\' + quote, '\\\\', '\\/', '\\b', '\\f', '\\n', '\\r', '\\t', '\\u' + REPEAT(HEX_DIGIT(), 4, 4), NOT_IN(quote + '\\'))),
        		              quote));
}
gen.Q_STR = Q_STR;

    // Double quoted string: matches a double quoted string "a b 1"
function DQ_STR() {
        return _make(gen.P.DQ_STR,Q_STR('"'));
}
    gen.DQ_STR = DQ_STR;

    // Single quoted string: matches a single quoted string 'a b 1'
function SQ_STR() {
        return _make(gen.P.SQ_STR,Q_STR("'"));
}
gen.SQ_STR = SQ_STR;

function IN(chars) {
        var _func = 'IN("' + chars + '")';
        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var r;
            if (index < buffer.length && chars.indexOf(buffer[index]) >= 0) {
                _trace(_func, depth, false, gen.S.OK);
                return R.ok(gen.P.IN, index, 1, null);
            } else {
                r = R.error(gen.P.IN, index, null, 'Expects a char in "' + chars + '"');
                _update_last_error(r);
                _trace(_func, depth, false, gen.S.ERROR);
                return r;
            }
        };
}
gen.IN = IN;

    // Not In: matches any character not in the given string
function NOT_IN(chars) {
        var _func = 'NOT_IN("' + chars + '")';
        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var r;
            if (index < buffer.length && chars.indexOf(buffer[index]) < 0) {
                _trace(_func, depth, false, gen.S.OK);
                return R.ok(gen.P.NOT_IN, index, 1, null);
            } else {
                r = R.error(gen.P.NOT_IN, index, null, 'Expects a char not in "' + chars + '"');
                _update_last_error(r);
                _trace(_func, depth, false, gen.S.ERROR);
                return r;
            }
        };
}
gen.NOT_IN = NOT_IN;

function OR() {
        var parsers = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            parsers[_i] = arguments[_i + 0];
        }
        var _func = 'OR';
        var _parsers = [];

        for (var i = 0; i < parsers.length; ++i) {
            _parsers.push(_wrap(parsers[i]));
        }

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var r;
            var i;
            var children = [];

            for (i = 0; i < _parsers.length; ++i) {
                var _r = _parsers[i](buffer, index, depth + 1);

                if (gen.S.OK == _r.status) {
                    _trace(_func, depth, false, gen.S.OK);
                    return R.ok(gen.P.OR, index, _r.length, [_r]);
                } else {
                    children.push(_r);
                }
            }

            r = R.error(gen.P.OR, index, children, 'Failed to match OR');
            _update_last_error(r);
            _trace(_func, depth, false, gen.S.ERROR);
            return r;
        };
}
gen.OR = OR;

function SEQ(){
	var parsers = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            parsers[_i] = arguments[_i + 0];
        }
        var _func = 'SEQ';
        var _parsers = [];

        for (var i = 0; i < parsers.length; ++i) {
            _parsers.push(_wrap(parsers[i]));
        }

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var idx = index;
            var children = [];

            for (var i = 0; i < _parsers.length; ++i) {
                var r = _parsers[i](buffer, idx, depth + 1);

                children.push(r);

                if (gen.S.OK == r.status) {
                    idx += r.length;
                } else {
                    r = R.error(gen.P.SEQ, idx, children, r.err);
                    _update_last_error(r);
                    _trace(_func, depth, false, gen.S.ERROR);
                    return r;
                }
            }

            _trace(_func, depth, false, gen.S.OK);
            return R.ok(gen.P.SEQ, index, idx - index, children);
        };
}
gen.SEQ = SEQ;

function CONCAT(){
	var parsers = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            parsers[_i] = arguments[_i + 0];
        }
        var _func = 'CONCAT';
        var _parsers = [];

        for (var i = 0; i < parsers.length; ++i) {
            _parsers.push(_wrap(parsers[i]));
        }

        _parsers = _insert_ws_matchers(_parsers);

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var idx = index;
            var children = [];

            for (var i = 0; i < _parsers.length; ++i) {
                var r = _parsers[i](buffer, idx, depth + 1);

                _log('depth=' + depth + ', i=' + i + ', op=' + r.operator, depth);

                if (gen.P.WS != r.operator) {
                    children.push(r);
                }

                if (gen.S.OK == r.status) {
                    idx += r.length;
                } else {
                    r = R.error(gen.P.CONCAT, idx, children, r.err);
                    _update_last_error(r);
                    _trace(_func, depth, false, gen.S.ERROR);
                    return r;
                }
            }

            _trace(_func, depth, false, gen.S.OK);
            return R.ok(gen.P.CONCAT, index, idx - index, children);
        };
}
gen.CONCAT = CONCAT;

function LIST(element_parser, delimiter_parser, save_delimiter) {
        if (typeof save_delimiter === "undefined") { save_delimiter = false; }
        var _func = 'LIST';
        var _parser = CONCAT(element_parser, REPEAT(CONCAT(delimiter_parser, element_parser), 0));

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);

            var r;
            var _r = _parser(buffer, index, depth);

            if (gen.S.OK == _r.status) {
                var _children = [];

                _children.push(_r.children[0]);

                for (var i = 0; i < _r.children[1].children.length; ++i) {
                    if (save_delimiter) {
                        _children.push(_r.children[1].children[i].children[0]);
                    }
                    _children.push(_r.children[1].children[i].children[1]);
                }

                r = R.ok(gen.P.LIST, index, _r.length, _children);
            } else {
                r = R.error(gen.P.LIST, index, null, 'Failed to match LIST');
            }

            gen.S.ERROR == r.status && _update_last_error(r);
            _trace(_func, depth, false, r.status);
            return r;
        };
}
gen.LIST = LIST;

// Optional List: matches a list of n elements (n >= 0), example "a, b, c"
function OPT_LIST(element_parser, delimiter_parser, save_delimiter) {
        if (typeof save_delimiter === "undefined") { save_delimiter = false; }
        var _func = 'OPT_LIST';
        var _parser = OPT(LIST(element_parser, delimiter_parser, save_delimiter));

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);

            var r;
            var _r = _parser(buffer, index, depth);

            if (gen.S.OK == _r.status) {
                var _children = (null != _r.children && _r.children.length > 0 ? _r.children[0].children : null);
                r = R.ok(gen.P.OPT_LIST, index, _r.length, _children);
            } else {
                r = R.error(gen.P.OPT_LIST, index, null, 'Failed to match OPT_LIST');
            }

            gen.S.ERROR == r.status && _update_last_error(r);
            _trace(_func, depth, false, r.status);
            return r;
        };
}
gen.OPT_LIST = OPT_LIST;

function EN_LIST(left_bracket, element_parser, delimiter_parser, right_bracket, save_delimiter) {
        if (typeof save_delimiter === "undefined") { save_delimiter = false; }
        var _func = 'EN_LIST';
        var _parser = CONCAT(left_bracket, OPT_LIST(element_parser, delimiter_parser, save_delimiter), right_bracket);

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);

            var r;
            var _r = _parser(buffer, index, depth);

            if (gen.S.OK == _r.status) {
                var _children = _r.children[1].children;
                r = R.ok(gen.P.EN_LIST, index, _r.length, _children);
            } else {
                r = R.error(gen.P.EN_LIST, index, null, 'Failed to match ENCLOSED_LIST');
            }

            gen.S.ERROR == r.status && _update_last_error(r);
            _trace(_func, depth, false, r.status);
            return r;
        };
}
gen.EN_LIST = EN_LIST;

function REPEAT(parser, min_times, max_times) {
        if (typeof min_times === "undefined") { min_times = 0; }
        if (typeof max_times === "undefined") { max_times = Number.MAX_VALUE; }
        var _func = 'REPEAT';
        var _parser = _wrap(parser);

        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);

            var i;
            var idx = index;
            var children = [];

            while (idx < buffer.length && children.length < max_times) {
                var _r = _parser(buffer, idx, depth + 1);

                if (gen.S.OK == _r.status) {
                    idx += _r.length;
                    children.push(_r);
                } else {
                    break;
                }
            }

            if (children.length < min_times) {
                var r;
                r = R.error(gen.P.REPEAT, index, children, 'Failed to match REPEAT');
                _update_last_error(r);
                _trace(_func, depth, false, gen.S.ERROR);
                return r;
            }

            _trace(_func, depth, false, gen.S.OK);
            return R.ok(gen.P.REPEAT, index, idx - index, children);
        };
}
gen.REPEAT = REPEAT;

function OPT(parser) {
        return _make(gen.P.OPT, REPEAT(parser, 0, 1));
}
gen.OPT = OPT;


function last_error() {
        return _last_error;
}
gen.last_error = last_error;

function last_error_pos() {
        if (null == _last_error) {
            return null;
        }

        var ln = 1;
        var ln_idx = -1;

        for (var i = 0; i < _last_error.index; ++i) {
            if ('\n' == _src.charAt(i)) {
                ++ln;
                ln_idx = i;
            }
        }

        return new Position(_last_error.index, ln, _last_error.index - ln_idx);
}
gen.last_error_pos = last_error_pos;

function last_error_context() {
        if (null == _last_error) {
            return null;
        }

        var err_pos = last_error_pos();
        var err_line = _src.split('\n')[err_pos.line - 1];
        var err_idx = err_pos.column - 1;

        var left = err_line.substring(err_idx - 20, err_idx);
        var right = err_line.substring(err_idx, err_idx + 20);

        var sp = '';
        for (var i = 0; i < left.length; ++i) {
            sp += ' ';
        }
        sp += '^^^';

        return left + right + '\n' + sp;
}
gen.last_error_context = last_error_context;

function $(rule) {
        var _func = '[' + rule + ']';
        return function (buffer, index, depth) {
            if (typeof depth === "undefined") { depth = 0; }
            _trace(_func, depth, true);
            var r;
            if (null != _grammar && null != _grammar[rule]) {
                r = _wrap(_grammar[rule])(buffer, index, depth);
                r.rule = rule;

                // apply semantics action
                if (null != _action && null != _action[rule] && gen.S.OK == r.status) {
                    var r1 = _action[rule](r);
                    if (null != r1) {
                        r = r1;
                    }
                }

                _trace(_func, depth, false, r.status);
                return r;
            } else {
                r = new R(gen.S.ERROR, rule, null, index, 0, null, null, 'Rule ' + rule + ' not found');
                _update_last_error(r);
                _trace(_func, depth, false, r.status);
                return r;
            }
        };
}
gen.$ = $;
//private 
var _trace_enabled = false;
var _debug_enabled = false;
var _last_error;
var _grammar;
var _action;
var _src;
// return a parser based on the type of arg
function _wrap(arg) {
	return ('string' == typeof (arg)) ? SYM(arg) : arg;
}

function _insert_ws_matchers(parsers) {
	var _parsers = [];
	var _ws = WS(0);
	_parsers.push(_ws);
	for (var i = 0; i < parsers.length; ++i) {
	    _parsers.push(parsers[i]);
	    _parsers.push(_ws);
	}
	return _parsers;
}

function _make(operator,parser){
  var _parser = parser;
  
  return function(buffer,index,depth){
    if (typeof depth === "undefined") { depth = 0; }
    _trace(operator, depth, true);
    var r = _parser(buffer, index, depth);
    if (gen.S.OK == r.status) {
        r = R.ok(operator, r.index, r.length, r.children);
    } else {
        r = R.error(operator, index, null, null);
    }

    (gen.S.ERROR == r.status) && _update_last_error(r);
    _trace(operator, depth, false, r.status);
    return r;
  }
}
function _update_last_error(r) {
        if (null == _last_error || r.index > _last_error.index) {
            _last_error = r;
        }
}

function _trace(name, depth, beginOrEnd, status) {
        if (typeof status === "undefined") { status = null; }
        if (_trace_enabled) {
            var msg = '';
            for (var i = 0; i < depth; ++i) {
                msg += '  ';
            }
            msg += beginOrEnd ? '+' : '-';
            msg += name;
            if (false == beginOrEnd && null != status) {
                msg += ' ' + status;
            }
            console.log(msg);
        }
}
function _log(message, depth) {
        if (typeof depth === "undefined") { depth = 0; }
        if (_debug_enabled) {
            var msg = '';
            for (var i = 0; i < depth; ++i) {
                msg += '  ';
            }
            msg += message;
            console.log(msg);
        }
}