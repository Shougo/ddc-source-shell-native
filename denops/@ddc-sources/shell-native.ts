import { type Context, type Item } from "jsr:@shougo/ddc-vim@~9.1.0/types";
import { BaseSource } from "jsr:@shougo/ddc-vim@~9.1.0/source";
import { printError } from "jsr:@shougo/ddc-vim@~9.1.0/utils";

import type { Denops } from "jsr:@denops/core@~7.0.0";
import * as fn from "jsr:@denops/std@~7.4.0/function";
import * as op from "jsr:@denops/std@~7.4.0/option";
import * as vars from "jsr:@denops/std@~7.4.0/variable";

import { TextLineStream } from "jsr:@std/streams@~1.0.3/text-line-stream";

type Params = {
  envs: Record<string, string>;
  shell: string;
};

export class Source extends BaseSource<Params> {
  override getCompletePosition(args: {
    context: Context;
  }): Promise<number> {
    const matchPos = args.context.input.search(/\S*$/);
    const completePos = matchPos !== null ? matchPos : -1;
    return Promise.resolve(completePos);
  }

  override async gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
  }): Promise<Item[]> {
    const shell = args.sourceParams.shell;

    if (shell === "" || await fn.executable(args.denops, shell) === 0) {
      return [];
    }

    const runtimepath = await op.runtimepath.getGlobal(args.denops);
    const capture = await args.denops.call(
      "globpath",
      runtimepath,
      `bin/capture.${shell}`,
      1,
      1,
    ) as string[];
    if (capture.length < 0) {
      return [];
    }

    let input = args.context.input;
    if (args.context.mode !== "c") {
      const filetype = await op.filetype.getLocal(args.denops);
      if (
        filetype === "deol" && await fn.exists(args.denops, "*deol#get_input")
      ) {
        input = await args.denops.call("deol#get_input") as string;
      }

      const uiName = await vars.b.get(args.denops, "ddt_ui_name", "");
      if (uiName.length > 0 && await fn.exists(args.denops, "*ddt#get_input")) {
        input = await args.denops.call("ddt#get_input", uiName) as string;
      }
    }

    // For ":!" completion in command line
    if (args.context.mode === "c" && input.startsWith("!")) {
      input = input.slice(1);
    }

    const proc = new Deno.Command(
      shell,
      {
        args: [capture[0], input],
        stdout: "piped",
        stderr: "piped",
        stdin: "null",
        cwd: await fn.getcwd(args.denops) as string,
        env: args.sourceParams.envs,
      },
    ).spawn();

    // NOTE: In Vim, await command.output() does not work.
    const stdout = [];
    let replaceLine = true;
    for await (let line of iterLine(proc.stdout)) {
      if (line.length === 0) {
        continue;
      }

      if (replaceLine) {
        // NOTE: Replace the first line.  It may includes garbage texts.
        line = line.replace(/\r\r.*\[J/, "");
        if (line.startsWith(input)) {
          line = line.slice(input.length);
        }
        replaceLine = false;
      }

      stdout.push(line);
    }

    const delimiter = {
      zsh: " -- ",
      fish: "\t",
    }[shell] ?? "";

    const items = stdout.map((line) => {
      if (delimiter === "") {
        return { word: line };
      }
      const pieces = line.split(delimiter);
      return pieces.length <= 1
        ? { word: line }
        : { word: pieces[0], info: pieces[1] };
    });

    proc.status.then(async (s) => {
      if (s.success) {
        return;
      }

      await printError(
        args.denops,
        `Run ${shell} is failed with exit code ${s.code}.`,
      );
      const err = [];
      for await (const line of iterLine(proc.stderr)) {
        err.push(line);
      }
      await printError(
        args.denops,
        err.join("\n"),
      );
    });

    return items;
  }

  override params(): Params {
    return {
      envs: {},
      shell: "",
    };
  }
}

async function* iterLine(r: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const lines = r
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  for await (const line of lines) {
    if ((line as string).length) {
      yield line as string;
    }
  }
}
