import { POSITION_UNKNOWN } from "@opticss/element-analysis";
import { Template } from "@opticss/template-api";
import { suite, test } from "mocha-typescript";
import * as postcss from "postcss";

import { Block } from "../../src/Block";
import { BlockFactory } from "../../src/BlockParser";
import { TemplateAnalysis } from "../../src/TemplateAnalysis";
import { normalizeOptions, Options } from "../../src/configuration";
import { TemplateAnalysisError } from "../../src/errors";
import { assertParseError } from "../util/assertError";

type BlockAndRoot = [Block, postcss.Container];

@suite("Validators")
export class TemplateAnalysisTests {
  private parseBlock(css: string, filename: string, opts?: Options, blockName = "analysis"): Promise<BlockAndRoot> {
    let options = normalizeOptions(opts);
    let factory = new BlockFactory(options, postcss);
    let root = postcss.parse(css, { from: filename });
    return factory.parse(root, filename, blockName).then((block) => {
      return <BlockAndRoot>[block, root];
    });
  }

  @test "built-in template validators may be configured with boolean values"() {
    let info = new Template("templates/my-template.hbs");
    let analysis = new TemplateAnalysis(info, { "no-class-pairs": false });
    let options = normalizeOptions({});

    let css = `
      :scope { color: blue; }
      [state|foo] { color: red; }
      .asdf { font-size: 20px; }
      .asdf[state|larger] { font-size: 26px; }
      .fdsa { font-size: 20px; }
      .fdsa[state|larger] { font-size: 26px; }
    `;
    return this.parseBlock(css, "blocks/foo.block.css", options).then(([block, _]) => {
      analysis.blocks[""] = block;
      let element = analysis.startElement(POSITION_UNKNOWN);
      element.addStaticClass(block.getClass("asdf")!);
      element.addStaticClass(block.getClass("fdsa")!);
      analysis.endElement(element);
    });
  }

  @test "custom template validators may be passed to analysis"() {
    let info = new Template("templates/my-template.hbs");
    let analysis = new TemplateAnalysis(info, { customValidator(data, _a, err) { if (data) err("CUSTOM ERROR"); } });
    let options = normalizeOptions({});

    let css = `
      :scope { color: blue; }
    `;
    return assertParseError(
      TemplateAnalysisError,
      "CUSTOM ERROR (templates/my-template.hbs:1:2)",
      this.parseBlock(css, "blocks/foo.block.css", options).then(([block, _]) => {
        analysis.blocks[""] = block;
        let element = analysis.startElement({ line: 1, column: 2 });
        analysis.endElement(element);
      }),
    );
  }

}
