import {
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddc_vim@v3.9.1/types.ts";
import { Denops, fn, op } from "https://deno.land/x/ddc_vim@v3.9.1/deps.ts";
import { TextLineStream } from "https://deno.land/std@0.195.0/streams/mod.ts";

type Params = Record<never, never>;

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
  }): Promise<Item[]> {
    if (!this._existsZsh) {
      return [];
    }

    const runtimepath = await op.runtimepath.getGlobal(args.denops);
    const capture = await args.denops.call(
      "globpath",
      runtimepath,
      "bin/capture.zsh",
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

    const cmd = "zsh";
    let items: Item[] = [];
    try {
      const proc = new Deno.Command(
        cmd,
        {
          args: [capture[0], input],
          stdout: "piped",
          stderr: "piped",
          stdin: "null",
          cwd: await fn.getcwd(args.denops) as string,
        },
      ).spawn();

      // NOTE: In Vim, await command.output() does not work.
      const stdout = [];
      for await (const line of iterLine(proc.stdout)) {
        if (line.length !== 0) {
          stdout.push(line);
        }
      }

      proc.kill();

      items = stdout.map((line) => {
        const pieces = line.split(" -- ");
        return pieces.length <= 1
          ? { word: line }
          : { word: pieces[0], info: pieces[1] };
      });
    } catch (e) {
      await args.denops.call(
        "ddu#util#print_error",
        `Run ${cmd} is failed.`,
      );

      if (e instanceof Error) {
        await args.denops.call(
          "ddu#util#print_error",
          e.message,
        );
      }
    }

    return items;
  }

  override params(): Params {
    return {};
  }
}

async function* iterLine(r: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const lines = r
    .pipeThrough(new TextDecoderStream(), {
      preventCancel: false,
      preventClose: false,
    })
    .pipeThrough(new TextLineStream());

  for await (const line of lines) {
    if ((line as string).length) {
      yield line as string;
    }
  }
}
