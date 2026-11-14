// The rules of check-ui-duplicates.mjs, on the TypeScript AST, kept apart so the tests can feed them
// snippets. Every function takes `{ path, text }` and returns `{ path, line, rule, message }` findings.
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

/** Pieces that own a group of buttons: a button group directly inside one of them is the shared piece. */
export const GROUP_PARENTS = new Set(['ButtonRow', 'Answers', 'ChipRow', 'KeyPad']);
/** Files that are the shared piece themselves. */
export const GROUP_FILES = new Set(['apps/mobile/src/blocked/Answers.tsx']);
/** The one file allowed to flip a chevron: DisclosureChevron lives there. */
export const DISCLOSURE_FILE = 'packages/ui/src/primitives/SectionHeader.tsx';

const parse = (path, text) =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

const tagName = (node) => {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  return null;
};

const unwrap = (node) => {
  let n = node;
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.expression;
  return n;
};

/** The meaningful children of a JSX element or fragment: no whitespace text. */
const childrenOf = (node) =>
  node.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));

/** A `<Button>`, or one `View` / fragment that wraps exactly one. */
function isButtonCell(node) {
  const n = unwrap(node);
  if (!n) return false;
  if (tagName(n) === 'Button') return true;
  if (ts.isJsxFragment(n) || tagName(n) === 'View') {
    if (!ts.isJsxFragment(n) && !ts.isJsxElement(n)) return false;
    const kids = childrenOf(n);
    return kids.length === 1 && tagName(kids[0]) === 'Button';
  }
  return false;
}

/** The nearest JSX element above the node; a fragment is transparent. */
function parentTag(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p)) return p.openingElement.tagName.getText();
  }
  return null;
}

const returnedExpressions = (fn) => {
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out = [];
  const visit = (n) => {
    if (n !== fn && ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return out;
};

/** True when two or more button cells sit next to each other (other content between them is no group). */
const hasAdjacentButtons = (node) => {
  let run = 0;
  for (const child of childrenOf(node)) {
    run = isButtonCell(child) ? run + 1 : 0;
    if (run >= 2) return true;
  }
  return false;
};

/** Rule (a): a hand-made group of buttons. */
export function handMadeButtonGroups({ path, text }) {
  if (GROUP_FILES.has(path)) return [];
  const sf = parse(path, text);
  const found = [];
  const report = (node, how) =>
    found.push({
      path,
      line: lineOf(sf, node),
      rule: 'button-group',
      message: `${how} draws its own group of buttons; use ButtonRow (actions), Answers (a choice), ChipRow (chips) or KeyPad (keys)`,
    });
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const callback = node.arguments[0];
      if (node.expression.name.text === 'map' && callback && ts.isFunctionLike(callback)) {
        if (returnedExpressions(callback).some(isButtonCell) && !GROUP_PARENTS.has(parentTag(node)))
          report(node, 'a .map() that returns a Button');
      }
    }
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const owner = ts.isJsxElement(node) ? tagName(node) : parentTag(node);
      if (hasAdjacentButtons(node) && !GROUP_PARENTS.has(owner))
        report(node, 'two or more adjacent sibling Buttons');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The component names a `packages/ui` barrel exports as values (PascalCase with a lowercase letter). */
export function uiComponentNames(text) {
  const sf = parse('index.ts', text);
  const names = new Set();
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || st.isTypeOnly || !st.exportClause) continue;
    if (!ts.isNamedExports(st.exportClause)) continue;
    for (const el of st.exportClause.elements) {
      if (!el.isTypeOnly && /^[A-Z][A-Za-z0-9]*[a-z]/.test(el.name.text)) names.add(el.name.text);
    }
  }
  return names;
}

/** Rule (b): an app component named like one `packages/ui` exports. */
export function shadowedUiComponents({ path, text }, uiNames) {
  const sf = parse(path, text);
  const found = [];
  const report = (node, name) =>
    found.push({
      path,
      line: lineOf(sf, node),
      rule: 'shadowing',
      name,
      message: `declares ${name}, which @/ui already exports; import and use that one`,
    });
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && uiNames.has(node.name.text))
      report(node, node.name.text);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      uiNames.has(node.name.text)
    ) {
      const init = unwrap(node.initializer);
      if (
        init &&
        (ts.isArrowFunction(init) || ts.isFunctionExpression(init) || ts.isCallExpression(init))
      )
        report(node, node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const isChevronFlip = (cond) => {
  const arms = [cond.whenTrue, cond.whenFalse].map((a) => {
    const u = unwrap(a);
    return u && ts.isStringLiteralLike(u) ? u.text : null;
  });
  return arms.includes('chevronDown') && arms.includes('chevronRight');
};

/** Rule (d): an Icon whose name flips between chevronDown and chevronRight. */
export function handMadeDisclosureChevrons({ path, text }) {
  if (path === DISCLOSURE_FILE) return [];
  const sf = parse(path, text);
  const found = [];
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      for (const attr of node.tagName.getText() === 'Icon' ? node.attributes.properties : []) {
        if (!ts.isJsxAttribute(attr) || attr.name.getText() !== 'name') continue;
        const init = attr.initializer;
        const expr = init && ts.isJsxExpression(init) ? unwrap(init.expression) : null;
        if (expr && ts.isConditionalExpression(expr) && isChevronFlip(expr))
          found.push({
            path,
            line: lineOf(sf, node),
            rule: 'chevron',
            message: 'an Icon flips between chevronDown and chevronRight; use DisclosureChevron',
          });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
