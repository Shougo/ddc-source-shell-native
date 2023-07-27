import {
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddc_vim@v3.9.1/types.ts";
import { Denops, fn, op } from "https://deno.land/x/ddc_vim@v3.9.1/deps.ts";
import { TextLineStream } from "https://deno.land/std@0.195.0/streams/mod.ts";

type Params = {
  envs: Record<string, string>;
  shell: string;
};

export class Source extends BaseSource<Params> {
  _existsZsh = false;

  override async onInit(args: {
    denops: Denops;
  }): Promise<void> {
    this._existsZsh = await fn.executable(args.denops, "zsh") !== 0;
  }

  override getCompletePosition(args: {
    context: Context;
  }): Promise<number> {
    const matchPos = args.context.input.search(/\S+$/);
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

    let input = args.context.mode !== "c" &&
        await fn.exists(args.denops, "*deol#get_input")
      ? await args.denops.call("deol#get_input") as string
      : args.context.input;

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

      await args.denops.call(
        "ddc#util#print_error",
        `Run ${shell} is failed with exit code ${s.code}.`,
      );
      const err = [];
      for await (const line of iterLine(proc.stderr)) {
        err.push(line);
      }
      await args.denops.call(
        "ddc#util#print_error",
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
