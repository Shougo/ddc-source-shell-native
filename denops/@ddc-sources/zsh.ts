import {
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddc_vim@v3.4.0/types.ts";
import { Denops, fn, op } from "https://deno.land/x/ddc_vim@v3.4.0/deps.ts";

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  override getCompletePosition(args: {
    context: Context;
  }): Promise<number> {
    const matchPos = args.context.input.search(/\S+$/);
    const completePos = matchPos != null ? matchPos : -1;
    return Promise.resolve(completePos);
  }

  override async gather(args: {
    denops: Denops;
    context: Context;
  }): Promise<Item[]> {
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
    const existsDeolInput = await fn.exists(args.denops, "*deol#get_input");
    const input = existsDeolInput
      ? await args.denops.call("deol#get_input") as string
      : args.context.input;

    const command = new Deno.Command(
      "zsh", {
        args: [capture[0], input],
      }
    );

    const { stdout } = await command.output();

    const items = new TextDecoder().decode(stdout).split(/\r?\n/)
      .filter((line) => line.length != 0)
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
