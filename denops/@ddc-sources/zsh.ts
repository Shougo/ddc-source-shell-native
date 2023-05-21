import {
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddc_vim@v3.4.0/types.ts";
import { Denops, fn, op } from "https://deno.land/x/ddc_vim@v3.4.0/deps.ts";

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  _existsZsh = false;

  override async onInit(args: {
    denops: Denops;
  }): Promise<void> {
    this._existsZsh = await fn.executable(args.denops, "zsh") as boolean;
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
    const capture = await fn.globpath(
      args.denops,
      runtimepath,
      "bin/capture.zsh",
      1,
      1,
    ) as string[];
    if (capture.length < 0) {
      return [];
    }
    const input = await fn.exists(args.denops, "*deol#get_input")
      ? await args.denops.call("deol#get_input") as string
      : args.context.input;

    const command = new Deno.Command(
      "zsh",
      {
        args: [capture[0], input],
        cwd: await fn.getcwd(args.denops) as string,
      },
    );

    const { stdout } = await command.output();

    const items = new TextDecoder().decode(stdout).split(/\r?\n/)
      .filter((line) => line.length !== 0)
      .map((line) => {
        const pieces = line.split(" -- ");
        return pieces.length <= 1
          ? { word: line }
          : { word: pieces[0], info: pieces[1] };
      });

    return items;
  }

  override params(): Params {
    return {};
  }
}
