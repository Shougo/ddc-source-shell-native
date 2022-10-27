# ddc-source-zsh

Zsh completion for ddc.vim

## Required

### denops.vim

https://github.com/vim-denops/denops.vim

### ddc.vim

https://github.com/Shougo/ddc.vim

### zsh and zsh/zpty module

```zsh
zmodload zsh/zpty
```

## Configuration

It saves compdump file in `$DEOPLETE_ZSH_CACHE_DIR` or `$XDG_CACHE_HOME` or
`$HOME/cache` directory.

```vim
call ddc#custom#patch_global('sources', ['zsh'])
call ddc#custom#patch_global('sourceOptions', {
      \ '_': {'matchers': ['matcher_head']},
      \ 'zsh': {'mark': 'Z'},
      \ })
```

## Original code

It includes
[zsh-capture-completion](https://github.com/Valodim/zsh-capture-completion) and
[deoplete-zsh](https://github.com/deoplete-plugins/deoplete-zsh)
