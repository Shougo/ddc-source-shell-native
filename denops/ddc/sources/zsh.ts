import {
  BaseSource,
  Candidate,
  Context,
  Denops,
  SourceOptions,
} from "https://deno.land/x/ddc_vim@v0.0.4/types.ts";

export class Source extends BaseSource {
  async getCompletePosition(
    _denops: Denops,
    context: Context,
    _options: SourceOptions,
    _params: Record<string, unknown>,
  ): Promise<number> {
    const matchPos = context.input.search(/\S+$/);
    const completePos = matchPos != null ? matchPos : -1;
    return Promise.resolve(completePos);
  }

  async gatherCandidates(
    denops: Denops,
    context: Context,
    _options: SourceOptions,
    _params: Record<string, unknown>,
  ): Promise<Candidate[]> {
    // Note: denops.vim does not have options support...
    const runtimepath =
      (await denops.call("getbufvar", 1, "&runtimepath")) as string;
    const capture =
      (await denops.call(
        "globpath",
        runtimepath,
        "bin/capture.zsh",
        1,
        1,
      )) as string[];
    if (capture.length < 0) {
      return [];
    }
    const p = Deno.run({
      cmd: ["zsh", capture[0], context.input],
      stdout: "piped",
      stderr: "piped",
      stdin: "null",
    });
    await p.status();
    const candidates = new TextDecoder().decode(await p.output()).split(/\r?\n/)
      .map((line) => {
        const pieces = line.split(" -- ");
        return pieces.length <= 1
          ? { word: line }
          : { word: pieces[0], info: pieces[1] };
      });

    return candidates;
  }
}
