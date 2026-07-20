// Todoist-style filter query language: tokenizer + recursive-descent parser
// producing a small AST, plus an evaluator predicate.
//
// Grammar (keywords case-insensitive, whitespace-insensitive between tokens):
//   query   := expr EOF
//   expr    := andExpr ( '|' andExpr )*        OR, lowest precedence
//   andExpr := unary ( '&' unary )*            AND
//   unary   := '!' unary | '(' expr ')' | term
//   term    := 'today' | 'tomorrow' | 'overdue'
//            | 'no' 'date' | 'no' 'labels'
//            | 'next' INT 'days'
//            | 'p1' | 'p2' | 'p3' | 'p4'
//            | '@' NAME | '#' NAME
//   NAME    := /[^\s&|()!]+/
//
// AST node shapes:
//   { type: 'or',  left, right }
//   { type: 'and', left, right }
//   { type: 'not', operand }
//   { type: 'term', term: { kind, n?, p?, name? } } where kind is one of
//     'today' | 'tomorrow' | 'overdue' | 'nodate' | 'nolabels'
//     | 'nextdays' (n: number) | 'priority' (p: 1-4) | 'label' (name)
//     | 'project' (name); names are stored lowercased (projects also with
//     spaces removed) so evaluation is a plain equality/includes check.
//
// evaluate(ast, task, ctx) assumes the task is already non-completed — views
// filter out completed tasks before applying a filter predicate.
// ctx: { today: 'YYYY-MM-DD',
//        labelNamesOf(task) -> lowercase string[],
//        projectNameOf(task) -> lowercase spaces-removed string }

import { addDays } from './dates.js';

class ParseError extends Error {
  constructor(message, position) {
    super(message);
    this.position = position;
  }
}

// Chars that end a NAME or bare word: whitespace and the operator/paren set.
const STOP = /[\s&|()!]/;

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const pos = i;
    if (c === '|' || c === '&' || c === '!' || c === '(' || c === ')') {
      tokens.push({ type: c, pos });
      i++;
      continue;
    }
    if (c === '@' || c === '#') {
      i++;
      const start = i;
      while (i < src.length && !STOP.test(src[i])) i++;
      if (i === start) {
        const what = c === '@' ? 'label' : 'project';
        throw new ParseError(`'${c}' must be followed by a ${what} name`, pos);
      }
      tokens.push({ type: c === '@' ? 'label' : 'project', name: src.slice(start, i), pos });
      continue;
    }
    const start = i;
    while (i < src.length && !STOP.test(src[i])) i++;
    tokens.push({ type: 'word', value: src.slice(start, i), pos });
  }
  tokens.push({ type: 'eof', pos: src.length });
  return tokens;
}

function describe(tok) {
  if (tok.type === 'eof') return 'end of input';
  if (tok.type === 'word') return `'${tok.value}'`;
  if (tok.type === 'label') return `'@${tok.name}'`;
  if (tok.type === 'project') return `'#${tok.name}'`;
  return `'${tok.type}'`;
}

export function parseFilter(src) {
  try {
    const tokens = tokenize(src);
    let idx = 0;
    const peek = () => tokens[idx];
    const next = () => tokens[idx++];
    const term = (t) => ({ type: 'term', term: t });

    function parseExpr() {
      let node = parseAnd();
      while (peek().type === '|') {
        next();
        node = { type: 'or', left: node, right: parseAnd() };
      }
      return node;
    }

    function parseAnd() {
      let node = parseUnary();
      while (peek().type === '&') {
        next();
        node = { type: 'and', left: node, right: parseUnary() };
      }
      return node;
    }

    function parseUnary() {
      const tok = peek();
      if (tok.type === '!') {
        next();
        return { type: 'not', operand: parseUnary() };
      }
      if (tok.type === '(') {
        next();
        const inner = parseExpr();
        if (peek().type !== ')') throw new ParseError('unclosed parenthesis', tok.pos);
        next();
        return inner;
      }
      return parseTerm();
    }

    function parseTerm() {
      const tok = next();
      if (tok.type === 'label') return term({ kind: 'label', name: tok.name.toLowerCase() });
      if (tok.type === 'project') {
        return term({ kind: 'project', name: tok.name.toLowerCase().replace(/\s+/g, '') });
      }
      if (tok.type !== 'word') {
        throw new ParseError(`expected a term, found ${describe(tok)}`, tok.pos);
      }
      const w = tok.value.toLowerCase();
      if (w === 'today') return term({ kind: 'today' });
      if (w === 'tomorrow') return term({ kind: 'tomorrow' });
      if (w === 'overdue') return term({ kind: 'overdue' });
      if (/^p[1-4]$/.test(w)) return term({ kind: 'priority', p: Number(w[1]) });
      if (w === 'no') {
        const nxt = next();
        const nw = nxt.type === 'word' ? nxt.value.toLowerCase() : null;
        if (nw === 'date') return term({ kind: 'nodate' });
        if (nw === 'labels') return term({ kind: 'nolabels' });
        throw new ParseError(
          `'no' must be followed by 'date' or 'labels', found ${describe(nxt)}`,
          nxt.pos
        );
      }
      if (w === 'next') {
        const numTok = next();
        if (numTok.type !== 'word' || !/^\d+$/.test(numTok.value)) {
          throw new ParseError(`'next' must be followed by a number, found ${describe(numTok)}`, numTok.pos);
        }
        const daysTok = next();
        if (daysTok.type !== 'word' || daysTok.value.toLowerCase() !== 'days') {
          throw new ParseError(
            `expected 'days' after 'next ${numTok.value}', found ${describe(daysTok)}`,
            daysTok.pos
          );
        }
        return term({ kind: 'nextdays', n: Number(numTok.value) });
      }
      throw new ParseError(`unknown word '${tok.value}'`, tok.pos);
    }

    const ast = parseExpr();
    const trailing = peek();
    if (trailing.type !== 'eof') {
      throw new ParseError(`unexpected ${describe(trailing)} after end of query`, trailing.pos);
    }
    return { ok: true, ast };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: { message: e.message, position: e.position } };
    }
    throw e;
  }
}

export function evaluate(node, task, ctx) {
  switch (node.type) {
    case 'or':
      return evaluate(node.left, task, ctx) || evaluate(node.right, task, ctx);
    case 'and':
      return evaluate(node.left, task, ctx) && evaluate(node.right, task, ctx);
    case 'not':
      return !evaluate(node.operand, task, ctx);
    case 'term':
      return evalTerm(node.term, task, ctx);
    default:
      return false;
  }
}

function evalTerm(t, task, ctx) {
  const due = task.due ? task.due.date : null;
  switch (t.kind) {
    case 'today':
      return due === ctx.today;
    case 'tomorrow':
      return due === addDays(ctx.today, 1);
    case 'overdue':
      return due !== null && due < ctx.today;
    case 'nodate':
      return !task.due;
    case 'nolabels':
      return task.labelIds.length === 0;
    case 'nextdays':
      // Inclusive window: today .. today + n
      return due !== null && due >= ctx.today && due <= addDays(ctx.today, t.n);
    case 'priority':
      return task.priority === t.p;
    case 'label':
      return ctx.labelNamesOf(task).includes(t.name);
    case 'project':
      return ctx.projectNameOf(task) === t.name;
    default:
      return false;
  }
}
