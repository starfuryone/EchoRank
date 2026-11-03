import { doc, page, pc, type RuleCase } from "../harness";

const OK = page(doc("<title>t</title>", "<h1>x</h1>"));
const raw = (html: string) => page(html);

const cases: RuleCase[] = [
  pc("validation.missing_doctype", "no doctype", true, page(doc("<title>t</title>", "", { doctype: false }))),
  pc("validation.missing_doctype", "after a comment is fine", false, raw("<!-- build 42 --><!doctype html><html><head></head><body></body></html>")),
  pc("validation.missing_doctype", "present", false, OK),
  pc("validation.invalid_head_element", "div in head", true, raw("<!doctype html><html><head><title>t</title><div>x</div></head><body></body></html>"), { elements: "div" }),
  pc("validation.invalid_head_element", "markup inside a script is not an element", false, raw('<!doctype html><html><head><script>document.write("<div>")</script></head><body></body></html>')),
  pc("validation.invalid_head_element", "clean head", false, OK),
  pc("validation.body_before_head", "body first", true, raw("<!doctype html><html><body></body><head></head></html>")),
  pc("validation.body_before_head", "normal order", false, OK),
  pc("validation.multiple_html_or_body", "two bodies", true, raw("<!doctype html><html><head></head><body></body><body></body></html>"), { body: 2 }),
  pc("validation.multiple_html_or_body", "one each", false, OK),
  pc("validation.head_not_first", "meta before head", true, raw('<!doctype html><html><meta charset="utf-8"><head></head><body></body></html>')),
  pc("validation.head_not_first", "head first", false, OK),
  pc("validation.missing_viewport", "none", true, raw("<!doctype html><html><head><title>t</title></head><body></body></html>")),
  pc("validation.missing_viewport", "present", false, OK),
];

export default cases;
